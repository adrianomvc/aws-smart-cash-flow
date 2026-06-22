import csv
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from unicodedata import normalize

from app.domain.imports import (
    ParsedAccountBalance,
    ParsedCalendarEvent,
    ParsedCreditCard,
    ParsedTransaction,
    ParseError,
    ParseResult,
    SourceKind,
    TransactionDirection,
)

DESCRIPTION_TOKEN_ALIASES = {
    # Marketplaces
    "MERCADOLI": ("MERCADO", "LIVRE"),
    "MERCADOLIV": ("MERCADO", "LIVRE"),
    "MERCADOLIVRE": ("MERCADO", "LIVRE"),
    "MERCADOPAGO": ("MERCADO", "PAGO"),
    "MERCADOPAG": ("MERCADO", "PAGO"),
    "AMAZONMKTPLC": ("AMAZON",),
    "AMZN": ("AMAZON",),
    "AMZNMKTPL": ("AMAZON",),
    "AMZNMKTP": ("AMAZON",),
    "SHOPEE": ("SHOPEE",),
    # Food delivery
    "IFD": ("IFOOD",),
    "IFOODCOM": ("IFOOD",),
    "IFOODPEDID": ("IFOOD",),
    "RAPPI": ("RAPPI",),
    # Streaming
    "NETFLIXCOM": ("NETFLIX",),
    "SPOTIFYAB": ("SPOTIFY",),
    "DISNEYPLUS": ("DISNEY", "PLUS"),
    # Mobilidade
    "UBERBR": ("UBER", "BR"),
    "UBERBRASIL": ("UBER", "BR"),
    "UBEREST": ("UBER", "EATS"),
    "UBEREAT": ("UBER", "EATS"),
    # Fintech BR
    "NUBANK": ("NUBANK",),
    "NUFINANCE": ("NUBANK",),
    "C6BANK": ("C6", "BANK"),
    # Outros
    "EBN": ("EBANX",),
    "NUV": ("NUVEMSHOP",),
    # Canais de pagamento — ruído, removidos
    "INT": (),
    "CEL": (),
    "OPF": (),
    "SISDEB": (),
    "SISPAG": (),
    "EST": (),
    # Códigos de banco — ruído puro
    "001": (),
    "033": (),
    "077": (),
    "104": (),
    "237": (),
    "260": (),
    "290": (),
    "336": (),
    "341": (),
    "356": (),
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
    # Canais de pagamento compostos — ruído
    ("INT", "PAG"): (),
    ("MOBILE", "PAG"): (),
    ("CEL", "PAG"): (),
    ("MOB", "PAG"): (),
    # Boleto/título — normalizar prefixo de pagamento
    ("PAG", "TIT"): ("TIT",),
    ("TIT", "PAG"): ("TIT",),
}

# Prefixos de método de pagamento — removidos do início pois o tipo já está em direction/source_type
# TRANSF/TRANSFERENCIA excluídos: são parte da descrição em P2P (PIX TRANSF FLAVIA)
PAYMENT_METHOD_PREFIXES = {
    "PIX", "TED", "DOC", "DEB",
    "PAG", "PGTO", "PAGTO",
}

# Tokens de sufixo geográfico — removidos do final da descrição
GEO_SUFFIX_TOKENS = {
    "BR", "BRA", "BRASIL",
    "SP", "RJ", "MG", "RS", "PR", "SC", "BA", "CE",
    "GO", "PE", "AM", "PA", "MT", "MS", "ES", "RN",
    "DF", "PB", "AL", "SE", "PI", "MA", "TO", "RO",
    "AC", "RR", "AP",
}

# Tokens de título/boleto que requerem tratamento especial
_TITULO_TOKENS = {"TITULO", "BOLETO", "TIT", "BOL"}


def parse_brazilian_decimal(raw_value: str) -> Decimal:
    normalized = raw_value.strip().replace(".", "").replace(",", ".")
    amount = Decimal(normalized)
    if not amount.is_finite():
        raise InvalidOperation
    return amount


def parse_decimal_cell(raw_value: object) -> Decimal:
    if isinstance(raw_value, Decimal):
        return raw_value
    if isinstance(raw_value, int | float):
        amount = Decimal(str(raw_value))
        if not amount.is_finite():
            raise InvalidOperation
        return amount
    text = str(raw_value).strip().replace("R$", "").replace(" ", "")
    return parse_brazilian_decimal(text)


def normalize_transaction_description(
    raw_description: str, transaction_date: date | None = None
) -> str:
    base = _normalize_transaction_description(
        raw_description, drop_installment=True, transaction_date=transaction_date
    )
    return _enrich_titulo_description(base, raw_description)


def normalize_transaction_description_for_dedupe(raw_description: str) -> str:
    return _normalize_transaction_description(raw_description, drop_installment=False)


