from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.user import User
from app.models.visit import Visit
from app.schemas.project import ProjectCreate, ProjectDetail, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


async def _get_project_or_404(
    session: AsyncSession,
    project_id: UUID,
    *,
    include_relations: bool = False,
) -> Project:
    statement = select(Project).where(Project.id == project_id)
    if include_relations:
        statement = statement.options(
            selectinload(Project.visits).selectinload(Visit.attachments),
            selectinload(Project.reports),
        )

    result = await session.execute(statement)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado.",
        )
    return project


@router.get("", response_model=list[ProjectRead], summary="Lista los proyectos")
async def list_projects(session: AsyncSession = Depends(get_db)) -> list[Project]:
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un proyecto",
)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Project:
    project = Project(name=payload.name, description=payload.description)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


@router.get(
    "/{project_id}",
    response_model=ProjectDetail,
    summary="Obtiene el detalle de un proyecto",
)
async def get_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Project:
    return await _get_project_or_404(session, project_id, include_relations=True)


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Actualiza un proyecto",
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: AsyncSession = Depends(get_db),
) -> Project:
    project = await _get_project_or_404(session, project_id)
    update_data = payload.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        setattr(project, field_name, value)

    await session.commit()
    await session.refresh(project)
    return project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un proyecto",
)
async def delete_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Response:
    project = await _get_project_or_404(session, project_id)
    await session.delete(project)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
