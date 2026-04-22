from __future__ import annotations

from pydantic import ConfigDict, Field

from app.schemas.common import SchemaModel, TimestampedModel
from app.schemas.report import ReportRead
from app.schemas.visit import VisitRead


class ProjectBase(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    model_config = ConfigDict(from_attributes=True)


class ProjectUpdate(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = None
    description: str | None = None


class ProjectRead(ProjectBase, TimestampedModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectDetail(ProjectRead):
    model_config = ConfigDict(from_attributes=True)

    visits: list[VisitRead] = Field(default_factory=list)
    reports: list[ReportRead] = Field(default_factory=list)