def _enrich_titulo_description(normalized: str, raw_description: str) -> str:
    """If the normalized description is a generic titulo/boleto, try to extract a beneficiary
    identifier from the raw description to make it more specific."""
    tokens = normalized.split()
    if not any(t in _TITULO_TOKENS for t in tokens):
        return normalized

    raw_ascii = "".join(
        char for char in normalize("NFKD", raw_description) if char.encode("ascii", "ignore") != b""
    ).upper()
    raw_tokens = re.sub(r"[*_/\\|,.;:]+", " ", raw_ascii).split()

    # Collect candidate beneficiary tokens: alphabetic, not a noise prefix/suffix/titulo token
    skip = PAYMENT_METHOD_PREFIXES | GEO_SUFFIX_TOKENS | _TITULO_TOKENS | {"TIT", "BOL"}
    candidates = [
        t for t in raw_tokens
        if t.isalpha() and len(t) >= 3 and t not in skip and not t.isdigit()
    ]
    # Remove tokens already in the normalized description
    existing = set(tokens)
    extra = [t for t in candidates if t not in existing]
    if extra:
        # Take the first meaningful candidate as beneficiary identifier
        return normalized + " " + extra[0]
    return normalized


def _normalize_transaction_description(
    raw_description: str, *, drop_installment: bool, transaction_date: date | None = None
) -> str:
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    if drop_installment:
        # Order matters: valid installments (N/M) first, then a leftover trailing date,
        # then a "PARC NN" marker — all noise that fragments grouping of recurring/parceled items.
        ascii_description = _drop_trailing_installment_suffix(ascii_description)
        ascii_description = _drop_trailing_date_suffix(ascii_description, transaction_date)
        ascii_description = _drop_trailing_parc_suffix(ascii_description)

    cleaned = re.sub(r"[*_/\\|,.;:]+", " ", ascii_description)
    # Drop STANDALONE long digit runs (years, card numbers) BEFORE the letter↔digit split,
    # so digits glued to letters (e.g. a license plate "EWR2311") are preserved as identity.
    cleaned = re.sub(r"(?<!\S)\d{4,}(?!\S)", " ", cleaned)
    # split on letter↔digit boundary so "OSVALDO04" becomes "OSVALDO 04"
    cleaned = re.sub(r"(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])", " ", cleaned)
    tokens = cleaned.split()
    normalized_tokens: list[str] = []
    for index, token in enumerate(tokens):
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
    normalized_tokens = _drop_payment_method_prefix(normalized_tokens)
    normalized_tokens = _drop_geo_suffix(normalized_tokens)
    normalized_tokens = _drop_com_suffix(normalized_tokens)
    normalized_tokens = _drop_trailing_pos_code(normalized_tokens)
    return " ".join(_collapse_repeated_sequences(normalized_tokens))


_P2P_GUARD = {"TRANSF", "TRANSFERENCIA"}
_SCHEDULED_GUARD = {"AGENDADA", "AGENDADO"}


