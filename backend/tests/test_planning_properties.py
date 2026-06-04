from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from hypothesis import given
from hypothesis import strategies as st

from app.api.routes.planning import (
    _normalize_optional_text,
    _normalize_required_text,
    _validate_alert_threshold,
    _validate_non_negative_amount,
    _validate_period,
    _validate_positive_amount,
)


def spaced_text() -> st.SearchStrategy[str]:
    token = st.text(
        alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00"),
        min_size=1,
        max_size=20,
    ).filter(lambda value: bool(value.strip()))
    return st.lists(token, min_size=1, max_size=6).map(lambda parts: " \t ".join(parts))


finite_money = st.decimals(
    min_value=Decimal("-1000000.00"),
    max_value=Decimal("1000000.00"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


@given(spaced_text())
def test_required_text_normalization_is_idempotent(value: str) -> None:
    normalized = _normalize_required_text(value, "required")

    assert normalized == _normalize_required_text(normalized, "required")
    assert normalized == " ".join(normalized.split())
    assert normalized


@given(st.one_of(st.none(), spaced_text(), st.just("   \t  ")))
def test_optional_text_normalization_is_idempotent(value: str | None) -> None:
    normalized = _normalize_optional_text(value)

    assert _normalize_optional_text(normalized) == normalized
    if normalized is not None:
        assert normalized == " ".join(normalized.split())


@given(finite_money)
def test_positive_amount_accepts_only_values_greater_than_zero(value: Decimal) -> None:
    if value > 0:
        assert _validate_positive_amount(value, "positive") == value
    else:
        with pytest.raises(HTTPException):
            _validate_positive_amount(value, "positive")


@given(finite_money)
def test_non_negative_amount_accepts_zero_and_positive_values(value: Decimal) -> None:
    if value >= 0:
        assert _validate_non_negative_amount(value) == value
    else:
        with pytest.raises(HTTPException):
            _validate_non_negative_amount(value)


@given(st.decimals(min_value=Decimal("-2"), max_value=Decimal("2"), places=4))
def test_alert_threshold_stays_inside_open_closed_unit_interval(value: Decimal) -> None:
    if Decimal("0") < value <= Decimal("1"):
        assert _validate_alert_threshold(value) == value
    else:
        with pytest.raises(HTTPException):
            _validate_alert_threshold(value)


@given(
    st.dates(min_value=date(2000, 1, 1), max_value=date(2099, 12, 31)),
    st.integers(min_value=-365, max_value=365),
)
def test_budget_period_requires_end_on_or_after_start(start: date, offset_days: int) -> None:
    end = start + timedelta(days=offset_days)

    if end >= start:
        _validate_period(start, end)
    else:
        with pytest.raises(HTTPException):
            _validate_period(start, end)

