from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

UUID_TYPE = Uuid(as_uuid=False)
JSONB_TYPE = JSON().with_variant(postgresql.JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    supabase_user_id: Mapped[str] = mapped_column(UUID_TYPE, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
        CheckConstraint("role in ('owner', 'admin', 'member')", name="ck_workspace_member_role"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SourceFile(Base):
    __tablename__ = "source_files"
    __table_args__ = (
        UniqueConstraint("workspace_id", "content_hash", name="uq_source_file_workspace_hash"),
        CheckConstraint(
            "source_kind in ('bank_statement_txt', 'credit_card_csv', 'unknown')",
            name="ck_source_file_source_kind",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by_user_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    import_jobs: Mapped[list["ImportJob"]] = relationship(back_populates="source_file")


class ImportJob(Base):
    __tablename__ = "import_jobs"
    __table_args__ = (
        CheckConstraint(
            "status in ("
            "'pending', 'processing', 'completed', 'completed_with_errors', "
            "'failed', 'duplicate_file'"
            ")",
            name="ck_import_job_status",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    source_file_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("source_files.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    duplicate_rows: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    source_file: Mapped[SourceFile] = relationship(back_populates="import_jobs")


class RawTransactionLine(Base):
    __tablename__ = "raw_transaction_lines"
    __table_args__ = (
        UniqueConstraint("import_job_id", "source_line", name="uq_raw_line_import_source_line"),
        CheckConstraint(
            "parse_status in ('valid', 'invalid', 'skipped')",
            name="ck_raw_transaction_line_parse_status",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    source_file_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("source_files.id"), nullable=False
    )
    import_job_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("import_jobs.id"), nullable=False
    )
    source_line: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, object]] = mapped_column(JSONB_TYPE, nullable=False)
    parse_status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("workspace_id", "dedupe_key", name="uq_transaction_dedupe"),
        UniqueConstraint(
            "workspace_id", "natural_dedupe_key", name="uq_transaction_natural_dedupe"
        ),
        CheckConstraint(
            "source_type in ('bank_statement', 'credit_card_statement', 'unknown')",
            name="ck_transaction_source_type",
        ),
        CheckConstraint(
            "direction in ('debit', 'credit', 'payment')",
            name="ck_transaction_direction",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    source_file_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("source_files.id"), nullable=False
    )
    import_job_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("import_jobs.id"), nullable=False
    )
    raw_transaction_line_id: Mapped[str | None] = mapped_column(
        UUID_TYPE, ForeignKey("raw_transaction_lines.id")
    )
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_name: Mapped[str | None] = mapped_column(Text)
    account_or_card: Mapped[str | None] = mapped_column(Text)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="BRL", server_default="BRL"
    )
    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    installment_current: Mapped[int | None] = mapped_column(Integer)
    installment_total: Mapped[int | None] = mapped_column(Integer)
    source_line: Mapped[int | None] = mapped_column(Integer)
    dedupe_key: Mapped[str] = mapped_column(String(64), nullable=False)
    natural_dedupe_key: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ImportError(Base):
    __tablename__ = "import_errors"

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    import_job_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("import_jobs.id"), nullable=False
    )
    source_line: Mapped[int | None] = mapped_column(Integer)
    field_name: Mapped[str | None] = mapped_column(Text)
    raw_value: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "parent_category_id",
            "name",
            name="uq_category_workspace_parent_name",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_category_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("categories.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TransactionCategoryAssignment(Base):
    __tablename__ = "transaction_category_assignments"
    __table_args__ = (
        UniqueConstraint("transaction_id", name="uq_transaction_category_assignment_transaction"),
        CheckConstraint(
            "source in ('manual', 'rule', 'embedding', 'llm')",
            name="ck_transaction_category_assignment_source",
        ),
        CheckConstraint(
            "review_status in ('accepted', 'pending', 'corrected')",
            name="ck_transaction_category_assignment_review_status",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    transaction_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("transactions.id"), nullable=False
    )
    category_id: Mapped[str] = mapped_column(UUID_TYPE, ForeignKey("categories.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    reason: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"
    __table_args__ = (
        CheckConstraint(
            "field in ('description', 'raw_description', 'source_name')",
            name="ck_categorization_rule_field",
        ),
        CheckConstraint(
            "match_type in ('contains', 'starts_with', 'equals')",
            name="ck_categorization_rule_match_type",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    field: Mapped[str] = mapped_column(String(32), nullable=False)
    match_type: Mapped[str] = mapped_column(String(32), nullable=False)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[str] = mapped_column(UUID_TYPE, ForeignKey("categories.id"), nullable=False)
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, server_default="100"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
