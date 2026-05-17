from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import normalize_database_url, settings
from app.db.models import Base


def _database_url() -> str:
    return normalize_database_url(settings.database_url) or "sqlite:///./smart_cash_flow.db"


database_url = _database_url()
engine_options = {
    "connect_args": {"check_same_thread": False} if database_url.startswith("sqlite") else {},
    "pool_pre_ping": True,
}
if not database_url.startswith("sqlite"):
    engine_options.update(
        {
            "pool_recycle": settings.database_pool_recycle_seconds,
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
        }
    )

engine = create_engine(database_url, **engine_options)
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
