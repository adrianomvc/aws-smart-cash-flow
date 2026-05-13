from pathlib import Path

from app.domain.imports import SourceKind


def classify_file(filename: str, content: str) -> SourceKind:
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        return SourceKind.BANK_STATEMENT_TXT
    first_non_empty_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
    normalized_header = ",".join(part.strip().lower() for part in first_non_empty_line.split(","))
    if suffix == ".csv" and normalized_header == "data,lançamento,valor":
        return SourceKind.CREDIT_CARD_CSV
    return SourceKind.UNKNOWN
