from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[Project]:
        statement = select(Project).order_by(Project.created_at.desc())
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, project_id: UUID) -> Project | None:
        statement = (
            select(Project)
            .options(selectinload(Project.visits), selectinload(Project.reports))
            .where(Project.id == project_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def add(self, project: Project) -> Project:
        self.session.add(project)
        await self.session.flush()
        await self.session.refresh(project)
        return project
