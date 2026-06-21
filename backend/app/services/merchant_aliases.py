"""User-defined merchant/institution aliases.

An alias renames a messy description to a clean display name: when the raw or
normalized description *contains* the alias pattern (accent-insensitive,
case-insensitive), the transaction's display ``description`` becomes the alias
``replacement``. Applied during import and by the normalize-descriptions endpoint.
"""

from unicodedata import normalize

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import MerchantAlias


def normalize_alias_key(text: str) -> str:
    """ASCII-uppercase, accent-stripped, single-spaced key used for matching."""
    ascii_text = "".join(
        char for char in normalize("NFKD", text) if char.encode("ascii", "ignore") != b""
    ).upper()
    return " ".join(ascii_text.split())


# An alias is (match_type, normalized_pattern, replacement).
Alias = tuple[str, str, str]


def load_aliases(db: Session, workspace_id: str) -> list[Alias]:
    """Return active aliases sorted by pattern length descending so the most
    specific alias wins."""
    rows = db.scalars(
        select(MerchantAlias).where(
            MerchantAlias.workspace_id == workspace_id,
            MerchantAlias.active.is_(True),
        )
    ).all()
    aliases: list[Alias] = [
        (row.match_type, normalize_alias_key(row.pattern), row.replacement)
        for row in rows
        if row.pattern.strip()
    ]
    aliases.sort(key=lambda item: len(item[1]), reverse=True)
    return aliases


def apply_aliases(
    raw_description: str,
    description: str,
    aliases: list[Alias],
) -> str | None:
    """Apply user aliases to a normalized description. Returns the new description,
    or ``None`` when nothing changed.

    - ``contains`` / ``equals``: rename the WHOLE description to the replacement
      (most specific match wins; checked first).
    - ``token``: replace just the matching whole word, keeping the rest.
    """
    if not aliases:
        return None
    key_raw = normalize_alias_key(raw_description)
    key_desc = normalize_alias_key(description)

    # Whole-description rename takes precedence over token edits.
    for match_type, pattern, replacement in aliases:
        if not pattern:
            continue
        if match_type == "equals" and (key_desc == pattern or key_raw == pattern):
            return replacement
        if match_type == "contains" and (pattern in key_desc or pattern in key_raw):
            return replacement

    # No rename matched — apply token substitutions on the normalized description.
    tokens = description.split()
    changed = False
    for match_type, pattern, replacement in aliases:
        if match_type != "token" or not pattern:
            continue
        new_tokens = [replacement if normalize_alias_key(t) == pattern else t for t in tokens]
        if new_tokens != tokens:
            tokens = new_tokens
            changed = True
    return " ".join(tokens) if changed else None
