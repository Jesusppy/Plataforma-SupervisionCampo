from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.attachment import AttachmentRead
from app.schemas.common import SchemaModel, TimestampedModel


class VisitBase(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    visited_at: datetime
    notes: str
    ai_context: str | None = None


class VisitCreate(VisitBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID


class VisitUpdate(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    visited_at: datetime | None = None
    notes: str | None = None
    ai_context: str | None = None


class VisitRead(VisitBase, TimestampedModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID
    attachments: list[AttachmentRead] = Field(default_factory=list)