def _drop_payment_method_prefix(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    result = list(tokens)
    while result and result[0] in PAYMENT_METHOD_PREFIXES:
        rest = result[1:]
        # Stop when what follows signals titulo, P2P transfer, or scheduled payment context
        if rest and (
            rest[0] in _TITULO_TOKENS or rest[0] in _P2P_GUARD or rest[0] in _SCHEDULED_GUARD
        ):
            break
        result = rest
    return result if result else tokens


_GEO_BRAND_PROTECTORS = {"UBER"}  # brands that use country suffix as part of their service name


def _drop_geo_suffix(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    result = list(tokens)
    # Remove up to 2 trailing geo tokens, guarded by two rules:
    # 1. Only strip when at least 3 tokens exist (preserves "DAISO BRASIL")
    # 2. Don't strip when the preceding token is a brand that uses BR as part of its name
    for _ in range(2):
        if (len(result) >= 3
                and result[-1] in GEO_SUFFIX_TOKENS
                and result[-2] not in _GEO_BRAND_PROTECTORS):
            result = result[:-1]
        else:
            break
    return result if result else tokens


def _drop_com_suffix(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    result = list(tokens)
    # "COM BR" at end
    if len(result) >= 2 and result[-1] == "BR" and result[-2] == "COM":
        result = result[:-2]
    # lone "COM" at end
    elif result and result[-1] == "COM":
        result = result[:-1]
    return result if result else tokens


def _drop_trailing_pos_code(tokens: list[str]) -> list[str]:
    """Remove trailing 3-6 digit POS terminal codes that are not installments."""
    if len(tokens) < 2:
        return tokens
    result = list(tokens)
    last = result[-1]
    if last.isdigit() and 3 <= len(last) <= 6:
        # Only remove if not already handled as installment (which strips 1-2 digit pairs)
        result = result[:-1]
    return result if result else tokens


def extract_installment_marker(raw_description: str) -> tuple[int | None, int | None]:
    """Extract only an explicit "PARC NN" / "PARC NN/MM" installment marker.

    Unlike :func:`extract_installment`, this ignores the loose trailing-number and
    slash heuristics, so it is safe for bank-statement descriptions where a trailing
    date or POS code would otherwise be misread as an installment pair (e.g. an IPVA
    paid in installments shows "...PARC01"). When there is no total ("/MM"), the
    current installment is recorded and the total left unknown; returns ``(None, None)``
    when no explicit marker is present.
    """
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    parc = re.search(r"PARC\s*(\d{1,2})(?:\s*/\s*(\d{1,2}))?", ascii_description)
    if not parc:
        return None, None
    if parc.group(2):
        pair = _valid_installment_pair(parc.group(1), parc.group(2))
        if pair != (None, None):
            return pair
    current = int(parc.group(1))
    if 1 <= current <= 99:
        return current, None
    return None, None


def extract_installment(raw_description: str) -> tuple[int | None, int | None]:
    # Explicit installment marker "PARC NN" (optionally "PARC NN/MM") takes priority.
    marker = extract_installment_marker(raw_description)
    if marker != (None, None):
        return marker
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    slash_match = re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})\s*$", ascii_description)
    if slash_match:
        return _valid_installment_pair(slash_match.group(1), slash_match.group(2))

    # Installment embedded in a merchant code with no separator, e.g. "&*2343808/10" → 08/10.
    # The (?<!\d) lookbehind above fails when more digits precede the installment pair;
    # try without the constraint and rely on _valid_installment_pair to reject bad pairs.
    embedded = re.search(r"(\d{1,2})/(\d{1,2})\s*$", ascii_description)
    if embedded:
        result = _valid_installment_pair(embedded.group(1), embedded.group(2))
        if result != (None, None):
            return result

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


def _drop_trailing_parc_suffix(value: str) -> str:
    """Remove a trailing installment marker like "PARC 05" / "PARC05" (no total), which
    is noise that would otherwise split a purchase's installments into separate groups."""
    return re.sub(r"\s*PARC\s*\d{1,3}\s*$", "", value).strip()


def _drop_trailing_date_suffix(value: str, transaction_date: date | None = None) -> str:
    """Remove a trailing date like "DINALVA22/05" / "LOJA 11/10". Two cases:
    - if it equals the transaction's own date (day/month), it is just noise → remove;
    - otherwise remove only when GLUED to a word (PIX/P2P style), keeping spaced
      numbers like "LOJA 11 10" that may be meaningful. Valid installments were already
      removed upstream."""
    match = re.search(r"(\d{1,2})\s*/\s*(\d{1,2})(?:\s*/\s*\d{2,4})?\s*$", value)
    if not match:
        return value
    day = int(match.group(1))
    month = int(match.group(2))
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return value
    matches_tx_date = (
        transaction_date is not None
        and day == transaction_date.day
        and month == transaction_date.month
    )
    glued = match.start() > 0 and value[match.start() - 1].isalpha()
    if matches_tx_date or glued:
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


def is_account_balance_description(description: str) -> bool:
    return description in {
        "SALDO ANTERIOR",
        "SALDO FINAL",
        "SALDO PARCIAL",
        "SALDO TOTAL DISPONIVEL DIA",
    }


def parse_txt_bank_statement(content: str) -> ParseResult:
    transactions: list[ParsedTransaction] = []
    balances: list[ParsedAccountBalance] = []
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
        if is_account_balance_description(normalized_description):
            balances.append(
                ParsedAccountBalance(
                    balance_date=transaction_date,
                    account_name="Conta corrente",
                    balance_amount=amount,
                    source_line=line_number,
                    raw_payload={
                        "data": raw_date,
                        "lançamento": raw_description,
                        "valor": raw_amount,
                    },
                )
            )
            continue

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
        account_balances=balances,
        errors=errors,
    )


