from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class SourceKind(StrEnum):
    BANK_STATEMENT_TXT = "bank_statement_txt"
    CREDIT_CARD_CSV = "credit_card_csv"
    UNKNOWN = "unknown"


class TransactionDirection(StrEnum):
    DEBIT = "debit"
    CREDIT = "credit"
    PAYMENT = "payment"


class ImportStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"
    DUPLICATE_FILE = "duplicate_file"


class ParsedTransaction(BaseModel):
    transaction_date: date
    raw_description: str
    description: str
    amount: Decimal
    direction: TransactionDirection
    source_line: int


class ParseError(BaseModel):
    source_line: int | None = None
    field_name: str | None = None
    raw_value: str | None = None
    error_code: str
    message: str


class ParseResult(BaseModel):
    source_kind: SourceKind
    total_rows: int
    transactions: list[ParsedTransaction] = Field(default_factory=list)
    errors: list[ParseError] = Field(default_factory=list)


class ImportResult(BaseModel):
    import_job_id: str
    source_file_id: str
    status: ImportStatus
    total_rows: int
    valid_rows: int
    error_rows: int
