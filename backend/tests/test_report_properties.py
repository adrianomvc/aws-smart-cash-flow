from hypothesis import given
from hypothesis import strategies as st

from app.services.report_service import ReportCard, normalize_report_cards

status_values = st.sampled_from(["ready", "partial", "empty", "coming_soon"])


@st.composite
def report_cards(draw: st.DrawFn) -> list[ReportCard]:
    ids = draw(st.lists(st.text(min_size=1, max_size=16), min_size=0, max_size=20, unique=True))
    return [
        ReportCard(
            id=value,
            title=f"Relatorio {index}",
            description="Descricao",
            status=draw(status_values),
            primary_metric=str(index),
            secondary_metric="secundaria",
            target_page="dashboard",
        )
        for index, value in enumerate(ids)
    ]


@given(report_cards())
def test_report_normalization_is_deterministic_and_preserves_unique_ids(
    cards: list[ReportCard],
) -> None:
    first = normalize_report_cards(cards)
    second = normalize_report_cards(cards)

    assert first == second
    assert [card.id for card in first] == sorted(card.id for card in cards)
    assert len({card.id for card in first}) == len(first)


@given(report_cards())
def test_report_statuses_stay_in_allowed_set(cards: list[ReportCard]) -> None:
    allowed = {"ready", "partial", "empty", "coming_soon"}

    assert all(card.status in allowed for card in normalize_report_cards(cards))