def parse_excel_bank_statement(content: bytes) -> ParseResult:
    try:
        import xlrd
    except ImportError:
        return ParseResult(
            source_kind=SourceKind.BANK_STATEMENT_EXCEL,
            total_rows=0,
            errors=[
                ParseError(
                    error_code="missing_excel_reader",
                    message="Excel import requires xlrd to read .xls bank statements",
                )
            ],
        )

    try:
        workbook = xlrd.open_workbook(file_contents=content)
    except Exception as exc:
        return ParseResult(
            source_kind=SourceKind.BANK_STATEMENT_EXCEL,
            total_rows=0,
            errors=[
                ParseError(
                    error_code="invalid_excel_file",
                    raw_value=str(exc),
                    message="Could not read Excel bank statement",
                )
            ],
        )

    sheet = (
        workbook.sheet_by_name("Lançamentos")
        if "Lançamentos" in workbook.sheet_names()
        else workbook.sheet_by_index(0)
    )
    account_name = _excel_account_name(sheet)
    header_row, columns = _excel_statement_columns(sheet)
    if header_row is None:
        return ParseResult(
            source_kind=SourceKind.BANK_STATEMENT_EXCEL,
            total_rows=0,
            errors=[
                ParseError(
                    error_code="invalid_excel_header",
                    message="Expected columns data, lançamento, valor (R$), saldos (R$)",
                )
            ],
        )

    transactions: list[ParsedTransaction] = []
    balances: list[ParsedAccountBalance] = []
    calendar_events: list[ParsedCalendarEvent] = []
    errors: list[ParseError] = []
    total_rows = 0
    section = "actual"
    for row_index in range(header_row + 1, sheet.nrows):
        source_line = row_index + 1
        row_values = [sheet.cell_value(row_index, column) for column in range(sheet.ncols)]
        raw_date = row_values[columns["date"]]
        raw_description = _cell_text(row_values[columns["description"]])
        raw_amount = row_values[columns["amount"]]
        raw_balance = row_values[columns["balance"]]
        if not raw_date and not raw_description and not raw_amount and not raw_balance:
            continue
        section_marker = _excel_section_marker(raw_date, raw_description)
        if section_marker is not None:
            section = section_marker
            continue
        if not raw_description and raw_amount in ("", None) and raw_balance in ("", None):
            continue
        if not raw_date:
            continue

        total_rows += 1
        try:
            transaction_date = _parse_excel_date(raw_date, workbook.datemode)
        except ValueError:
            errors.append(
                ParseError(
                    source_line=source_line,
                    field_name="data",
                    raw_value=str(raw_date),
                    error_code="invalid_date",
                    message="Invalid Excel bank statement date",
                )
            )
            continue

        if section == "actual" and raw_balance not in ("", None):
            try:
                balance_amount = parse_decimal_cell(raw_balance)
            except (InvalidOperation, ValueError):
                errors.append(
                    ParseError(
                        source_line=source_line,
                        field_name="saldos (R$)",
                        raw_value=str(raw_balance),
                        error_code="invalid_balance",
                        message="Invalid account balance amount",
                    )
                )
            else:
                balances.append(
                    ParsedAccountBalance(
                        balance_date=transaction_date,
                        account_name=account_name,
                        balance_amount=balance_amount,
                        source_line=source_line,
                        raw_payload=_excel_raw_payload(row_values),
                    )
                )

        if raw_amount in ("", None):
            continue
        try:
            amount = parse_decimal_cell(raw_amount)
        except (InvalidOperation, ValueError):
            errors.append(
                ParseError(
                    source_line=source_line,
                    field_name="valor (R$)",
                    raw_value=str(raw_amount),
                    error_code="invalid_amount",
                    message="Invalid transaction amount",
                )
            )
            continue

        normalized_description = normalize_transaction_description(raw_description)
        if section == "future":
            calendar_events.append(
                ParsedCalendarEvent(
                    title=normalized_description or raw_description,
                    event_type=_calendar_event_type(normalized_description, amount),
                    amount=abs(amount),
                    due_date=transaction_date,
                    source_line=source_line,
                    raw_payload=_excel_raw_payload(row_values),
                )
            )
            continue

        direction = TransactionDirection.CREDIT if amount >= 0 else TransactionDirection.DEBIT
        if is_credit_card_payment_description(normalized_description):
            direction = TransactionDirection.PAYMENT
        transactions.append(
            ParsedTransaction(
                transaction_date=transaction_date,
                raw_description=raw_description,
                description=normalized_description,
                amount=amount,
                direction=direction,
                source_line=source_line,
            )
        )

    return ParseResult(
        source_kind=SourceKind.BANK_STATEMENT_EXCEL,
        total_rows=total_rows,
        transactions=transactions,
        account_balances=balances,
        calendar_events=calendar_events,
        errors=errors,
    )


def _excel_account_name(sheet: object) -> str:
    account = ""
    for row_index in range(min(getattr(sheet, "nrows", 0), 12)):
        label = _normalize_header(_cell_text(sheet.cell_value(row_index, 0)))
        if label == "conta" and sheet.ncols > 1:
            account = _cell_text(sheet.cell_value(row_index, 1))
            break
    return f"Itau {account}" if account else "Conta corrente"


