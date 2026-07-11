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
    Index,
    Integer,
    LargeBinary,
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
    supabase_user_id: Mapped[str | None] = mapped_column(UUID_TYPE, unique=True, nullable=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(Text)
    # Local auth only - dev only.
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        CheckConstraint(
            "role in ('owner', 'admin', 'member', 'viewer')",
            name="ck_workspace_member_role",
        ),
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


class WorkspaceInvite(Base):
    """A pending invitation for someone to join a workspace with a given role."""

    __tablename__ = "workspace_invites"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email", name="uq_workspace_invite"),
        CheckConstraint(
            "role in ('admin', 'member', 'viewer')", name="ck_workspace_invite_role"
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SourceFile(Base):
    __tablename__ = "source_files"
    __table_args__ = (
        UniqueConstraint("workspace_id", "content_hash", name="uq_source_file_workspace_hash"),
        CheckConstraint(
            "source_kind in ("
            "'bank_statement_txt', 'bank_statement_excel', 'credit_card_csv', "
            "'credit_card_pdf', 'unknown'"
            ")",
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


class SourceFileContent(Base):
    """Raw bytes of an uploaded file, kept so the async import worker can
    re-read the upload after the HTTP request has already returned."""

    __tablename__ = "source_file_contents"

    source_file_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("source_files.id"), primary_key=True
    )
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


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
    # Effective cash-out date (credit-card invoice due date for card purchases).
    payment_date: Mapped[date | None] = mapped_column(Date)
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
    duplicate_group_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Optional link to a goal: tags this transaction as a contribution/aporte.
    goal_id: Mapped[str | None] = mapped_column(
        UUID_TYPE, ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AccountBalance(Base):
    __tablename__ = "account_balances"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "account_name",
            "balance_date",
            name="uq_account_balance_workspace_account_date",
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
    account_name: Mapped[str] = mapped_column(Text, nullable=False)
    balance_date: Mapped[date] = mapped_column(Date, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    source_line: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, object]] = mapped_column(JSONB_TYPE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CreditCard(Base):
    __tablename__ = "credit_cards"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_credit_card_workspace_name"),
        CheckConstraint(
            "closing_day >= 1 and closing_day <= 31",
            name="ck_credit_card_closing_day",
        ),
        CheckConstraint("due_day >= 1 and due_day <= 31", name="ck_credit_card_due_day"),
        CheckConstraint(
            "limit_amount is null or limit_amount > 0",
            name="ck_credit_card_limit_amount_positive",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    issuer: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(Text)
    last_four: Mapped[str | None] = mapped_column(String(4))
    # Identity key from the statement's masked PAN prefix (e.g. "5312"): stable
    # across a card reissue, unlike last_four. Used to match imported statements to
    # the same physical card even when the plastic (last_four) was reissued.
    bin: Mapped[str | None] = mapped_column(String(8))
    # last_four values this card had before the current one (reissue history), most
    # recent last. Kept so old statements still match and the UI can show past cards.
    previous_last_four: Mapped[list | None] = mapped_column(JSONB_TYPE, default=list)
    color: Mapped[str | None] = mapped_column(Text)
    closing_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    limit_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CreditCardStatement(Base):
    __tablename__ = "credit_card_statements"
    __table_args__ = (
        UniqueConstraint("credit_card_id", "due_date", name="uq_credit_card_statement_due_date"),
        CheckConstraint(
            "status in ('open', 'closed', 'paid', 'partial')",
            name="ck_credit_card_statement_status",
        ),
        CheckConstraint(
            "total_amount is null or total_amount >= 0",
            name="ck_credit_card_statement_total_non_negative",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    credit_card_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("credit_cards.id"), nullable=False
    )
    source_file_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("source_files.id"))
    statement_month: Mapped[date] = mapped_column(Date, nullable=False)
    closing_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="open",
        server_default="open",
    )
    notes: Mapped[str | None] = mapped_column(Text)
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

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_category_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("categories.id"))
    color: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    __table_args__ = (
        Index(
            "uq_category_workspace_root_name",
            "workspace_id",
            "name",
            unique=True,
            postgresql_where=parent_category_id.is_(None),
            sqlite_where=parent_category_id.is_(None),
        ),
        Index(
            "uq_category_workspace_parent_name",
            "workspace_id",
            "parent_category_id",
            "name",
            unique=True,
            postgresql_where=parent_category_id.is_not(None),
            sqlite_where=parent_category_id.is_not(None),
        ),
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
    rule_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("categorization_rules.id"))
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
            "match_type in ('contains', 'starts_with', 'equals', 'regex', 'amount_recurring')",
            name="ck_categorization_rule_match_type",
        ),
        CheckConstraint(
            "target_direction is null or target_direction in ('debit', 'credit', 'payment')",
            name="ck_categorization_rule_target_direction",
        ),
        CheckConstraint(
            "direction_filter is null or direction_filter in ('debit', 'credit', 'payment')",
            name="ck_categorization_rule_direction_filter",
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
    category_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("categories.id"))
    target_direction: Mapped[str | None] = mapped_column(String(16))
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, server_default="100"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # amount_recurring fields (Fase 1.5)
    amount_ref: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    amount_tolerance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    day_min: Mapped[int | None] = mapped_column(Integer)
    day_max: Mapped[int | None] = mapped_column(Integer)
    direction_filter: Mapped[str | None] = mapped_column(String(16))
    # How the rule was created: "manual" (user) or "ai" (from an AI suggestion).
    origin: Mapped[str] = mapped_column(
        String(16), nullable=False, default="manual", server_default="manual"
    )
    # origin tracing
    rule_id_origin: Mapped[str | None] = mapped_column(
        UUID_TYPE, ForeignKey("categorization_rules.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MerchantAlias(Base):
    """User-defined "rename" for messy descriptions: when a transaction's raw or
    normalized description contains ``pattern``, its display description becomes
    ``replacement`` (e.g. "BANCO ITAU SA" -> "Itaú"). Applied during import and by
    the normalize-descriptions endpoint."""

    __tablename__ = "merchant_aliases"
    __table_args__ = (
        UniqueConstraint("workspace_id", "pattern", name="uq_merchant_alias_workspace_pattern"),
        CheckConstraint(
            "match_type in ('contains', 'equals', 'token')",
            name="ck_merchant_alias_match_type",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    replacement: Mapped[str] = mapped_column(Text, nullable=False)
    # contains/equals = rename whole description; token = replace just the matching word.
    match_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="contains", server_default="contains"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FinancialCalendarEvent(Base):
    __tablename__ = "financial_calendar_events"
    __table_args__ = (
        CheckConstraint(
            "event_type in ('income', 'expense', 'card_payment', 'subscription', 'goal', 'other')",
            name="ck_financial_calendar_event_type",
        ),
        CheckConstraint(
            "status in ('planned', 'paid', 'skipped')",
            name="ck_financial_calendar_event_status",
        ),
        CheckConstraint(
            "recurrence in ('none', 'monthly')",
            name="ck_financial_calendar_event_recurrence",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurrence: Mapped[str] = mapped_column(
        String(16), nullable=False, default="none", server_default="none"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="planned", server_default="planned"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("limit_amount > 0", name="ck_budget_limit_amount_positive"),
        CheckConstraint(
            "alert_threshold > 0 and alert_threshold <= 1",
            name="ck_budget_alert_threshold_range",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    category_id: Mapped[str | None] = mapped_column(UUID_TYPE, ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date | None] = mapped_column(Date)
    recurring: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    alert_threshold: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), nullable=False, default=Decimal("0.8500"), server_default="0.8500"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_goal_target_amount_positive"),
        CheckConstraint("current_amount >= 0", name="ck_goal_current_amount_non_negative"),
        CheckConstraint(
            "status in ('active', 'paused', 'completed')",
            name="ck_goal_status",
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    target_date: Mapped[date | None] = mapped_column(Date)
    tracking_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="manual", server_default="manual"
    )
    linked_account: Mapped[str | None] = mapped_column(Text)
    # Auto-link rule (contributions mode): description match + optional value range.
    aporte_match_text: Mapped[str | None] = mapped_column(Text)
    aporte_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    aporte_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    color: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, server_default="100"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WorkspacePreferences(Base):
    __tablename__ = "workspace_preferences"

    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), primary_key=True
    )
    currency: Mapped[str] = mapped_column(
        String(8), nullable=False, default="BRL", server_default="BRL"
    )
    savings_target_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), nullable=False, default=Decimal("0.2000"), server_default="0.2000"
    )
    commitment_limit_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), nullable=False, default=Decimal("0.3500"), server_default="0.3500"
    )
    risk_profile: Mapped[str] = mapped_column(
        String(16), nullable=False, default="moderate", server_default="moderate"
    )
    burn_rate_window_months: Mapped[int] = mapped_column(
        Integer, nullable=False, default=12, server_default="12"
    )
    protected_reserve: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class InvestmentCustody(Base):
    """A place where investments are held: brokerage, pension, exchange,
    self-custody wallet or a reserve account. Position view, not trades."""

    __tablename__ = "investment_custodies"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_investment_custody_workspace_name"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str | None] = mapped_column(Text)
    account_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="broker", server_default="broker"
    )
    brand: Mapped[str | None] = mapped_column(String(8))
    color: Mapped[str | None] = mapped_column(Text)
    sync_mode: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class InvestmentAsset(Base):
    """A position held inside a custody (not an operation/trade)."""

    __tablename__ = "investment_assets"
    __table_args__ = (
        CheckConstraint("current_value >= 0", name="ck_investment_asset_value_non_negative"),
        CheckConstraint(
            "contributed >= 0", name="ck_investment_asset_contributed_non_negative"
        ),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    custody_id: Mapped[str] = mapped_column(
        UUID_TYPE,
        ForeignKey("investment_custodies.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    asset_class: Mapped[str] = mapped_column(
        String(16), nullable=False, default="other", server_default="other"
    )
    risk: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)
    current_value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    contributed: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class InvestmentSnapshot(Base):
    """Historical value of a single position on a given date. Returns and the
    12-month wealth evolution are derived from the variation between snapshots."""

    __tablename__ = "investment_snapshots"
    __table_args__ = (
        UniqueConstraint("asset_id", "as_of", name="uq_investment_snapshot_asset_date"),
        Index("ix_investment_snapshot_asset_date", "asset_id", "as_of"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    asset_id: Mapped[str] = mapped_column(
        UUID_TYPE,
        ForeignKey("investment_assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    contributed: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WealthItem(Base):
    """A manually maintained net-worth line: an asset (property, vehicle,
    account) or a liability (loan, debt). The investment portfolio is added
    automatically and is not stored here."""

    __tablename__ = "wealth_items"
    __table_args__ = (
        CheckConstraint("kind in ('asset', 'liability')", name="ck_wealth_item_kind"),
        CheckConstraint("value >= 0", name="ck_wealth_item_value_non_negative"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(24))
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WealthSnapshot(Base):
    """Historical value of a net-worth item on a given date. Feeds the real
    12-month evolution of net worth."""

    __tablename__ = "wealth_snapshots"
    __table_args__ = (
        UniqueConstraint("item_id", "as_of", name="uq_wealth_snapshot_item_date"),
        Index("ix_wealth_snapshot_item_date", "item_id", "as_of"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    item_id: Mapped[str] = mapped_column(
        UUID_TYPE,
        ForeignKey("wealth_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LlmCategorizationCache(Base):
    """Caches the LLM's categorization per normalized description, so the LLM is
    called at most once per unique description (per workspace) and reused across
    runs and across all transactions that share the description."""

    __tablename__ = "llm_categorization_cache"
    __table_args__ = (
        UniqueConstraint("workspace_id", "description_key", name="uq_llm_cache_ws_desc"),
        Index("ix_llm_cache_ws_desc", "workspace_id", "description_key"),
    )

    id: Mapped[str] = mapped_column(UUID_TYPE, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("workspaces.id"), nullable=False
    )
    description_key: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[str] = mapped_column(
        UUID_TYPE, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    regex_suggestion: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
