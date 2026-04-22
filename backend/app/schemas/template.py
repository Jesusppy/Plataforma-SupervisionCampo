from __future__ import annotations

from typing import Any

from pydantic import ConfigDict, Field

from app.schemas.common import SchemaModel, TimestampedModel


class TemplateBase(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: str | None = None
    tone: str
    sections: list[dict[str, Any]] = Field(default_factory=list)
    instructions: str | None = None
    is_active: bool


class TemplateCreate(TemplateBase):
    model_config = ConfigDict(from_attributes=True)


class TemplateUpdate(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = None
    description: str | None = None
    tone: str | None = None
    sections: list[dict[str, Any]] | None = None
    instructions: str | None = None
    is_active: bool | None = None


class TemplateRead(TemplateBase, TimestampedModel):
    model_config = ConfigDict(from_attributes=True)
