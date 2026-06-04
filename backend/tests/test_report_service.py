from decimal import Decimal

from app.services.report_service import ReportCard, _percent, normalize_report_cards


def test_normalize_report_cards_orders_by_id() -> None:
    cards = [
        ReportCard("goals", "Metas", "", "ready", "1", "metas", "goals"),
        ReportCard("cashflow", "Fluxo", "", "ready", "0.00", "saldo", "cashflow"),
    ]

    assert [card.id for card in normalize_report_cards(cards)] == ["cashflow", "goals"]


def test_percent_formats_none_and_decimal_values() -> None:
    assert _percent(None) == "0.00%"
    assert _percent(Decimal("0.875")) == "87.50%"

