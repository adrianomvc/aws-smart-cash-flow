from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "local"
    log_level: str = "INFO"
    database_url: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_storage_bucket: str = "financial-files"
    allow_local_auth: bool = Field(default=False, alias="ALLOW_LOCAL_AUTH")
    database_pool_size: int = 1
    database_max_overflow: int = 2
    database_pool_recycle_seconds: int = 300
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_non_local_settings(self) -> "Settings":
        if self.app_env != "local":
            missing = [
                name
                for name, value in {
                    "DATABASE_URL": self.database_url,
                }.items()
                if not value
            ]
            if missing:
                raise ValueError(f"Missing required settings: {', '.join(missing)}")
            if "*" in self.cors_origins:
                raise ValueError("Wildcard CORS origin is not allowed outside local env")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