def _excel_statement_columns(sheet: object) -> tuple[int | None, dict[str, int]]:
    for row_index in range(min(getattr(sheet, "nrows", 0), 30)):
        headers = [
            _normalize_header(_cell_text(sheet.cell_value(row_index, column)))
            for column in range(sheet.ncols)
        ]
        if "data" not in headers or not any(header.startswith("lancamento") for header in headers):
            continue
        columns = {
            "date": headers.index("data"),
            "description": next(
                index for index, header in enumerate(headers) if header.startswith("lancamento")
            ),
            "amount": next(
                (index for index, header in enumerate(headers) if header.startswith("valor")),
                -1,
            ),
            "balance": next(
                (index for index, header in enumerate(headers) if header.startswith("saldos")),
                -1,
            ),
        }
        if columns["amount"] >= 0 and columns["balance"] >= 0:
            return row_index, columns
    return None, {}


def _parse_excel_date(raw_value: object, datemode: int) -> date:
    try:
        import xlrd
    except ImportError as exc:
        raise ValueError from exc
    if isinstance(raw_value, int | float):
        return xlrd.xldate_as_datetime(raw_value, datemode).date()
    text = _cell_text(raw_value)
    for date_format in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    raise ValueError


def _excel_raw_payload(row_values: list[object]) -> dict[str, object]:
    return {
        str(index): _cell_text(value) if not isinstance(value, int | float) else value
        for index, value in enumerate(row_values)
    }


def _excel_section_marker(raw_date: object, raw_description: str) -> str | None:
    marker = _normalize_header(raw_description) or _normalize_header(_cell_text(raw_date))
    if marker in {"lancamentos", "lancamento"}:
        return "actual"
    if marker in {"lancamentos futuros", "saidas futuras", "entradas futuras"}:
        return "future"
    return None


def _calendar_event_type(description: str, amount: Decimal) -> str:
    if amount < 0 and is_credit_card_payment_description(description):
        return "card_payment"
    return "income" if amount >= 0 else "expense"


def _cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _normalize_header(value: str) -> str:
    ascii_value = "".join(
        char for char in normalize("NFKD", value.lower()) if char.encode("ascii", "ignore") != b""
    )
    return re.sub(r"[^a-z0-9]+", " ", ascii_value).strip()


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


# A transaction segment in an Itaú credit-card statement PDF (layout extraction):
#   "25/03 99APP *99App 28,06"  or  "01/03 ESPACO FISICO 05/12 130,77"
# Older statements print TWO columns of transactions per visual row, so we scan EVERY
# segment in a line (finditer), not just one at the start. The amount is the first
# Brazilian decimal after the merchant (non-greedy); a merchant may embed an N/M
# installment. The trailing lookahead keeps the amount from eating an adjacent column.
_ITAU_PDF_TX_RE = re.compile(
    r"(?P<day>\d{2})/(?P<month>\d{2})\s+"
    r"(?P<desc>.+?)\s+"
    r"(?P<neg>-\s*)?(?P<amount>\d{1,3}(?:\.\d{3})*,\d{2})(?P<trail>-)?"
    r"(?=\s|$)"
)
_ITAU_PDF_LINE_START_RE = re.compile(r"\d{2}/\d{2}\s")
# In two-column layout mode, a right-column transaction may appear on the same
# rendered line as left-column category text
# (e.g. "DIVERSOS .Sao Paulo   05/07 PAYPAL *CWP   1.269,02").
# The column gutter is ≥10 spaces; we extract the right segment separately.
_ITAU_PDF_RIGHT_COL_SEP_RE = re.compile(r"\s{10,}(?=\d{2}/\d{2}\s)")
_ITAU_PDF_DUE_RE = re.compile(r"[Vv]encimento:?\s*(\d{2})/(\d{2})/(\d{4})")
# International IOF is charged on the invoice but carries no transaction date.
_ITAU_PDF_IOF_RE = re.compile(
    r"Repasse de IOF em R\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})", re.IGNORECASE
)
# Primary card number on the statement, e.g. "5312.XXXX.XXXX.7164" or "4771.XXXX.XXXX.9163".
# Product tier (VISA INFINITE, MASTERCARD BLACK…) may appear on the same line or the next.
_ITAU_PDF_CARD_RE = re.compile(
    r"(?P<bin>\d)\d{3}\.[X*]{4}\.[X*]{4}\.(?P<last4>\d{4})(?P<product>[^\n]{0,40})"
)
_ITAU_PDF_CLOSING_RE = re.compile(r"Fechamento:?\s*(\d{2})/(\d{2})/(\d{4})", re.IGNORECASE)


def _itau_closing_match(text: str) -> re.Match[str] | None:
    """This invoice's closing date — skipping "Previsão próx. Fechamento" (the NEXT
    cycle's predicted closing), which would otherwise land after the due date."""
    for match in _ITAU_PDF_CLOSING_RE.finditer(text):
        prefix = text[max(0, match.start() - 25):match.start()].lower()
        if any(token in prefix for token in ("previs", "prox", "próx")):
            continue
        return match
    return None

