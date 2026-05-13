from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import normalize_database_url, settings
from app.db.models import Base


def _database_url() -> str:
    return normalize_database_url(settings.database_url) or "sqlite:///./smart_cash_flow.db"


engine = create_engine(
    _database_url(),
    connect_args={"check_same_thread": False} if _database_url().startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def create_local_tables() -> None:
    if settings.app_env == "local":
        Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
