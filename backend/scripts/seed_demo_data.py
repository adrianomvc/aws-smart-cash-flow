"""Replace the demo workspace's data with a fictitious family dataset.

The public app has no real login yet: the "Explorar a demonstração" button lands
everyone on the local-dev workspace (00000000-...-0002). Before publicising the
URL, that workspace must hold FAKE data only. This script wipes every tenant row
of the workspace and seeds ~13 months of a realistic — but invented — family:
salaries, financing, school, groceries, card installments, goals and budgets.

Deterministic (seeded RNG): re-running produces the same dataset.

Usage (SQLite smoke test):
    python scripts/seed_demo_data.py --database-url sqlite:///./demo_seed_test.db --create-tables

Usage (Neon/prod — pass the URL via env var, never on the command line):
    SEED_DATABASE_URL=postgresql://... python scripts/seed_demo_data.py --yes
"""

from __future__ import annotations

import argparse
import hashlib
import os
import random
import sys
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, delete, update  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.core.config import normalize_database_url  # noqa: E402
from app.db.models import (  # noqa: E402
    AccountBalance,
    Base,
    Budget,
    CategorizationRule,
    Category,
    CreditCard,
    CreditCardStatement,
    FinancialCalendarEvent,
    Goal,
    ImportError,
    ImportJob,
    InvestmentAsset,
    InvestmentCustody,
    InvestmentSnapshot,
    LlmCategorizationCache,
    MerchantAlias,
    RawTransactionLine,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
    User,
    WealthItem,
    WealthSnapshot,
    Workspace,
    WorkspaceMember,
    WorkspacePreferences,
)

WS = "00000000-0000-0000-0000-000000000002"
USER = "00000000-0000-0000-0000-000000000001"
DEMO_WORKSPACE_NAME = "Família Exemplo (demo)"
DEMO_USER_NAME = "Visitante"

rng = random.Random(42)

# Seeded window: 13 closed months + the current partial month.
FIRST_MONTH = date(2025, 6, 1)
LAST_CLOSED_MONTH = date(2026, 6, 1)
TODAY = date(2026, 7, 3)


def _uid() -> str:
    return str(uuid.UUID(int=rng.getrandbits(128)))


def _key(*parts: object) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()


def _months() -> list[date]:
    months, cur = [], FIRST_MONTH
    while cur <= LAST_CLOSED_MONTH:
        months.append(cur)
        cur = date(cur.year + (cur.month == 12), cur.month % 12 + 1, 1)
    return months


def _amount(lo: float, hi: float) -> Decimal:
    return Decimal(str(round(rng.uniform(lo, hi), 2)))


def wipe(db: Session) -> None:
    """Delete every tenant row of the demo workspace (children before parents)."""
    db.execute(update(Transaction).where(Transaction.workspace_id == WS).values(goal_id=None))
    for model in (
        LlmCategorizationCache,
        TransactionCategoryAssignment,
        CategorizationRule,
        MerchantAlias,
        FinancialCalendarEvent,
        Budget,
        Goal,
        InvestmentSnapshot,
        InvestmentAsset,
        InvestmentCustody,
        WealthSnapshot,
        WealthItem,
        ImportError,
        AccountBalance,
        CreditCardStatement,
        Transaction,  # references raw_transaction_lines → must go first
        RawTransactionLine,
        CreditCard,
        ImportJob,
        SourceFile,
    ):
        db.execute(delete(model).where(model.workspace_id == WS))
    # Categories: subcategories reference roots.
    db.execute(delete(Category).where(Category.workspace_id == WS, Category.parent_category_id.is_not(None)))
    db.execute(delete(Category).where(Category.workspace_id == WS))
    db.execute(delete(WorkspacePreferences).where(WorkspacePreferences.workspace_id == WS))