# Credit limit line: value may be on the same line (layout mode) or the next line (plain mode).
_ITAU_PDF_LIMIT_RE = re.compile(
    r"Limite (?:total de )?cr[eé]dito[\s\n\r]+(\d{1,3}(?:\.\d{3})*,\d{2})",
    re.IGNORECASE,
)
_ITAU_CARD_BRANDS = {"3": "amex", "4": "visa", "5": "mastercard", "6": "elo"}
_ITAU_CARD_TIERS = (
    "INFINITE", "PLATINUM", "GOLD", "BLACK", "NANQUIM", "PERSONNALITE", "GRAFITE",
    "INTERNACIONAL", "STANDARD",
)


def extract_itau_card_metadata(text: str) -> ParsedCreditCard | None:
    """Identify the statement's primary card from the PDF itself (never the file
    name): last four digits and brand from the masked card number, an optional
    product tier as the name (same line or next line), closing/due days and
    credit limit when present as a numeric value."""
    card = _ITAU_PDF_CARD_RE.search(text)
    if card is None:
        return None
    last_four = card.group("last4")
    brand = _ITAU_CARD_BRANDS.get(card.group("bin"))
    # Product tier may be on the same line or on the very next line (newer layout).
    product = card.group("product").strip()
    if not product:
        after_card = text[card.end():]
        m = re.match(r"[^\n]*\n[ \t]*(.*)", after_card)
        next_line = m.group(1).strip() if m else ""
        if next_line and any(tier in next_line.upper() for tier in _ITAU_CARD_TIERS):
            product = next_line
    if product and any(tier in product.upper() for tier in _ITAU_CARD_TIERS):
        name = " ".join(product.split()).title()
    else:
        name = f"{(brand or 'Cartão').title()} final {last_four}"
    due = _ITAU_PDF_DUE_RE.search(text)
    # The closing DAY can come from any "Fechamento" line (incl. "Previsão próx.
    # Fechamento", which still reveals the card's closing day). The closing DATE,
    # however, must be THIS invoice's — never the predicted next cycle's — otherwise
    # it lands after the due date.
    closing_day_any = _ITAU_PDF_CLOSING_RE.search(text)
    closing = _itau_closing_match(text)
    total = _ITAU_PDF_TOTAL_RE.search(text)
    limit = _ITAU_PDF_LIMIT_RE.search(text)
    due_date = date(int(due.group(3)), int(due.group(2)), int(due.group(1))) if due else None
    closing_date = (
        date(int(closing.group(3)), int(closing.group(2)), int(closing.group(1)))
        if closing
        else None
    )
    closing_day = (
        closing_date.day if closing_date
        else (int(closing_day_any.group(1)) if closing_day_any else None)
    )
    limit_amount = parse_brazilian_decimal(limit.group(1)) if limit else None
    # Personnalité layout: the credit-limit value sits in the header summary box and
    # its "Limite total de crédito" label is rotated text pypdf cannot read. In the
    # linear extraction the value follows the due date (e.g. "20/04/2026 R$155.480,00").
    if limit_amount is None and due is not None:
        due_str = f"{due.group(1)}/{due.group(2)}/{due.group(3)}"
        box = re.search(
            re.escape(due_str) + r"\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})", text
        )
        if box:
            limit_amount = parse_brazilian_decimal(box.group(1))
    return ParsedCreditCard(
        last_four=last_four,
        brand=brand,
        name=name,
        closing_day=closing_day,
        due_day=due_date.day if due_date else None,
        closing_date=closing_date,
        due_date=due_date,
        statement_total=parse_brazilian_decimal(total.group(1)) if total else None,
        limit_amount=limit_amount,
    )
_ITAU_PDF_TOTAL_RE = re.compile(
    r"Total desta fatura\D*?(\d{1,3}(?:\.\d{3})*,\d{2})", re.IGNORECASE
)

def _itau_pdf_reference_month_year(text: str) -> tuple[int, int]:
    """The statement due date anchors the year for transactions that only carry
    day/month. Falls back to today if the due date can't be found."""
    match = _ITAU_PDF_DUE_RE.search(text)
    if match:
        return int(match.group(2)), int(match.group(3))
    today = date.today()
    return today.month, today.year


def _subtract_months(year: int, month: int, count: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) - count
    return total // 12, total % 12 + 1


