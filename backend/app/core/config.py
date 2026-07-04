from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    log_level: str = "INFO"
    database_url: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "financial-files"
    # Amazon Cognito (preferred auth provider on AWS). When the user pool is
    # configured, bearer tokens are validated as Cognito ID tokens (RS256/JWKS).
    cognito_region: str = Field(default="", alias="COGNITO_REGION")
    cognito_user_pool_id: str = Field(default="", alias="COGNITO_USER_POOL_ID")
    cognito_app_client_id: str = Field(default="", alias="COGNITO_APP_CLIENT_ID")
    allow_local_auth: bool = Field(default=False, alias="ALLOW_LOCAL_AUTH")
    # How import jobs are processed after upload: "" → auto (Lambda self-invoke
    # on AWS, background thread elsewhere); "inline" forces synchronous
    # processing in the caller's session (tests).
    import_worker_mode: str = Field(default="", alias="IMPORT_WORKER_MODE")
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_recycle_seconds: int = 300
    default_credit_card_closing_day: int = Field(default=23, ge=1, le=31)
    default_credit_card_due_day: int = Field(default=30, ge=1, le=31)
    gemini_api_key: str = ""
    # LLM categorization provider. "" → auto-detect (groq if GROQ_API_KEY set,
    # else gemini if GEMINI_API_KEY set). Otherwise force "groq" or "gemini".
    llm_provider: str = Field(default="", alias="LLM_PROVIDER")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    cors_origins_raw: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5174,http://127.0.0.1:5174,"
            "http://localhost:5175,http://127.0.0.1:5175,"
            "http://localhost:5176,http://127.0.0.1:5176,"
            "http://localhost:5177,http://127.0.0.1:5177,"
            "http://localhost:5178,http://127.0.0.1:5178,"
            "http://localhost:5179,http://127.0.0.1:5179,"
            "http://localhost:5180,http://127.0.0.1:5180"
        ),
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
