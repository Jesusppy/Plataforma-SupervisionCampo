from __future__ import annotations

import os
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.attachment import Attachment, AttachmentType
from app.models.project import Project
from app.models.user import User
from app.models.visit import Visit
from app.schemas.attachment import AttachmentCreate, AttachmentRead
from app.schemas.visit import VisitCreate, VisitRead, VisitUpdate
from app.services.storage_service import StorageService, get_storage_service

settings = get_settings()

router = APIRouter(prefix="/visits", tags=["visits"])


async def _get_visit_or_404(session: AsyncSession, visit_id: UUID) -> Visit:
    result = await session.execute(
        select(Visit)
        .options(selectinload(Visit.attachments))
        .where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if visit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visita no encontrada.",
        )
    return visit


async def _ensure_project_exists(session: AsyncSession, project_id: UUID) -> None:
    result = await session.execute(select(Project.id).where(Project.id == project_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto asociado no existe.",
        )


@router.get("", response_model=list[VisitRead], summary="Lista las visitas")
async def list_visits(
    project_id: UUID | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[Visit]:
    statement = select(Visit).options(selectinload(Visit.attachments))
    if project_id is not None:
        statement = statement.where(Visit.project_id == project_id)

    result = await session.execute(statement.order_by(Visit.visited_at.desc()))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=VisitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una visita",
)
async def create_visit(
    payload: VisitCreate,
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Visit:
    await _ensure_project_exists(session, payload.project_id)

    visit = Visit(
        project_id=payload.project_id,
        visited_at=payload.visited_at,
        notes=payload.notes,
        ai_context=payload.ai_context,
    )
    session.add(visit)
    await session.commit()
    await session.refresh(visit)
    return await _get_visit_or_404(session, visit.id)


@router.get(
    "/{visit_id}",
    response_model=VisitRead,
    summary="Obtiene una visita por identificador",
)
async def get_visit(
    visit_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Visit:
    return await _get_visit_or_404(session, visit_id)


@router.put(
    "/{visit_id}",
    response_model=VisitRead,
    summary="Actualiza una visita",
)
async def update_visit(
    visit_id: UUID,
    payload: VisitUpdate,
    session: AsyncSession = Depends(get_db),
) -> Visit:
    visit = await _get_visit_or_404(session, visit_id)
    update_data = payload.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        setattr(visit, field_name, value)

    await session.commit()
    return await _get_visit_or_404(session, visit_id)


@router.delete(
    "/{visit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una visita",
)
async def delete_visit(
    visit_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Response:
    visit = await _get_visit_or_404(session, visit_id)
    await session.delete(visit)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{visit_id}/attachments",
    response_model=AttachmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registra un adjunto para una visita",
)
async def create_attachment(
    visit_id: UUID,
    payload: AttachmentCreate,
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Attachment:
    await _get_visit_or_404(session, visit_id)
    if payload.visit_id != visit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El visit_id del cuerpo no coincide con la ruta.",
        )

    attachment = Attachment(**payload.model_dump())
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    return attachment


@router.delete(
    "/{visit_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un adjunto de una visita",
)
async def delete_attachment(
    visit_id: UUID,
    attachment_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Response:
    await _get_visit_or_404(session, visit_id)
    result = await session.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.visit_id == visit_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado para la visita indicada.",
        )

    await session.delete(attachment)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{visit_id}/attachments/upload",
    response_model=AttachmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Sube un adjunto a MinIO y lo registra en la visita",
)
async def upload_attachment(
    visit_id: UUID,
    attachment_type: AttachmentType = Form(...),
    file: UploadFile = File(...),
    extracted_text: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db),
    storage_service: StorageService = Depends(get_storage_service),
    _current_user: User = Depends(get_current_user),
) -> Attachment:
    await _get_visit_or_404(session, visit_id)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo enviado no contiene nombre.",
        )

    extension = os.path.splitext(file.filename)[1]
    object_key = f"visits/{visit_id}/{uuid.uuid4()}{extension}"
    stored_object = await storage_service.upload_file(
        bucket_name=settings.minio_attachments_bucket,
        object_key=object_key,
        file_stream=file.file,
        content_type=file.content_type or "application/octet-stream",
    )

    attachment = Attachment(
        visit_id=visit_id,
        attachment_type=attachment_type,
        file_name=file.filename,
        object_key=stored_object.object_key,
        bucket_name=stored_object.bucket_name,
        file_url=stored_object.file_url,
        content_type=stored_object.content_type,
        extracted_text=extracted_text,
    )
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    await file.close()
    return attachment