def parse_itau_credit_card_statement_text(text: str) -> ParseResult:
    """Parse the extracted text of an Itaú credit-card statement into transactions.

    Itaú digital invoices are text PDFs (no OCR needed). Statements may print two
    columns of transactions per line, so we scan every ``DD/MM <merchant> <amount>``
    segment. The displayed date carries only day/month; the year is inferred from the
    statement due date, going back ``installment_current - 1`` months for installments
    (an 11/12 charge was purchased ~10 months earlier). A non-blocking reconciliation
    note is emitted when the imported sum doesn't match the statement total.
    """
    ref_month, ref_year = _itau_pdf_reference_month_year(text)
    transactions: list[ParsedTransaction] = []
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        # Build segments to scan. Lines starting with DD/MM are scanned in full
        # (finditer handles both left and right columns). Lines where the left
        # column holds category/section text instead of a date are skipped by the
        # match filter, but may carry a right-column transaction after a large
        # whitespace gutter — extract that segment separately.
        if _ITAU_PDF_LINE_START_RE.match(line):
            segments: list[str] = [line]
        else:
            col_sep = _ITAU_PDF_RIGHT_COL_SEP_RE.search(raw_line)
            if not col_sep:
                continue
            segments = [raw_line[col_sep.end():].strip()]

        for segment in segments:
            for match in _ITAU_PDF_TX_RE.finditer(segment):
                day = int(match.group("day"))
                month = int(match.group("month"))
                if not (1 <= month <= 12 and 1 <= day <= 31):
                    continue
                raw_description = match.group("desc").strip()
                if not raw_description:
                    continue
                amount = parse_brazilian_decimal(match.group("amount"))
                is_negative = bool(match.group("neg") or match.group("trail"))

                installment_current, installment_total = extract_installment(raw_description)
                # The purchase happened (installment_current - 1) months before this
                # statement; anchor the year there, then choose the year whose <month>
                # sits at/just-before that reference month.
                back = installment_current - 1 if installment_current else 0
                base_year, base_month = _subtract_months(ref_year, ref_month, back)
                year = base_year if month <= base_month else base_year - 1
                try:
                    transaction_date = date(year, month, day)
                except ValueError:
                    continue
                normalized_description = normalize_transaction_description(
                    raw_description, transaction_date
                )

                if is_negative and normalized_description == "PAGAMENTO EFETUADO":
                    direction = TransactionDirection.PAYMENT
                elif is_negative:
                    direction = TransactionDirection.CREDIT
                else:
                    direction = TransactionDirection.DEBIT

                transactions.append(
                    ParsedTransaction(
                        transaction_date=transaction_date,
                        raw_description=raw_description,
                        description=normalized_description,
                        amount=amount,  # always positive; direction encodes sign
                        direction=direction,
                        source_line=line_number,
                        installment_current=installment_current,
                        installment_total=installment_total,
                    )
                )

    iof = _itau_pdf_iof_charge(text)
    if iof is not None:
        transactions.append(iof)
    transactions = _drop_future_installment_previews(transactions)
    errors = _itau_pdf_total_reconciliation(text, transactions)
    return ParseResult(
        source_kind=SourceKind.CREDIT_CARD_PDF,
        total_rows=len(transactions),
        transactions=transactions,
        errors=errors,
        credit_card=extract_itau_card_metadata(text),
    )


def _itau_pdf_iof_charge(text: str) -> ParsedTransaction | None:
    """The international IOF is charged on the invoice but has no transaction line.
    It belongs to the invoice, so date it at the invoice's CLOSING — grouping it with
    the cycle's purchases. Priority: this invoice's real closing date → an estimate
    from the closing DAY in the due month → the due date as last resort."""
    from calendar import monthrange

    iof_match = _ITAU_PDF_IOF_RE.search(text)
    closing_match = _itau_closing_match(text)
    closing_any = _ITAU_PDF_CLOSING_RE.search(text)
    due_match = _ITAU_PDF_DUE_RE.search(text)
    if not iof_match or not (closing_match or due_match):
        return None
    amount = parse_brazilian_decimal(iof_match.group(1))
    if amount <= 0:
        return None
    if closing_match:
        charge_date = date(
            int(closing_match.group(3)), int(closing_match.group(2)), int(closing_match.group(1))
        )
    elif due_match and closing_any:
        # No explicit closing date for this invoice — estimate it from the closing DAY:
        # if the closing day is on/before the due day it closed in the due month,
        # otherwise in the previous month.
        due_date = date(int(due_match.group(3)), int(due_match.group(2)), int(due_match.group(1)))
        closing_day = int(closing_any.group(1))
        year, month = (
            (due_date.year, due_date.month)
            if closing_day <= due_date.day
            else _subtract_months(due_date.year, due_date.month, 1)
        )
        charge_date = date(year, month, min(closing_day, monthrange(year, month)[1]))
    else:
        anchor = due_match
        charge_date = date(int(anchor.group(3)), int(anchor.group(2)), int(anchor.group(1)))
    return ParsedTransaction(
        transaction_date=charge_date,
        raw_description="REPASSE DE IOF",
        description="IOF",
        amount=amount,
        direction=TransactionDirection.DEBIT,
        source_line=0,
    )


