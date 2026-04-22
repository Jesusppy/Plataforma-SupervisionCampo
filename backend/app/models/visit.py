from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.project import Project


class Visit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "visits"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_context: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Texto adicional consolidado a partir de transcripciones o analisis posteriores.",
    )

    project: Mapped["Project"] = relationship(back_populates="visits")
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
