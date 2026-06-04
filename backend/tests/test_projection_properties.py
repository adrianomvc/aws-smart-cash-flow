from datetime import date, timedelta
from decimal import Decimal

from hypothesis import given
from hypothesis import strategies as st

from app.services.projection_service import (
    ProjectionEvent,
    build_projection,
    classify_projection_risk,
)

money = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("100000.00"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


@st.composite
def projection_events(draw: st.DrawFn) -> list[ProjectionEvent]:
    count = draw(st.integers(min_value=0, max_value=20))
    events: list[ProjectionEvent] = []
    for index in range(count):
        days = draw(st.integers(min_value=0, max_value=120))
        amount = draw(money)
        event_type = draw(st.sampled_from(["income", "expense", "card_payment", "subscription"]))
        events.append(
            ProjectionEvent(
                title=f"Evento {index}",
                event_type=event_type,
                amount=amount,
                due_date=date(2026, 1, 1) + timedelta(days=days),
            )
        )
    return events


@given(projection_events())
def test_projection_horizons_are_ordered_and_balances_match(events: list[ProjectionEvent]) -> None:
    horizons = build_projection(date_from=date(2026, 1, 1), events=events, horizons=[90, 30, 60])

    assert [item.days for item in horizons] == [30, 60, 90]
    assert [item.date_to for item in horizons] == sorted(item.date_to for item in horizons)
    for horizon in horizons:
        assert horizon.event_count >= 0
        assert horizon.projected_balance == (
            horizon.projected_income - horizon.projected_expenses
        ).quantize(Decimal("0.01"))


@given(
    st.decimals(min_value=Decimal("-100000"), max_value=Decimal("100000"), places=2),
    st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
)
def test_risk_classification_is_deterministic(balance: Decimal, expenses: Decimal) -> None:
    first = classify_projection_risk(balance=balance, expenses=expenses)
    second = classify_projection_risk(balance=balance, expenses=expenses)

    assert first == second
    assert first[0] in {"healthy", "attention", "risk"}
