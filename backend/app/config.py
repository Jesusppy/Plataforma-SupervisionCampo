from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Plataforma de Supervision de Campo API"
    environment: Literal["local", "development", "staging", "production"] = "local"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "supervision_user"
    postgres_password: str = "supervision_password"
    postgres_db: str = "supervision_campo"

    minio_endpoint: str = "localhost:9000"
    minio_public_endpoint: str | None = None
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_secure: bool = False
    minio_region: str = "us-east-1"
    minio_attachments_bucket: str = "field-attachments"
    minio_reports_bucket: str = "report-exports"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-pro"
    gemini_transcription_model: str = "gemini-2.5-flash"
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com"
    use_mock_llm: bool = False

    jwt_secret_key: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    jwt_access_token_ttl_minutes: int = 60 * 24

    export_brand_color: str = "#0f172a"
    export_accent_color: str = "#0891b2"

    @property
    def database_url(self) -> str:
        return (
            "postgresql+asyncpg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def s3_endpoint_url(self) -> str:
        protocol = "https" if self.minio_secure else "http"
        return f"{protocol}://{self.minio_endpoint}"

    @property
    def s3_public_endpoint_url(self) -> str:
        protocol = "https" if self.minio_secure else "http"
        endpoint = self.minio_public_endpoint or self.minio_endpoint
        return f"{protocol}://{endpoint}"

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
