from datetime import date
from decimal import Decimal

from app.services.projection_service import ProjectionEvent, build_projection, projected_occurrences


def test_projection_sums_income_expenses_and_risk_by_horizon() -> None:
    events = [
        ProjectionEvent(
            title="Salario",
            event_type="income",
            amount=Decimal("5000.00"),
            due_date=date(2026, 6, 5),
        ),
        ProjectionEvent(
            title="Aluguel",
            event_type="expense",
            amount=Decimal("2200.00"),
            due_date=date(2026, 6, 10),
        ),
        ProjectionEvent(
            title="Fatura",
            event_type="card_payment",
            amount=Decimal("3100.00"),
            due_date=date(2026, 6, 15),
        ),
    ]

    result = build_projection(date_from=date(2026, 6, 1), events=events, horizons=[30])

    assert result[0].projected_income == Decimal("5000.00")
    assert result[0].projected_expenses == Decimal("5300.00")
    assert result[0].projected_balance == Decimal("-300.00")
    assert result[0].event_count == 3
    assert result[0].risk_level == "risk"


def test_monthly_events_are_projected_inside_horizon() -> None:
    events = [
        ProjectionEvent(
            title="Assinatura",
            event_type="subscription",
            amount=Decimal("59.90"),
            due_date=date(2026, 1, 31),
            recurrence="monthly",
        )
    ]

    occurrences = projected_occurrences(
        events=events,
        date_from=date(2026, 2, 1),
        date_to=date(2026, 4, 30),
    )

    assert [item.due_date for item in occurrences] == [
        date(2026, 2, 28),
        date(2026, 3, 28),
        date(2026, 4, 28),
    ]

