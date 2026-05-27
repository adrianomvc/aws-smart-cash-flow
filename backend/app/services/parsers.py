import csv
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from unicodedata import normalize

from app.domain.imports import (
    ParsedTransaction,
    ParseError,
    ParseResult,
    SourceKind,
    TransactionDirection,
)

DESCRIPTION_TOKEN_ALIASES = {
    "MERCADOLI": ("MERCADO", "LIVRE"),
    "MERCADOLIV": ("MERCADO", "LIVRE"),
    "MERCADOLIVRE": ("MERCADO", "LIVRE"),
    "MERCADOPAGO": ("MERCADO", "PAGO"),
    "MERCADOPAG": ("MERCADO", "PAGO"),
    "AMAZONMKTPLC": ("AMAZON",),
    "IFD": ("IFOOD",),
    "EBN": ("EBANX",),
    "NUV": ("NUVEMSHOP",),
    "UBERBR": ("UBER", "BR"),
    "UBERBRASIL": ("UBER", "BR"),
}

PREFIX_TOKEN_ALIASES = {
    "MP": ("MERCADO", "PAGO"),
}

CONTEXTUAL_TOKEN_ALIASES = {
    ("PAYPAL", "AB"): ("PAYPAL", "ABASTECE", "AI"),
    ("PAYPAL", "SH"): ("PAYPAL", "SHELLBOX"),
    ("PAYPAL", "UB"): ("PAYPAL", "UBER", "BR"),
}

SEQUENCE_TOKEN_ALIASES = {
    ("99", "APP"): ("99APP",),
    ("99", "FOOD"): ("99FOOD",),
    ("99", "TAXI"): ("99TAXI",),
    ("AD", "FREE", "FOR", "PRIM"): ("AD", "FREE", "FOR", "PRIME"),
    ("GOOGLE", "YOUTUB"): ("GOOGLE", "YOUTUBE"),
    ("SHELL", "BOX"): ("SHELLBOX",),
    ("UBER", "DO", "BRASI"): ("UBER", "BR"),
}


def parse_brazilian_decimal(raw_value: str) -> Decimal:
    normalized = raw_value.strip().replace(".", "").replace(",", ".")
    amount = Decimal(normalized)
    if not amount.is_finite():
        raise InvalidOperation
    return amount


def normalize_transaction_description(raw_description: str) -> str:
    return _normalize_transaction_description(raw_description, drop_installment=True)


def normalize_transaction_description_for_dedupe(raw_description: str) -> str:
    return _normalize_transaction_description(raw_description, drop_installment=False)


def _normalize_transaction_description(raw_description: str, *, drop_installment: bool) -> str:
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    if drop_installment:
        ascii_description = _drop_trailing_installment_suffix(ascii_description)

    cleaned = re.sub(r"[*_/\\|,.;:]+", " ", ascii_description)
    tokens = cleaned.split()
    normalized_tokens: list[str] = []
    for index, token in enumerate(tokens):
        if token.isdigit() and len(token) >= 4:
            continue
        expanded_tokens = (
            PREFIX_TOKEN_ALIASES[token]
            if index == 0 and len(tokens) > 1 and token in PREFIX_TOKEN_ALIASES
            else DESCRIPTION_TOKEN_ALIASES.get(token, (token,))
        )
        for expanded_token in expanded_tokens:
            if normalized_tokens and normalized_tokens[-1] == expanded_token:
                continue
            normalized_tokens.append(expanded_token)
    normalized_tokens = _apply_sequence_aliases(normalized_tokens)
    normalized_tokens = _apply_contextual_aliases(normalized_tokens)
    if drop_installment:
        normalized_tokens = _drop_trailing_installment_tokens(normalized_tokens)
    return " ".join(_collapse_repeated_sequences(normalized_tokens))


