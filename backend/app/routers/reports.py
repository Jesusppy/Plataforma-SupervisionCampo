from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.attachment import AttachmentType
from app.models.project import Project
from app.models.report import Report, ReportStatus
from app.models.template import Template
from app.models.user import User
from app.models.visit import Visit
from app.schemas.report import ReportCreate, ReportGenerateRequest, ReportRead, ReportUpdate
from app.services.export_service import (
    ExportService,
    PhotoReference,
    build_render_context,
    get_export_service,
)
from app.services.gemini_service import GenerationAsset, GeminiService, get_gemini_service
from app.services.storage_service import StorageService, get_storage_service

router = APIRouter(prefix="/reports", tags=["reports"])


async def _get_report_or_404(
    session: AsyncSession,
    report_id: UUID,
    current_user: User,
    *,
    include_relations: bool = False,
) -> Report:
    statement = select(Report).join(Project).where(
        Report.id == report_id,
        Project.user_id == current_user.id,
    )
    if include_relations:
        statement = statement.options(
            selectinload(Report.template),
            selectinload(Report.project),
        )

    result = await session.execute(statement)
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte no encontrado.",
        )
    return report


async def _ensure_project_exists(
    session: AsyncSession,
    project_id: UUID,
    current_user: User,
) -> None:
    result = await session.execute(
        select(Project.id).where(
            Project.id == project_id,
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto indicado no existe.",
        )


async def _ensure_template_exists(
    session: AsyncSession,
    template_id: UUID | None,
    current_user: User,
) -> Template | None:
    if template_id is None:
        return None

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
            detail="La plantilla indicada no existe.",
        )
    return template


