from datetime import date
from decimal import Decimal, InvalidOperation

import pytest

from app.domain.imports import SourceKind, TransactionDirection
from app.services.parsers import (
    extract_installment,
    normalize_transaction_description,
    normalize_transaction_description_for_dedupe,
    parse_brazilian_decimal,
    parse_credit_card_csv,
    parse_excel_bank_statement,
    parse_itau_credit_card_statement_text,
    parse_txt_bank_statement,
)


def test_parse_itau_credit_card_statement_text():
    text = "\n".join(
        [
            "Vencimento: 01/05/2026",
            "25/03 99APP *99App 28,06",
            "26/04 Clinica 12/18 355,65",
            "20/12 LOJA DE NATAL 100,00",  # month after due month -> previous year
            # older layout: trailing Itaú category column after the amount + N/M installment
            "01/03 ESPACO FISICO 05/12 130,77 DIVERSOS .Sao Paulo",
            # the FIRST decimal is the amount, not the trailing limit value
            "02/04 99APP 21,00 Limite disponivel 18.384,31",
            "Total desta fatura 775,69",  # not a DD/MM line -> skipped
            "Limite total de credito",
        ]
    )

    result = parse_itau_credit_card_statement_text(text)

    assert result.source_kind == SourceKind.CREDIT_CARD_PDF
    txs = result.transactions
    assert len(txs) == 5
    assert txs[0].transaction_date == date(2026, 3, 25)
    assert txs[0].amount == Decimal("28.06")
    assert txs[0].direction == TransactionDirection.DEBIT
    assert (txs[1].installment_current, txs[1].installment_total) == (12, 18)
    assert txs[2].transaction_date == date(2025, 12, 20)
    older = next(t for t in txs if t.amount == Decimal("130.77"))
    assert (older.installment_current, older.installment_total) == (5, 12)
    assert any(t.amount == Decimal("21.00") for t in txs)  # not the trailing 18.384,31


class FakeExcelSheet:
    name = "Lançamentos"

    def __init__(self) -> None:
        self.rows = [
            ["Logotipo Itaú", "", "", "", ""],
            ["Atualização:", "01/06/2026 às 08:36:25", "", "", ""],
            ["Nome:", "ADRIANO", "", "", ""],
            ["Agência:", 7348.0, "", "", ""],
            ["Conta:", "00740-7", "", "", ""],
            ["", "", "", "", ""],
            ["Lançamentos", "", "", "", ""],
            ["", "", "", "", ""],
            ["data", "lançamento", "ag./origem", "valor (R$)", "saldos (R$)"],
            ["lançamentos", "", "", "", ""],
            ["31/12/2025", "SALDO ANTERIOR", "", "", 40354.41],
            ["02/01/2026", "PIX TRANSF  ANTHONY01/01", "", 70.0, ""],
            ["02/01/2026", "ITAU BLACK  3102-2224", "", -872.19, ""],
            ["02/01/2026", "SALDO TOTAL DISPONÍVEL DIA", "", "", 37077.88],
            ["Lançamentos futuros", "", "", "", ""],
            ["05/01/2026", "TED AGENDADA", "", -120.0, ""],
            ["06/01/2026", "SALARIO FUTURO", "", 1000.0, ""],
        ]
        self.nrows = len(self.rows)
        self.ncols = 5

    def cell_value(self, row: int, column: int) -> object:
        return self.rows[row][column]


class FakeExcelBook:
    datemode = 0

    def __init__(self) -> None:
        self.sheet = FakeExcelSheet()

    def sheet_names(self) -> list[str]:
        return ["Lançamentos"]

    def sheet_by_name(self, _name: str) -> FakeExcelSheet:
        return self.sheet

    def sheet_by_index(self, _index: int) -> FakeExcelSheet:
        return self.sheet


def test_parse_txt_bank_statement_valid_line() -> None:
    result = parse_txt_bank_statement("01/07/2025;PIX TRANSF DANIELL01/07;-10,00")

    assert result.total_rows == 1
    assert len(result.transactions) == 1
    assert result.transactions[0].amount == Decimal("-10.00")
    assert result.transactions[0].direction == TransactionDirection.DEBIT
    assert result.errors == []


