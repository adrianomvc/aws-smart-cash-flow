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
    "MERCADOLIVRE": ("MERCADO", "LIVRE"),
    "MERCADOPAGO": ("MERCADO", "PAGO"),
    "MERCADOPAG": ("MERCADO", "PAGO"),
    "AMAZONMKTPLC": ("AMAZON",),
    "IFD": ("IFOOD",),
    "EBN": ("EBANX",),
    "NUV": ("NUVEMSHOP",),
}

DROP_SUFFIX_AFTER_PREFIX = {
    "AMAZONMKTPLC",
    "MERCADOLIVRE",
    "SHOPEE",
}


def parse_brazilian_decimal(raw_value: str) -> Decimal:
    normalized = raw_value.strip().replace(".", "").replace(",", ".")
    amount = Decimal(normalized)
    if not amount.is_finite():
        raise InvalidOperation
    return amount


def normalize_transaction_description(raw_description: str) -> str:
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()

    prefix_match = re.match(r"^\s*([A-Z0-9]+)\s*\*", ascii_description)
    if prefix_match:
        prefix = prefix_match.group(1)
        if prefix in DROP_SUFFIX_AFTER_PREFIX:
            return " ".join(DESCRIPTION_TOKEN_ALIASES.get(prefix, (prefix,)))

    cleaned = re.sub(r"[*_/\\|,.;:]+", " ", ascii_description)
    tokens = cleaned.split()
    normalized_tokens: list[str] = []
    for token in tokens:
        if token.isdigit() and len(token) >= 4:
            continue
        expanded_tokens = DESCRIPTION_TOKEN_ALIASES.get(token, (token,))
        for expanded_token in expanded_tokens:
            if normalized_tokens and normalized_tokens[-1] == expanded_token:
                continue
            normalized_tokens.append(expanded_token)
    return " ".join(_collapse_repeated_sequences(normalized_tokens))


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
            )
        )

    return ParseResult(
        source_kind=SourceKind.CREDIT_CARD_CSV,
        total_rows=total_rows,
        transactions=transactions,
        errors=errors,
    )
