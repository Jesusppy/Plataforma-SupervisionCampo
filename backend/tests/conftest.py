from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator

import httpx
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-suite-jwt-secret-with-32-plus-characters",
)
os.environ.setdefault("USE_MOCK_LLM", "true")

from app.config import get_settings
from app.database import get_db
from app.main import create_application
from app.models import Base
from app.services.export_service import get_export_service
from app.services.storage_service import get_storage_service


class StubStorageService:
    async def generate_presigned_url(
        self,
        *,
        bucket_name: str,
        object_key: str,
        expires_in_seconds: int = 3600,
    ) -> str:
        return f"https://signed.local/{bucket_name}/{object_key}?expires={expires_in_seconds}"


class StubExportService:
    def render_html(self, context) -> str:
        return f"<html><body><h1>{context.title}</h1></body></html>"

    def render_pdf(self, context) -> bytes:
        return f"PDF:{context.title}".encode("utf-8")


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or get_settings().database_url


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    schema_name = f"test_security_{uuid.uuid4().hex}"
    admin_engine = create_async_engine(
        TEST_DATABASE_URL,
        pool_pre_ping=True,
        poolclass=NullPool,
    )
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        pool_pre_ping=True,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": schema_name}},
    )

    async with admin_engine.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    app = create_application()
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage_service] = lambda: StubStorageService()
    app.dependency_overrides[get_export_service] = lambda: StubExportService()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as async_client:
        yield async_client

    app.dependency_overrides.clear()
    await test_engine.dispose()
    async with admin_engine.begin() as connection:
        await connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
    await admin_engine.dispose()