def test_parse_txt_bank_statement_credit_card_payment_is_payment() -> None:
    result = parse_txt_bank_statement("03/05/2026;PAGAMENTO FATURA;-800,00")

    assert result.errors == []
    assert result.transactions[0].amount == Decimal("-800.00")
    assert result.transactions[0].direction == TransactionDirection.PAYMENT


def test_parse_txt_bank_statement_moves_balance_markers_to_account_balances() -> None:
    result = parse_txt_bank_statement(
        "31/01/2014;SALDO FINAL;3.885,22\n"
        "23/09/2013;SALDO PARCIAL;5.281,40\n"
        "05/09/2011;TRANSFERENCIA SALDO;-751,41"
    )

    assert result.errors == []
    assert [transaction.description for transaction in result.transactions] == [
        "TRANSFERENCIA SALDO"
    ]
    assert len(result.account_balances) == 2
    assert result.account_balances[0].balance_date.isoformat() == "2014-01-31"
    assert result.account_balances[0].balance_amount == Decimal("3885.22")
    assert result.account_balances[1].balance_date.isoformat() == "2013-09-23"
    assert result.account_balances[1].balance_amount == Decimal("5281.40")


def test_parse_txt_bank_statement_does_not_extract_pix_date_as_installment() -> None:
    result = parse_txt_bank_statement("01/04/2026;PIX TRANSF FLAVIA 01/04;-100,00")

    assert result.errors == []
    assert result.transactions[0].description == "PIX TRANSF FLAVIA"
    assert result.transactions[0].raw_description == "PIX TRANSF FLAVIA 01/04"
    assert result.transactions[0].installment_current is None
    assert result.transactions[0].installment_total is None


def test_parse_txt_bank_statement_invalid_column_count() -> None:
    result = parse_txt_bank_statement("01/07/2025;PIX TRANSF")

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].error_code == "invalid_column_count"


def test_parse_txt_bank_statement_invalid_date() -> None:
    result = parse_txt_bank_statement("31/02/2025;PIX TRANSF DANIELL01/07;-10,00")

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].field_name == "date"
    assert result.errors[0].raw_value == "31/02/2025"
    assert result.errors[0].error_code == "invalid_date"


def test_parse_txt_bank_statement_invalid_amount() -> None:
    result = parse_txt_bank_statement("01/07/2025;PIX TRANSF DANIELL01/07;dez reais")

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].field_name == "amount"
    assert result.errors[0].raw_value == "dez reais"
    assert result.errors[0].error_code == "invalid_amount"


def test_parse_txt_bank_statement_preserves_accented_description() -> None:
    result = parse_txt_bank_statement("01/07/2025;TRANSFERÊNCIA  JOÃO AÇÃO;-1.234,56")

    assert result.errors == []
    assert result.transactions[0].raw_description == "TRANSFERÊNCIA  JOÃO AÇÃO"
    assert result.transactions[0].description == "TRANSFERENCIA JOAO ACAO"
    assert result.transactions[0].amount == Decimal("-1234.56")