def seed(db: Session) -> dict[str, int]:
    now = datetime.now(UTC)
    counts: dict[str, int] = {}

    # ----- workspace / user identity (rename away from real names) -----
    ws = db.get(Workspace, WS)
    if ws is None:
        raise SystemExit(f"workspace {WS} not found — aborting")
    ws.name = DEMO_WORKSPACE_NAME
    user = db.get(User, USER)
    if user is not None:
        user.display_name = DEMO_USER_NAME

    db.add(WorkspacePreferences(workspace_id=WS, protected_reserve=Decimal("12000.00")))

    # ----- categories -----
    def cat(name: str, color: str, parent: str | None = None) -> str:
        cid = _uid()
        db.add(Category(id=cid, workspace_id=WS, name=name, color=color, parent_category_id=parent))
        return cid

    c_moradia = cat("Moradia", "#3567b8")
    c_financiamento = cat("Financiamento", "#3567b8", c_moradia)
    c_energia = cat("Energia", "#5a7dc9", c_moradia)
    c_internet = cat("Internet", "#5a7dc9", c_moradia)
    c_condominio = cat("Condomínio", "#3567b8", c_moradia)
    c_alimentacao = cat("Alimentação", "#1f8a5b")
    c_mercado = cat("Supermercado", "#1f8a5b", c_alimentacao)
    c_restaurantes = cat("Restaurantes e delivery", "#2a9d8f", c_alimentacao)
    c_transporte = cat("Transporte", "#c98a2b")
    c_combustivel = cat("Combustível", "#c98a2b", c_transporte)
    c_apps = cat("Apps de transporte", "#d98234", c_transporte)
    c_saude = cat("Saúde", "#cf4d43")
    c_educacao = cat("Educação", "#6a52c9")
    c_lazer = cat("Lazer e assinaturas", "#a35a7d")
    c_vestuario = cat("Vestuário", "#7c8696")
    c_impostos = cat("Impostos e taxas", "#9a6b14")
    c_receita = cat("Receita", "#0e7a45")
    c_salario = cat("Salário", "#0e7a45", c_receita)
    c_freela = cat("Freelance", "#2a9d8f", c_receita)
    counts["categories"] = 19

    # ----- bank source file / import job -----
    def source(name: str, kind: str) -> tuple[str, str]:
        sf, job = _uid(), _uid()
        db.add(SourceFile(
            id=sf, workspace_id=WS, original_filename=name, content_hash=_key("sf", name),
            mime_type="text/plain", size_bytes=1024, storage_bucket="demo", storage_path=f"demo/{name}",
            source_kind=kind, created_by_user_id=USER, received_at=now,
        ))
        db.add(ImportJob(
            id=job, workspace_id=WS, source_file_id=sf, status="completed",
            started_at=now, finished_at=now, total_rows=0, valid_rows=0,
        ))
        # Parents must hit the DB before any row that references them —
        # Postgres enforces the FKs (SQLite in the smoke test does not).
        db.flush()
        return sf, job

    bank_sf, bank_job = source("extrato_conta_corrente_demo.txt", "bank_statement_txt")

    line = 0
    tx_rows: list[Transaction] = []
    assignments: list[tuple[str, str]] = []  # (transaction_id, category_id)
    goal_txs: list[str] = []

    def tx(
        d: date, desc: str, amount: Decimal, direction: str, *,
        source_type: str = "bank_statement", sf: str = bank_sf, job: str = bank_job,
        category: str | None = None, payment: date | None = None,
        inst: tuple[int, int] | None = None, card_label: str | None = None,
        skip_assignment: bool = False,
    ) -> str:
        nonlocal line
        line += 1
        tid = _uid()
        tx_rows.append(Transaction(
            id=tid, workspace_id=WS, source_file_id=sf, import_job_id=job,
            source_type=source_type, source_name="Banco Azul" if source_type == "bank_statement" else card_label,
            account_or_card="Conta Corrente" if source_type == "bank_statement" else card_label,
            transaction_date=d, payment_date=payment or d, description=desc, raw_description=desc,
            amount=amount, direction=direction, source_line=line,
            installment_current=inst[0] if inst else None,
            installment_total=inst[1] if inst else None,
            dedupe_key=_key("dd", line, desc, d, amount),
            natural_dedupe_key=_key("nat", line, desc, d, amount),
        ))
        if category is not None and not skip_assignment:
            assignments.append((tid, category))
        return tid

    # ----- credit cards + monthly statements -----
    visa = _uid()
    master = _uid()
    db.add(CreditCard(id=visa, workspace_id=WS, name="Visa Família", issuer="Banco Azul",
                      brand="visa", last_four="4321", color="#1d4ed8", closing_day=3, due_day=10,
                      limit_amount=Decimal("12000.00")))
    db.add(CreditCard(id=master, workspace_id=WS, name="Master Reserva", issuer="Banco Azul",
                      brand="mastercard", last_four="8765", color="#7c3aed", closing_day=3, due_day=10,
                      limit_amount=Decimal("8000.00")))
    counts["credit_cards"] = 2

    # Installment plans: (desc, monthly value, first invoice month index, n months, category)
    months = _months()
    plans = [
        ("MAGAZINELUIZA GELADEIRA", Decimal("329.90"), 3, 10, c_moradia),
        ("NOTEBOOK DELL BR", Decimal("412.50"), 7, 12, c_educacao),
        ("SOFA MADEIRAMADEIRA", Decimal("289.00"), 10, 6, c_moradia),
    ]

    statements: list[tuple[date, Decimal]] = []  # (due_date, total) for fatura payments
    for mi, month in enumerate(months):
        # invoice due on the 10th of the FOLLOWING month; purchases during `month`
        due = date(month.year + (month.month == 12), month.month % 12 + 1, 10)
        stamp = f"{due.year}{due.month:02d}{due.day:02d}"

        visa_sf, visa_job = source(f"fatura_visa4321_{stamp}.csv", "credit_card_csv")
        total = Decimal("0")

        def card_tx(d: date, desc: str, amount: Decimal, category: str | None,
                    _sf: str = visa_sf, _job: str = visa_job, _due: date = due, **kw) -> None:
            nonlocal total
            total += amount
            tx(d, desc, amount, "debit", source_type="credit_card_statement",
               sf=_sf, job=_job, category=category, payment=_due,
               card_label="Visa Família •4321", **kw)

        def day(lo: int = 1, hi: int = 28, _month: date = month) -> date:
            return _month.replace(day=rng.randint(lo, hi))

        for _ in range(4):
            card_tx(day(), f"SUPERMERCADO {rng.choice(['PAO DE ACUCAR', 'CARREFOUR', 'DIA %'])}",
                    _amount(180, 560), c_mercado)
        for _ in range(3):
            card_tx(day(), rng.choice(["RESTAURANTE CANTINA ROMA", "CHURRASCARIA BOI NA BRASA",
                                       "PADARIA ESTRELA"]), _amount(60, 220), c_restaurantes)
        for _ in range(4):
            card_tx(day(), "IFOOD *RESTAURANTE", _amount(42, 130), c_restaurantes)
        for _ in range(3):
            card_tx(day(), rng.choice(["POSTO SHELL", "POSTO IPIRANGA"]), _amount(160, 280), c_combustivel)
        for _ in range(3):
            card_tx(day(), "UBER *TRIP", _amount(14, 48), c_apps)
        for _ in range(2):
            card_tx(day(), rng.choice(["DROGARIA SP", "DROGASIL"]), _amount(45, 190), c_saude)
        card_tx(day(3, 6), "NETFLIX.COM", Decimal("55.90"), c_lazer)
        card_tx(day(3, 6), "SPOTIFY", Decimal("34.90"), c_lazer)
        if rng.random() < 0.7:
            card_tx(day(), "AMAZON BR MARKETPLACE", _amount(70, 420), c_lazer)
        if rng.random() < 0.5:
            card_tx(day(), rng.choice(["RENNER", "C&A MODAS", "CENTAURO"]), _amount(120, 460), c_vestuario)
        # installments purchased in earlier months land on this invoice
        for desc, value, first, n, cat_id in plans:
            k = mi - first
            if 0 <= k < n:
                purchase = months[first].replace(day=rng.randint(2, 20))
                card_tx(purchase, f"{desc} {k + 1:02d}/{n:02d}", value, cat_id, inst=(k + 1, n))

        db.add(CreditCardStatement(
            id=_uid(), workspace_id=WS, credit_card_id=visa, source_file_id=visa_sf,
            statement_month=month, closing_date=due.replace(day=3), due_date=due,
            total_amount=total, status="paid" if due <= TODAY else "closed",
        ))
        statements.append((due, total))

    counts["statements"] = len(months)

    # A couple of Master purchases per month (kept small; no statement rows).
    master_sf, master_job = source("fatura_master8765_demo.csv", "credit_card_csv")
    for month in months:
        due = date(month.year + (month.month == 12), month.month % 12 + 1, 10)
        for _ in range(2):
            tx(month.replace(day=rng.randint(2, 27)), "MERCADOLIVRE*COMPRA",
               _amount(40, 240), "debit", source_type="credit_card_statement",
               sf=master_sf, job=master_job, category=c_lazer, payment=due,
               card_label="Master Reserva •8765")

    # ----- bank flow per month -----
    balance = Decimal("14500.00")
    for mi, month in enumerate(months):
        tx(month.replace(day=5), "FOLHA PAGAMENTO TECHBRASIL LTDA", Decimal("9400.00"), "credit", category=c_salario)
        tx(month.replace(day=1), "PIX SALARIO ESTUDIO CRIATIVO", Decimal("4800.00"), "credit", category=c_salario)
        if rng.random() < 0.4:
            tx(month.replace(day=rng.randint(10, 25)), "PIX RECEBIDO PROJETO FREELANCE",
               _amount(600, 2400), "credit", category=c_freela)
        tx(month.replace(day=8), "FINANC IMOBILIARIO BANCO AZUL", Decimal("-2350.00"), "debit", category=c_financiamento)
        tx(month.replace(day=10), "CONDOMINIO ED PRIMAVERA", Decimal("-720.00"), "debit", category=c_condominio)
        tx(month.replace(day=12), "ENEL ENERGIA ELETRICA", -_amount(160, 340), "debit", category=c_energia)
        tx(month.replace(day=15), "VIVO FIBRA INTERNET", Decimal("-129.90"), "debit", category=c_internet)
        tx(month.replace(day=7), "COLEGIO HORIZONTE MENSALIDADE", Decimal("-1650.00"), "debit", category=c_educacao)
        tx(month.replace(day=20), "UNIMED PLANO SAUDE FAMILIA", Decimal("-890.00"), "debit", category=c_saude)
        # invoice payment for last month's visa statement
        due, total = statements[mi]
        if due <= TODAY:
            tx(due, "PAGAMENTO FATURA VISA FINAL 4321", -total, "payment")
        # goal contribution (transfer to savings)
        gid = tx(month.replace(day=6), "APLICACAO CDB RESERVA FAMILIA", Decimal("-800.00"), "debit", category=c_receita, skip_assignment=True)
        goal_txs.append(gid)

        # seasonal events
        if month.month == 12:
            tx(month.replace(day=18), "13 SALARIO TECHBRASIL", Decimal("9400.00"), "credit", category=c_salario)
        if month.month == 1:
            tx(month.replace(day=14), "IPVA 2026 COTA UNICA", Decimal("-1840.00"), "debit", category=c_impostos)
        if month.month == 2:
            tx(month.replace(day=10), "IPTU PARCELA UNICA", Decimal("-980.00"), "debit", category=c_impostos)
        if month.month == 8:
            tx(month.replace(day=22), "SEGURO AUTO PORTO ANUAL", Decimal("-1290.00"), "debit", category=c_transporte)

        # monthly account balance snapshot
        month_income = Decimal("14200.00")
        month_out = Decimal(str(round(rng.uniform(11200, 13600), 2)))
        balance += month_income - month_out
        db.add(AccountBalance(
            id=_uid(), workspace_id=WS, source_file_id=bank_sf, import_job_id=bank_job,
            account_name="Conta Corrente Banco Azul", balance_date=month.replace(day=28),
            balance_amount=balance.quantize(Decimal("0.01")), source_line=9000 + mi,
            raw_payload={"demo": True},
        ))

    # Current partial month (jul/2026): salary + a few debits, no closed invoice.
    tx(date(2026, 7, 1), "PIX SALARIO ESTUDIO CRIATIVO", Decimal("4800.00"), "credit", category=c_salario)
    tx(date(2026, 7, 2), "FINANC IMOBILIARIO BANCO AZUL", Decimal("-2350.00"), "debit", category=c_financiamento)
    # a handful left uncategorized so the review flow has something to show
    for d, desc, val in [
        (date(2026, 6, 26), "PIX TRANSF MARIA F", Decimal("-180.00")),
        (date(2026, 6, 28), "COMPRA DEB LOJA DO BAIRRO", Decimal("-96.40")),
        (date(2026, 7, 1), "PIX TRANSF JOAO P", Decimal("-250.00")),
        (date(2026, 7, 2), "TED RECEBIDA CONSULTORIA", Decimal("1200.00")),
    ]:
        tx(d, desc, val, "credit" if val > 0 else "debit")

    db.add_all(tx_rows)
    db.flush()
    counts["transactions"] = len(tx_rows)

    for tid, cid in assignments:
        db.add(TransactionCategoryAssignment(
            id=_uid(), workspace_id=WS, transaction_id=tid, category_id=cid,
            source="rule", confidence=Decimal("0.9500"), review_status="accepted",
        ))
    counts["assignments"] = len(assignments)

    # ----- goals (contributions linked to the monthly CDB transfer) -----
    g_reserva = Goal(
        id=_uid(), workspace_id=WS, name="Reserva de emergência",
        description="6 meses de custo fixo da família", target_amount=Decimal("36000.00"),
        current_amount=Decimal("800.00") * len(goal_txs), tracking_mode="contributions",
        aporte_match_text="CDB RESERVA", color="#0e7a45",
    )
    g_viagem = Goal(
        id=_uid(), workspace_id=WS, name="Viagem em família",
        description="Férias de janeiro na praia", target_amount=Decimal("12000.00"),
        current_amount=Decimal("4200.00"), target_date=date(2027, 1, 15), color="#3567b8",
    )
    db.add_all([g_reserva, g_viagem])
    for tid in goal_txs:
        db.execute(update(Transaction).where(Transaction.id == tid).values(goal_id=g_reserva.id))
    counts["goals"] = 2

    # ----- budgets -----
    for name, cat_id, limit in [
        ("Alimentação do mês", c_alimentacao, Decimal("2800.00")),
        ("Lazer e assinaturas", c_lazer, Decimal("900.00")),
        ("Transporte", c_transporte, Decimal("1200.00")),
    ]:
        db.add(Budget(id=_uid(), workspace_id=WS, category_id=cat_id, name=name,
                      period_start=date(2026, 7, 1), recurring=True, limit_amount=limit))
    counts["budgets"] = 3
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.environ.get("SEED_DATABASE_URL", ""))
    parser.add_argument("--yes", action="store_true", help="required to run against non-SQLite")
    parser.add_argument("--create-tables", action="store_true", help="create schema first (SQLite smoke test)")
    args = parser.parse_args()

    url = normalize_database_url(args.database_url)
    if not url:
        raise SystemExit("pass --database-url or set SEED_DATABASE_URL")
    is_sqlite = url.startswith("sqlite")
    if not is_sqlite and not args.yes:
        raise SystemExit("refusing to touch a non-SQLite database without --yes")

    engine = create_engine(url)
    if args.create_tables:
        Base.metadata.create_all(engine)
        with Session(engine) as boot:
            if boot.get(Workspace, WS) is None:
                # Same identity the app itself bootstraps for the local-dev token
                # (lookup is by supabase_user_id == auth.user_id).
                boot.add(User(id=USER, supabase_user_id=USER, email="local@example.invalid",
                              display_name=DEMO_USER_NAME))
                boot.add(Workspace(id=WS, name=DEMO_WORKSPACE_NAME))
                boot.add(WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WS, user_id=USER, role="owner"))
                boot.commit()

    SessionLocal = sessionmaker(bind=engine)
    with SessionLocal() as db:
        wipe(db)
        counts = seed(db)
        db.commit()
    host = url.split("@")[-1].split("/")[0] if "@" in url else url
    print(f"seeded demo data on {host}:")
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