def extract_installment(raw_description: str) -> tuple[int | None, int | None]:
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    slash_match = re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})\s*$", ascii_description)
    if slash_match:
        return _valid_installment_pair(slash_match.group(1), slash_match.group(2))

    tokens = re.sub(r"[*_/\\|,.;:]+", " ", ascii_description).split()
    if len(tokens) < 3:
        return None, None
    return _valid_installment_pair(tokens[-2], tokens[-1])


def _valid_installment_pair(current_raw: str, total_raw: str) -> tuple[int | None, int | None]:
    if not (current_raw.isdigit() and total_raw.isdigit()):
        return None, None
    current = int(current_raw)
    total = int(total_raw)
    if 1 <= current <= total <= 99:
        return current, total
    return None, None


def _apply_sequence_aliases(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    aliased: list[str] = []
    index = 0
    max_size = max(len(key) for key in SEQUENCE_TOKEN_ALIASES)
    while index < len(tokens):
        replacement: tuple[str, ...] | None = None
        matched_size = 0
        for size in range(min(max_size, len(tokens) - index), 0, -1):
            sequence = tuple(tokens[index : index + size])
            replacement = SEQUENCE_TOKEN_ALIASES.get(sequence)
            if replacement is not None:
                matched_size = size
                break
        if replacement is not None:
            aliased.extend(replacement)
            index += matched_size
            continue
        aliased.append(tokens[index])
        index += 1
    return aliased


def _apply_contextual_aliases(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    aliased: list[str] = []
    index = 0
    while index < len(tokens):
        pair = tuple(tokens[index : index + 2])
        replacement = CONTEXTUAL_TOKEN_ALIASES.get(pair)
        if replacement is not None:
            aliased.extend(replacement)
            index += 2
            continue
        aliased.append(tokens[index])
        index += 1
    return aliased


def _drop_trailing_installment_tokens(tokens: list[str]) -> list[str]:
    if len(tokens) < 3:
        return tokens
    current_token, total_token = tokens[-2], tokens[-1]
    if not (current_token.isdigit() and total_token.isdigit()):
        return tokens
    current = int(current_token)
    total = int(total_token)
    if 1 <= current <= total <= 99:
        return tokens[:-2]
    return tokens


def _drop_trailing_installment_suffix(value: str) -> str:
    match = re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})\s*$", value)
    if not match:
        return value
    current = int(match.group(1))
    total = int(match.group(2))
    if 1 <= current <= total <= 99:
        return value[: match.start()].strip()
    return value


def _collapse_repeated_sequences(tokens: list[str]) -> list[str]:
    collapsed = list(tokens)
    index = 0
    while index < len(collapsed):
        max_size = (len(collapsed) - index) // 2
        removed = False
        for size in range(max_size, 0, -1):
            left = collapsed[index : index + size]
            right = collapsed[index + size : index + (size * 2)]
            if left == right:
                del collapsed[index + size : index + (size * 2)]
                removed = True
                break
        if not removed:
            index += 1
    return collapsed


def is_credit_card_payment_description(description: str) -> bool:
    return "FATURA" in description and (
        "PAGAMENTO" in description or "PAGTO" in description or "PGTO" in description
    )