def test_parse_excel_bank_statement_extracts_transactions_and_daily_balances(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import xlrd

    monkeypatch.setattr(xlrd, "open_workbook", lambda **_kwargs: FakeExcelBook())

    result = parse_excel_bank_statement(b"fake-xls")

    assert result.source_kind == "bank_statement_excel"
    assert result.total_rows == 6
    assert len(result.transactions) == 2
    assert result.transactions[0].description == "PIX TRANSF ANTHONY"
    assert result.transactions[0].amount == Decimal("70.0")
    assert result.transactions[0].direction == TransactionDirection.CREDIT
    assert result.transactions[1].description == "ITAU BLACK 3102-2224"
    assert result.transactions[1].direction == TransactionDirection.DEBIT
    assert len(result.account_balances) == 2
    assert result.account_balances[-1].account_name == "Itau 00740-7"
    assert result.account_balances[-1].balance_date.isoformat() == "2026-01-02"
    assert result.account_balances[-1].balance_amount == Decimal("37077.88")
    assert len(result.calendar_events) == 2
    assert result.calendar_events[0].title == "TED AGENDADA"
    assert result.calendar_events[0].event_type == "expense"
    assert result.calendar_events[0].amount == Decimal("120.0")
    assert result.calendar_events[0].due_date.isoformat() == "2026-01-05"
    assert result.calendar_events[1].title == "SALARIO FUTURO"
    assert result.calendar_events[1].event_type == "income"
    assert result.calendar_events[1].amount == Decimal("1000.0")


def test_parse_brazilian_decimal_rejects_non_finite_values() -> None:
    with pytest.raises(InvalidOperation):
        parse_brazilian_decimal("NaN")


def test_parse_credit_card_csv_valid_rows() -> None:
    content = "\n".join(
        [
            "data,lançamento,valor",
            "2026-05-08,99APP       *99App,26.06",
            "2026-05-01,PAGAMENTO EFETUADO,-775.69",
        ]
    )

    result = parse_credit_card_csv(content)

    assert result.total_rows == 2
    assert len(result.transactions) == 2
    assert result.transactions[0].amount == Decimal("26.06")
    assert result.transactions[0].direction == TransactionDirection.DEBIT
    assert result.transactions[1].direction == TransactionDirection.PAYMENT


def test_parse_credit_card_csv_negative_non_payment_is_credit() -> None:
    content = "\n".join(
        [
            "data,lançamento,valor",
            "2026-05-08,ESTORNO COMPRA,-26.06",
        ]
    )

    result = parse_credit_card_csv(content)

    assert result.errors == []
    assert result.transactions[0].amount == Decimal("-26.06")
    assert result.transactions[0].direction == TransactionDirection.CREDIT


def test_parse_credit_card_csv_invalid_header() -> None:
    result = parse_credit_card_csv("date,description,amount\n2026-05-08,Uber,26.06")

    assert result.total_rows == 0
    assert result.transactions == []
    assert result.errors[0].error_code == "invalid_csv_header"


def test_parse_credit_card_csv_invalid_date() -> None:
    content = "data,lançamento,valor\n2026-13-08,99APP       *99App,26.06"

    result = parse_credit_card_csv(content)

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].source_line == 2
    assert result.errors[0].field_name == "data"
    assert result.errors[0].raw_value == "2026-13-08"
    assert result.errors[0].error_code == "invalid_date"


def test_parse_credit_card_csv_invalid_amount() -> None:
    content = "data,lançamento,valor\n2026-05-08,99APP       *99App,valor invalido"

    result = parse_credit_card_csv(content)

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].source_line == 2
    assert result.errors[0].field_name == "valor"
    assert result.errors[0].raw_value == "valor invalido"
    assert result.errors[0].error_code == "invalid_amount"


def test_parse_credit_card_csv_non_finite_amount() -> None:
    content = "data,lançamento,valor\n2026-05-08,99APP       *99App,NaN"

    result = parse_credit_card_csv(content)

    assert result.total_rows == 1
    assert result.transactions == []
    assert result.errors[0].source_line == 2
    assert result.errors[0].field_name == "valor"
    assert result.errors[0].raw_value == "NaN"
    assert result.errors[0].error_code == "invalid_amount"


def test_parse_credit_card_csv_preserves_accented_description() -> None:
    content = "data,lançamento,valor\n2026-05-08,PADARIA SÃO JOSÉ   CAFÉ,26.06"

    result = parse_credit_card_csv(content)

    assert result.errors == []
    assert result.transactions[0].raw_description == "PADARIA SÃO JOSÉ   CAFÉ"
    assert result.transactions[0].description == "PADARIA SAO JOSE CAFE"
    assert result.transactions[0].direction == TransactionDirection.DEBIT


def test_normalize_transaction_description_cleans_card_decorations() -> None:
    assert normalize_transaction_description("99APP       *99App") == "99APP"


