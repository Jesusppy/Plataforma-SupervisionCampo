from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.report import Report


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_project(self, project_id: UUID) -> list[Report]:
        statement = (
            select(Report)
            .options(selectinload(Report.template))
            .where(Report.project_id == project_id)
            .order_by(Report.created_at.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, report_id: UUID) -> Report | None:
        statement = (
            select(Report)
            .options(selectinload(Report.project), selectinload(Report.template))
            .where(Report.id == report_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def add(self, report: Report) -> Report:
        self.session.add(report)
        await self.session.flush()
        await self.session.refresh(report)
        return report