def parse_txt_bank_statement(content: str) -> ParseResult:
    transactions: list[ParsedTransaction] = []
    errors: list[ParseError] = []
    lines = content.splitlines()

    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue

        parts = line.split(";")
        if len(parts) != 3:
            errors.append(
                ParseError(
                    source_line=line_number,
                    raw_value=line,
                    error_code="invalid_column_count",
                    message="Expected 3 semicolon-separated columns",
                )
            )
            continue

        raw_date, raw_description, raw_amount = [part.strip() for part in parts]
        if not raw_description:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="description",
                    raw_value=raw_description,
                    error_code="missing_description",
                    message="Description is required",
                )
            )
            continue

        try:
            transaction_date = datetime.strptime(raw_date, "%d/%m/%Y").date()
        except ValueError:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="date",
                    raw_value=raw_date,
                    error_code="invalid_date",
                    message="Expected date format dd/MM/yyyy",
                )
            )
            continue

        try:
            amount = parse_brazilian_decimal(raw_amount)
        except InvalidOperation:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="amount",
                    raw_value=raw_amount,
                    error_code="invalid_amount",
                    message="Expected Brazilian decimal amount",
                )
            )
            continue

        normalized_description = normalize_transaction_description(raw_description)
        direction = (
            TransactionDirection.PAYMENT
            if amount < 0 and is_credit_card_payment_description(normalized_description)
            else TransactionDirection.DEBIT
            if amount < 0
            else TransactionDirection.CREDIT
        )

        transactions.append(
            ParsedTransaction(
                transaction_date=transaction_date,
                raw_description=raw_description,
                description=normalized_description,
                amount=amount,
                direction=direction,
                source_line=line_number,
            )
        )

    return ParseResult(
        source_kind=SourceKind.BANK_STATEMENT_TXT,
        total_rows=sum(1 for line in lines if line.strip()),
        transactions=transactions,
        errors=errors,
    )


def parse_credit_card_csv(content: str) -> ParseResult:
    transactions: list[ParsedTransaction] = []
    errors: list[ParseError] = []
    reader = csv.DictReader(StringIO(content))
    expected_headers = ["data", "lançamento", "valor"]

    if reader.fieldnames != expected_headers:
        return ParseResult(
            source_kind=SourceKind.CREDIT_CARD_CSV,
            total_rows=0,
            errors=[
                ParseError(
                    error_code="invalid_csv_header",
                    raw_value=",".join(reader.fieldnames or []),
                    message="Expected header: data,lançamento,valor",
                )
            ],
        )

    total_rows = 0
    for line_number, row in enumerate(reader, start=2):
        total_rows += 1
        if None in row:
            errors.append(
                ParseError(
                    source_line=line_number,
                    raw_value=str(row.get(None)),
                    error_code="invalid_column_count",
                    message="Unexpected extra CSV columns",
                )
            )
            continue

        raw_date = (row.get("data") or "").strip()
        raw_description = (row.get("lançamento") or "").strip()
        raw_amount = (row.get("valor") or "").strip()

        if not raw_description:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="lançamento",
                    raw_value=raw_description,
                    error_code="missing_description",
                    message="Description is required",
                )
            )
            continue

        try:
            transaction_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="data",
                    raw_value=raw_date,
                    error_code="invalid_date",
                    message="Expected date format yyyy-MM-dd",
                )
            )
            continue

        try:
            amount = Decimal(raw_amount)
        except InvalidOperation:
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="valor",
                    raw_value=raw_amount,
                    error_code="invalid_amount",
                    message="Expected decimal amount",
                )
            )
            continue
        if not amount.is_finite():
            errors.append(
                ParseError(
                    source_line=line_number,
                    field_name="valor",
                    raw_value=raw_amount,
                    error_code="invalid_amount",
                    message="Expected finite decimal amount",
                )
            )
            continue

        normalized_description = normalize_transaction_description(raw_description)
        installment_current, installment_total = extract_installment(raw_description)
        if amount < 0 and normalized_description == "PAGAMENTO EFETUADO":
            direction = TransactionDirection.PAYMENT
        elif amount < 0:
            direction = TransactionDirection.CREDIT
        else:
            direction = TransactionDirection.DEBIT
        transactions.append(
            ParsedTransaction(
                transaction_date=transaction_date,
                raw_description=raw_description,
                description=normalized_description,
                amount=amount,
                direction=direction,
                source_line=line_number,
                installment_current=installment_current,
                installment_total=installment_total,
            )
        )

    return ParseResult(
        source_kind=SourceKind.CREDIT_CARD_CSV,
        total_rows=total_rows,
        transactions=transactions,
        errors=errors,
    )