def test_normalize_transaction_description_removes_long_numeric_reference_tokens() -> None:
    assert normalize_transaction_description("BKI PM SAO PAU 626400399") == "BKI PM SAO PAU"
    assert (
        normalize_transaction_description("PAYPAL * MERCADO LIVRE 4029357733")
        == "PAYPAL MERCADO LIVRE"
    )
    assert normalize_transaction_description("UBER * TRIP 123456") == "UBER TRIP"


def test_normalize_transaction_description_preserves_semantic_channel_and_merchant() -> None:
    assert (
        normalize_transaction_description("MERCADOLIVRE*LOJA EXEMPLO")
        == "MERCADO LIVRE LOJA EXEMPLO"
    )
    assert normalize_transaction_description("MERCADOLIVRE*EPILHAS") == "MERCADO LIVRE EPILHAS"
    assert (
        normalize_transaction_description("99FOOD*RESTAURANTE EXEMPLO")
        == "99FOOD RESTAURANTE EXEMPLO"
    )
    assert normalize_transaction_description("SHELL*POSTO EXEMPLO") == "SHELL POSTO EXEMPLO"
    assert normalize_transaction_description("SHOPEE*LOJA EXEMPLO") == "SHOPEE LOJA EXEMPLO"
    assert normalize_transaction_description("AMAZONMKTPLC*LOJA EXEMPLO") == "AMAZON LOJA EXEMPLO"


def test_normalize_transaction_description_keeps_marketplace_complement() -> None:
    assert normalize_transaction_description("MERCADOLIVRE*EPILHAS") == "MERCADO LIVRE EPILHAS"
    assert (
        normalize_transaction_description("MERCADOLIVRE*MERCADO LIVRE EPILHAS")
        == "MERCADO LIVRE EPILHAS"
    )
    assert normalize_transaction_description("MERCADO LIVRE*EPILHAS") == "MERCADO LIVRE EPILHAS"
    assert (
        normalize_transaction_description("PAYPAL*MERCADOLIVRE*EPILHAS")
        == "PAYPAL MERCADO LIVRE EPILHAS"
    )


def test_normalize_transaction_description_collapses_repeated_alias_sequences() -> None:
    assert (
        normalize_transaction_description("MERCADOLIVRE*MERCADO LIVRE LOJA")
        == "MERCADO LIVRE LOJA"
    )
    assert normalize_transaction_description("MERCADOLIVRE*MERCADOLIV") == "MERCADO LIVRE"
    assert normalize_transaction_description("MERCADOLIVRE*MERCADOLI") == "MERCADO LIVRE"
    assert normalize_transaction_description("99FOOD*99Food RESTAURANTE") == "99FOOD RESTAURANTE"


def test_normalize_transaction_description_expands_safe_99_channel_sequences() -> None:
    assert normalize_transaction_description("99 FOOD*ESFIHA IMIGRANT") == "99FOOD ESFIHA IMIGRANT"
    assert normalize_transaction_description("99 FOOD 99FOOD ESFIHA") == "99FOOD ESFIHA"
    assert normalize_transaction_description("99 APP * 99APP") == "99APP"
    assert normalize_transaction_description("99") == "99"


def test_normalize_transaction_description_expands_contextual_payment_aliases() -> None:
    assert normalize_transaction_description("PAYPAL*PAYPAL *SH") == "PAYPAL SHELLBOX"
    assert normalize_transaction_description("PAYPAL*PAYPAL *UB") == "PAYPAL UBER BR"
    assert normalize_transaction_description("PAYPAL*PAYPAL *AB") == "PAYPAL ABASTECE AI"
    assert normalize_transaction_description("LOJA *SH") == "LOJA SH"


def test_normalize_transaction_description_expands_safe_payment_and_mobility_aliases() -> None:
    assert normalize_transaction_description("MP*LOJA EXEMPLO") == "MERCADO PAGO LOJA EXEMPLO"
    assert normalize_transaction_description("MP RONALDODESOUZ") == "MERCADO PAGO RONALDODESOUZ"
    assert normalize_transaction_description("MP*RONALDODESOUZ") == "MERCADO PAGO RONALDODESOUZ"
    assert normalize_transaction_description("MP") == "MP"
    assert normalize_transaction_description("SHELL BOX*POSTO EXEMPLO") == "SHELLBOX POSTO EXEMPLO"
    assert normalize_transaction_description("SHELLBOX*POSTO EXEMPLO") == "SHELLBOX POSTO EXEMPLO"
    assert normalize_transaction_description("UBERBR*TRIP") == "UBER BR TRIP"
    assert normalize_transaction_description("UBERBRASIL*TRIP") == "UBER BR TRIP"


