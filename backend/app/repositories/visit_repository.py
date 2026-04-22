from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.visit import Visit


class VisitRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_project(self, project_id: UUID) -> list[Visit]:
        statement = (
            select(Visit)
            .options(selectinload(Visit.attachments))
            .where(Visit.project_id == project_id)
            .order_by(Visit.visited_at.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, visit_id: UUID) -> Visit | None:
        statement = (
            select(Visit)
            .options(selectinload(Visit.attachments))
            .where(Visit.id == visit_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def add(self, visit: Visit) -> Visit:
        self.session.add(visit)
        await self.session.flush()
        await self.session.refresh(visit)
        return visit
