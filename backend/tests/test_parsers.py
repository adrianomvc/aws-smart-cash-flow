from decimal import Decimal, InvalidOperation

import pytest

from app.domain.imports import TransactionDirection
from app.services.parsers import (
    normalize_transaction_description,
    parse_brazilian_decimal,
    parse_credit_card_csv,
    parse_txt_bank_statement,
)


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
    assert normalize_transaction_description("MERCADOLIVRE*LOJA EXEMPLO") == "MERCADO LIVRE"
    assert (
        normalize_transaction_description("99FOOD*RESTAURANTE EXEMPLO")
        == "99FOOD RESTAURANTE EXEMPLO"
    )
    assert normalize_transaction_description("SHELL*POSTO EXEMPLO") == "SHELL POSTO EXEMPLO"
    assert normalize_transaction_description("SHOPEE*LOJA EXEMPLO") == "SHOPEE"
    assert normalize_transaction_description("AMAZONMKTPLC*LOJA EXEMPLO") == "AMAZON"


def test_normalize_transaction_description_collapses_repeated_alias_sequences() -> None:
    assert normalize_transaction_description("MERCADOLIVRE*MERCADO LIVRE LOJA") == "MERCADO LIVRE"
    assert normalize_transaction_description("99FOOD*99Food RESTAURANTE") == "99FOOD RESTAURANTE"