@router.get("", response_model=list[ReportRead], summary="Lista los reportes")
async def list_reports(
    project_id: UUID | None = None,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Report]:
    statement = (
        select(Report)
        .join(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Report.created_at.desc())
    )
    if project_id is not None:
        statement = statement.where(Report.project_id == project_id)

    result = await session.execute(statement)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un reporte",
)
async def create_report(
    payload: ReportCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Report:
    await _ensure_project_exists(session, payload.project_id, current_user)
    await _ensure_template_exists(session, payload.template_id, current_user)

    report = Report(**payload.model_dump())
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


@router.get(
    "/{report_id}",
    response_model=ReportRead,
    summary="Obtiene un reporte por identificador",
)
async def get_report(
    report_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Report:
    return await _get_report_or_404(session, report_id, current_user)


@router.put(
    "/{report_id}",
    response_model=ReportRead,
    summary="Actualiza un reporte",
)
async def update_report(
    report_id: UUID,
    payload: ReportUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Report:
    report = await _get_report_or_404(session, report_id, current_user)
    if payload.template_id is not None:
        await _ensure_template_exists(session, payload.template_id, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(report, field_name, value)

    await session.commit()
    await session.refresh(report)
    return report


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un reporte",
)
async def delete_report(
    report_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    report = await _get_report_or_404(session, report_id, current_user)
    await session.delete(report)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/generate-draft",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
    summary="Genera un borrador de reporte con Gemini",
)
async def generate_report_draft(
    payload: ReportGenerateRequest,
    session: AsyncSession = Depends(get_db),
    gemini_service: GeminiService = Depends(get_gemini_service),
    storage_service: StorageService = Depends(get_storage_service),
    current_user: User = Depends(get_current_user),
) -> Report:
    await _ensure_project_exists(session, payload.project_id, current_user)
    template = await _ensure_template_exists(session, payload.template_id, current_user)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La plantilla requerida no existe.",
        )

    statement = (
        select(Visit)
        .options(selectinload(Visit.attachments))
        .where(Visit.project_id == payload.project_id)
        .order_by(Visit.visited_at.asc())
    )
    if payload.source_visit_ids:
        statement = statement.where(Visit.id.in_([UUID(value) for value in payload.source_visit_ids]))

    result = await session.execute(statement)
    visits = list(result.scalars().all())
    if not visits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No existen visitas para generar el reporte solicitado.",
        )

    visit_notes = [
        "\n".join(
            part
            for part in [
                f"Visita: {visit.visited_at.isoformat()}",
                visit.notes,
                visit.ai_context or "",
            ]
            if part
        )
        for visit in visits
    ]

    assets: list[GenerationAsset] = []
    for visit in visits:
        for attachment in visit.attachments:
            file_uri = await storage_service.generate_presigned_url(
                bucket_name=attachment.bucket_name,
                object_key=attachment.object_key,
            )
            assets.append(
                GenerationAsset(
                    mime_type=attachment.content_type,
                    uri=file_uri,
                    file_name=attachment.file_name,
                    extracted_text=attachment.extracted_text,
                )
            )

    generated_markdown = await gemini_service.generate_report_draft(
        template_name=template.name,
        template_structure=template.sections,
        tone=template.tone,
        instructions=template.instructions,
        visit_notes=visit_notes,
        assets=assets,
    )

    report = Report(
        project_id=payload.project_id,
        template_id=payload.template_id,
        title=payload.title,
        status=ReportStatus.GENERATED,
        llm_model=gemini_service.settings.gemini_model,
        source_visit_ids=payload.source_visit_ids or [str(visit.id) for visit in visits],
        content_markdown=generated_markdown,
        generated_at=datetime.now(tz=UTC),
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def _collect_photos_for_report(
    session: AsyncSession,
    report: Report,
    storage_service: StorageService,
) -> list[PhotoReference]:
    visit_ids_raw = report.source_visit_ids or []
    try:
        visit_ids = [UUID(value) for value in visit_ids_raw]
    except (TypeError, ValueError):
        visit_ids = []

    if not visit_ids:
        statement = (
            select(Visit)
            .options(selectinload(Visit.attachments))
            .where(Visit.project_id == report.project_id)
        )
    else:
        statement = (
            select(Visit)
            .options(selectinload(Visit.attachments))
            .where(
                Visit.project_id == report.project_id,
                Visit.id.in_(visit_ids),
            )
        )

    result = await session.execute(statement)
    visits = list(result.scalars().all())

    photos: list[PhotoReference] = []
    for visit in visits:
        label = f"Visita {visit.visited_at.strftime('%Y-%m-%d')}"
        for attachment in visit.attachments:
            if attachment.attachment_type != AttachmentType.PHOTO:
                continue
            signed_url = await storage_service.generate_presigned_url(
                bucket_name=attachment.bucket_name,
                object_key=attachment.object_key,
            )
            photos.append(
                PhotoReference(
                    file_name=attachment.file_name,
                    image_url=signed_url,
                    visit_label=label,
                )
            )
    return photos


@router.get(
    "/{report_id}/export",
    summary="Exporta un reporte a PDF o HTML",
    response_class=Response,
)
async def export_report(
    report_id: UUID,
    format: Literal["pdf", "html"] = Query(default="pdf"),
    session: AsyncSession = Depends(get_db),
    export_service: ExportService = Depends(get_export_service),
    storage_service: StorageService = Depends(get_storage_service),
    current_user: User = Depends(get_current_user),
) -> Response:
    report = await _get_report_or_404(
        session,
        report_id,
        current_user,
        include_relations=True,
    )

    if not report.content_markdown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El reporte todavía no tiene contenido generado.",
        )

    photos = await _collect_photos_for_report(session, report, storage_service)
    template = report.template
    project = report.project

    context = build_render_context(
        title=report.title,
        project_name=project.name if project else "Proyecto",
        template_name=template.name if template else None,
        template_sections=list(template.sections) if template else [],
        tone=template.tone if template else None,
        content_markdown=report.content_markdown,
        photos=photos,
        generated_at=report.generated_at,
    )

    safe_title = report.title.replace(" ", "_").replace("/", "-")

    if format == "html":
        html_document = export_service.render_html(context)
        report.exported_html_url = None
        return HTMLResponse(
            content=html_document,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_title}.html"',
            },
        )

    pdf_bytes = export_service.render_pdf(context)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_title}.pdf"',
        },
    )
