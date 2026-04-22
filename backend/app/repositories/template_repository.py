from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import Template


class TemplateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active(self) -> list[Template]:
        statement = (
            select(Template)
            .where(Template.is_active.is_(True))
            .order_by(Template.created_at.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, template_id: UUID) -> Template | None:
        statement = select(Template).where(Template.id == template_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def add(self, template: Template) -> Template:
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)
        return template
