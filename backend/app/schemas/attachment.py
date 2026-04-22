from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict

from app.models.attachment import AttachmentType
from app.schemas.common import SchemaModel


class AttachmentBase(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    attachment_type: AttachmentType
    file_name: str
    object_key: str
    bucket_name: str
    file_url: str
    content_type: str
    extracted_text: str | None = None


class AttachmentCreate(AttachmentBase):
    model_config = ConfigDict(from_attributes=True)

    visit_id: UUID


class AttachmentUpdate(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    file_name: str | None = None
    extracted_text: str | None = None
    file_url: str | None = None


class AttachmentRead(AttachmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    visit_id: UUID
    uploaded_at: datetime