def _drop_future_installment_previews(
    transactions: list[ParsedTransaction],
) -> list[ParsedTransaction]:
    """Older statement layouts preview upcoming installments inline (e.g. show both
    12/18 and 13/18 of a purchase). Only the current — lowest — installment is
    charged now, so drop the higher-numbered previews per purchase.

    Note: we intentionally keep duplicate *current* installments. The same value can
    be a legitimate separate charge on a different card (e.g. two tuitions of equal
    amount), so merging by value would drop a real charge — only entries of the same
    purchase with a HIGHER installment number are dropped."""
    # Key on the merchant identity with the installment marker removed, so previews
    # of the same purchase group together even when the installment digits are glued
    # to a merchant code (e.g. "PAO DE ACUCAR-129202/11" vs "...03/11").
    def purchase_key(t: ParsedTransaction) -> tuple:
        return (_strip_installment_marker(t.raw_description), t.amount, t.installment_total)

    min_current: dict[tuple, int] = {}
    for t in transactions:
        if t.installment_current and t.installment_total:
            key = purchase_key(t)
            current = min_current.get(key)
            if current is None or t.installment_current < current:
                min_current[key] = t.installment_current

    kept: list[ParsedTransaction] = []
    for t in transactions:
        if t.installment_current and t.installment_total:
            if t.installment_current != min_current[purchase_key(t)]:
                continue
        kept.append(t)
    return kept


def _strip_installment_marker(raw_description: str) -> str:
    """ASCII-upper merchant identity with a trailing installment marker removed
    ("PARC NN" or "NN/MM", even when glued to a merchant code), for grouping the
    installments of one purchase regardless of the parcel number in the text."""
    ascii_up = "".join(
        char for char in normalize("NFKD", raw_description) if char.encode("ascii", "ignore") != b""
    ).upper()
    stripped = re.sub(r"\s*PARC\s*\d{1,3}\s*$", "", ascii_up)
    stripped = re.sub(r"\d{1,2}\s*/\s*\d{1,2}\s*$", "", stripped)
    return " ".join(stripped.split())


def _itau_pdf_total_reconciliation(
    text: str, transactions: list[ParsedTransaction]
) -> list[ParseError]:
    """Compare the sum of imported charges with the statement total. Returns a
    non-blocking warning when they differ (e.g. uncaptured IOF or missed lines)."""
    match = _ITAU_PDF_TOTAL_RE.search(text)
    if not match:
        return []
    statement_total = parse_brazilian_decimal(match.group(1))
    imported = sum(
        (t.amount if t.direction == TransactionDirection.DEBIT else -t.amount
         for t in transactions if t.direction != TransactionDirection.PAYMENT),
        Decimal("0"),
    )
    # Tolerate cent-level rounding; flag only meaningful gaps (missed transactions).
    if abs(imported - statement_total) <= Decimal("1.00"):
        return []
    return [
        ParseError(
            error_code="statement_total_mismatch",
            message=(
                f"Total da fatura R$ {statement_total} difere da soma importada "
                f"R$ {imported} (diferenca R$ {statement_total - imported})."
            ),
        )
    ]


def parse_itau_credit_card_pdf(content: bytes) -> ParseResult:
    """Extract text from an Itaú credit-card statement PDF and parse its transactions.

    Itaú changed the statement layout over the years: newer ones extract cleanly in
    pypdf's default ("plain") mode, while older ones only line up date/merchant/amount
    in "layout" mode. We try both and keep whichever yields more transactions.
    """
    from io import BytesIO

    try:
        from pypdf import PdfReader

        pages = list(PdfReader(BytesIO(content)).pages)
    except Exception as exc:  # noqa: BLE001 - surface a parse error instead of crashing
        return ParseResult(
            source_kind=SourceKind.CREDIT_CARD_PDF,
            total_rows=0,
            errors=[ParseError(error_code="invalid_pdf", message=f"Could not read PDF: {exc}")],
        )

    best: ParseResult | None = None
    for mode in ("plain", "layout"):
        try:
            text = "\n".join((page.extract_text(extraction_mode=mode) or "") for page in pages)
        except Exception:  # noqa: BLE001 - a mode may be unsupported; try the other
            continue
        result = parse_itau_credit_card_statement_text(text)
        if best is None or len(result.transactions) > len(best.transactions):
            best = result
    if best is None:
        return ParseResult(
            source_kind=SourceKind.CREDIT_CARD_PDF,
            total_rows=0,
            errors=[ParseError(error_code="invalid_pdf", message="Could not extract PDF text")],
        )
    return best
