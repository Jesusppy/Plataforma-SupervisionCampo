from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.models.report import ReportStatus
from app.schemas.common import SchemaModel, TimestampedModel


class ReportBase(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    template_id: UUID | None = None
    llm_model: str | None = None
    source_visit_ids: list[str] = Field(default_factory=list)
    content_markdown: str | None = None
    content_html: str | None = None
    exported_pdf_url: str | None = None
    exported_html_url: str | None = None
    error_message: str | None = None
    generated_at: datetime | None = None


class ReportCreate(ReportBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID
    status: ReportStatus = ReportStatus.DRAFT


class ReportUpdate(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    template_id: UUID | None = None
    status: ReportStatus | None = None
    llm_model: str | None = None
    source_visit_ids: list[str] | None = None
    content_markdown: str | None = None
    content_html: str | None = None
    exported_pdf_url: str | None = None
    exported_html_url: str | None = None
    error_message: str | None = None
    generated_at: datetime | None = None


class ReportRead(ReportBase, TimestampedModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID
    status: ReportStatus


class ReportGenerateRequest(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID
    template_id: UUID
    title: str
    source_visit_ids: list[str] = Field(default_factory=list)