def test_normalize_transaction_description_preserves_fuel_and_mobility_context() -> None:
    assert normalize_transaction_description("SHELL*POSTO EXEMPLO") == "SHELL POSTO EXEMPLO"
    assert normalize_transaction_description("SHELL BOX*POSTO EXEMPLO") == "SHELLBOX POSTO EXEMPLO"
    assert normalize_transaction_description("SHELLBOX*POSTO EXEMPLO") == "SHELLBOX POSTO EXEMPLO"
    assert normalize_transaction_description("UBER * TRIP 123456") == "UBER TRIP"
    assert normalize_transaction_description("UBER DO BRASI") == "UBER BR"
    assert normalize_transaction_description("UBER EATS*RESTAURANTE") == "UBER EATS RESTAURANTE"


def test_normalize_transaction_description_expands_known_truncated_sequences() -> None:
    assert normalize_transaction_description("PAYPAL *Uber do Brasi") == "PAYPAL UBER BR"
    assert normalize_transaction_description("PAYPAL *GOOGLE YOUTUB") == "PAYPAL GOOGLE YOUTUBE"
    assert (
        normalize_transaction_description("Amazon Ad free for Prim")
        == "AMAZON AD FREE FOR PRIME"
    )
    assert normalize_transaction_description("DAISO BRASIL") == "DAISO BRASIL"


def test_normalize_transaction_description_removes_trailing_installment_tokens() -> None:
    assert normalize_transaction_description("ANGLO 03/10") == "ANGLO"
    assert normalize_transaction_description("ANGLO 03 10") == "ANGLO"
    assert normalize_transaction_description("ANGLO 02 10") == "ANGLO"
    assert normalize_transaction_description("ANGLO 05/05") == "ANGLO"
    assert normalize_transaction_description("REINALDO DOS SANTO08/10") == "REINALDO DOS SANTO"
    assert normalize_transaction_description("ANGLO") == "ANGLO"
    assert normalize_transaction_description("LOJA 11 10") == "LOJA 11 10"
    assert normalize_transaction_description("LOJA 11/10") == "LOJA 11 10"


def test_normalize_transaction_description_for_dedupe_preserves_installment_tokens() -> None:
    assert normalize_transaction_description_for_dedupe("ANGLO 03/10") == "ANGLO 03 10"
    assert normalize_transaction_description_for_dedupe("ANGLO 03 10") == "ANGLO 03 10"
    assert normalize_transaction_description_for_dedupe("ANGLO 02 10") == "ANGLO 02 10"
    assert (
        normalize_transaction_description_for_dedupe("BKI PM SAO PAU 626400399")
        == "BKI PM SAO PAU"
    )


def test_extract_installment_from_raw_description() -> None:
    assert extract_installment("ANGLO 03/10") == (3, 10)
    assert extract_installment("ANGLO 03 10") == (3, 10)
    assert extract_installment("ANGLO 05/05") == (5, 5)
    assert extract_installment("REINALDO DOS SANTO08/10") == (8, 10)
    assert extract_installment("ANGLO") == (None, None)
    assert extract_installment("LOJA 11 10") == (None, None)


def test_parse_credit_card_csv_extracts_installments_and_keeps_clean_description() -> None:
    content = "data,lançamento,valor\n2026-02-23,ANGLO 03/10,6536.76"

    result = parse_credit_card_csv(content)

    assert result.errors == []
    assert result.transactions[0].description == "ANGLO"
    assert result.transactions[0].raw_description == "ANGLO 03/10"
    assert result.transactions[0].installment_current == 3
    assert result.transactions[0].installment_total == 10
