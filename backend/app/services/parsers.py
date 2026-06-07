import csv
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from unicodedata import normalize

from app.domain.imports import (
    ParsedAccountBalance,
    ParsedCalendarEvent,
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
    "UBERBR": ("UBER",),
    "UBERBRASIL": ("UBER",),
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
    ("PAYPAL", "UB"): ("PAYPAL", "UBER"),
}

SEQUENCE_TOKEN_ALIASES = {
    ("99", "APP"): ("99APP",),
    ("99", "FOOD"): ("99FOOD",),
    ("99", "TAXI"): ("99TAXI",),
    ("AD", "FREE", "FOR", "PRIM"): ("AD", "FREE", "FOR", "PRIME"),
    ("GOOGLE", "YOUTUB"): ("GOOGLE", "YOUTUBE"),
    ("SHELL", "BOX"): ("SHELLBOX",),
    ("UBER", "DO", "BRASI"): ("UBER",),
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
PAYMENT_METHOD_PREFIXES = {
    "PIX", "TED", "DOC", "DEB",
    "PAG", "PGTO", "PAGTO",
    "TRANSF", "TRANSFERENCIA",
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


def normalize_transaction_description(raw_description: str) -> str:
    base = _normalize_transaction_description(raw_description, drop_installment=True)
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


def _normalize_transaction_description(raw_description: str, *, drop_installment: bool) -> str:
    ascii_description = "".join(
        char
        for char in normalize("NFKD", raw_description)
        if char.encode("ascii", "ignore") != b""
    ).upper().strip()
    if drop_installment:
        ascii_description = _drop_trailing_installment_suffix(ascii_description)

    cleaned = re.sub(r"[*_/\\|,.;:]+", " ", ascii_description)
    # split on letter↔digit boundary so "OSVALDO04" becomes "OSVALDO 04"
    cleaned = re.sub(r"(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])", " ", cleaned)
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
    normalized_tokens = _drop_payment_method_prefix(normalized_tokens)
    normalized_tokens = _drop_geo_suffix(normalized_tokens)
    normalized_tokens = _drop_com_suffix(normalized_tokens)
    normalized_tokens = _drop_trailing_pos_code(normalized_tokens)
    return " ".join(_collapse_repeated_sequences(normalized_tokens))


def _drop_payment_method_prefix(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    result = list(tokens)
    while result and result[0] in PAYMENT_METHOD_PREFIXES:
        # Preserve prefix when what remains is only a titulo/boleto token — it adds context
        rest = result[1:]
        if rest and rest[0] in _TITULO_TOKENS:
            break
        result = rest
    return result if result else tokens


def _drop_geo_suffix(tokens: list[str]) -> list[str]:
    if not tokens:
        return tokens
    result = list(tokens)
    # Remove up to 2 trailing geo tokens
    for _ in range(2):
        if result and result[-1] in GEO_SUFFIX_TOKENS:
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
