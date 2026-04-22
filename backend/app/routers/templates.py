from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.template import Template
from app.models.user import User
from app.schemas.template import TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


async def _get_template_or_404(
    session: AsyncSession,
    template_id: UUID,
    current_user: User,
) -> Template:
    result = await session.execute(
        select(Template).where(
            Template.id == template_id,
            Template.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada.",
        )
    return template


@router.get("", response_model=list[TemplateRead], summary="Lista las plantillas")
async def list_templates(
    only_active: bool = False,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Template]:
    statement = select(Template).where(Template.user_id == current_user.id)
    if only_active:
        statement = statement.where(Template.is_active.is_(True))

    result = await session.execute(statement.order_by(Template.created_at.desc()))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=TemplateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una plantilla",
)
async def create_template(
    payload: TemplateCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Template:
    template = Template(user_id=current_user.id, **payload.model_dump())
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


@router.get(
    "/{template_id}",
    response_model=TemplateRead,
    summary="Obtiene una plantilla por identificador",
)
async def get_template(
    template_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Template:
    return await _get_template_or_404(session, template_id, current_user)


@router.put(
    "/{template_id}",
    response_model=TemplateRead,
    summary="Actualiza una plantilla",
)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Template:
    template = await _get_template_or_404(session, template_id, current_user)
    update_data = payload.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        setattr(template, field_name, value)

    await session.commit()
    await session.refresh(template)
    return template


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una plantilla",
)
async def delete_template(
    template_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    template = await _get_template_or_404(session, template_id, current_user)
    await session.delete(template)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
