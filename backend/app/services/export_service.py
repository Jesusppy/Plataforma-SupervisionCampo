"""Servicio de exportación de reportes a HTML y PDF.

Convierte el ``content_markdown`` del reporte a un HTML con estilos limpios y,
opcionalmente, lo renderiza como PDF usando ``xhtml2pdf`` (puro Python, sin
dependencias del sistema operativo como GTK/Cairo). Incluye cabecera de marca
y una sección con las fotos de la visita cuando la plantilla las declara.
"""

from __future__ import annotations

import html as html_stdlib
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from typing import Any, Iterable

import markdown as markdown_lib
from fastapi import HTTPException, status
from xhtml2pdf import pisa

from app.config import Settings, get_settings


@dataclass(slots=True)
class PhotoReference:
    """Representa la URL pública/firmada de una foto que se incrustará."""

    file_name: str
    image_url: str
    visit_label: str | None = None


@dataclass(slots=True)
class ReportRenderContext:
    title: str
    project_name: str
    template_name: str | None
    tone: str | None
    generated_at: datetime
    content_markdown: str
    photos: list[PhotoReference]
    template_sections: list[Any]


@dataclass(slots=True)
class MarkdownSection:
    title: str | None
    markdown: str


def _markdown_to_html_fragment(content: str) -> str:
    return markdown_lib.markdown(
        content or "_Sin contenido generado._",
        extensions=["extra", "sane_lists", "tables"],
    )


def _photo_placement(section_index: int, template_sections: Iterable[Any]) -> bool:
    """Devuelve True si la plantilla declara que en esa sección hay foto."""

    for index, section in enumerate(template_sections):
        if index != section_index:
            continue
        if isinstance(section, dict):
            flags = [
                section.get("includes_photo"),
                section.get("include_photo"),
                section.get("has_photo"),
            ]
            return bool(any(flags))
    return False


def _split_markdown_sections(content: str) -> list[MarkdownSection]:
    sections: list[MarkdownSection] = []
    current_title: str | None = None
    current_lines: list[str] = []

    for line in (content or "").splitlines():
        if line.startswith("## "):
            if current_title is not None or current_lines:
                sections.append(
                    MarkdownSection(
                        title=current_title,
                        markdown="\n".join(current_lines).strip(),
                    )
                )
            current_title = line.removeprefix("## ").strip()
            current_lines = [line]
            continue

        current_lines.append(line)

    if current_title is not None or current_lines:
        sections.append(
            MarkdownSection(
                title=current_title,
                markdown="\n".join(current_lines).strip(),
            )
        )

    return sections or [MarkdownSection(title=None, markdown=content or "")]


def _allocate_photos_across_sections(
    photos: list[PhotoReference],
    template_sections: list[Any],
) -> dict[int, list[PhotoReference]]:
    photo_section_indexes = [
        index
        for index in range(len(template_sections))
        if _photo_placement(index, template_sections)
    ]
    if not photo_section_indexes or not photos:
        return {}

    total_sections = len(photo_section_indexes)
    allocations: dict[int, list[PhotoReference]] = {}
    for order, section_index in enumerate(photo_section_indexes):
        start = (order * len(photos)) // total_sections
        end = ((order + 1) * len(photos)) // total_sections
        allocations[section_index] = photos[start:end]
    return allocations


def _build_photo_cards(
    photos: list[PhotoReference],
    *,
    section_title: str | None = None,
) -> str:
    if not photos:
        return ""

    photo_blocks: list[str] = []
    for photo in photos:
        alt_text = html_stdlib.escape(photo.file_name)
        caption_parts = [part for part in [section_title, photo.visit_label or photo.file_name] if part]
        caption = html_stdlib.escape(" · ".join(caption_parts))
        photo_blocks.append(
            f"""
            <figure class="photo-card">
                <img src="{html_stdlib.escape(photo.image_url)}" alt="{alt_text}" />
                <figcaption>{caption}</figcaption>
            </figure>
            """
        )
    return "".join(photo_blocks)


def _build_html_document(context: ReportRenderContext, settings: Settings) -> str:
    brand = html_stdlib.escape(settings.export_brand_color)
    accent = html_stdlib.escape(settings.export_accent_color)
    title = html_stdlib.escape(context.title)
    project = html_stdlib.escape(context.project_name)
    template = html_stdlib.escape(context.template_name or "Sin plantilla")
    tone = html_stdlib.escape(context.tone or "-")
    generated_at = context.generated_at.strftime("%Y-%m-%d %H:%M UTC")

    photo_allocations = _allocate_photos_across_sections(
        context.photos,
        context.template_sections,
    )
    body_sections = _split_markdown_sections(context.content_markdown)

    content_blocks: list[str] = []
    inserted_photo_keys: set[tuple[str, str]] = set()
    template_index = 0

    for section in body_sections:
        content_blocks.append(_markdown_to_html_fragment(section.markdown))

        if section.title is None:
            continue

        allocated_photos = photo_allocations.get(template_index, [])
        if allocated_photos:
            content_blocks.append(
                f"""
                <div class="section-photo-grid">{_build_photo_cards(allocated_photos, section_title=section.title)}</div>
                """
            )
            inserted_photo_keys.update(
                (photo.file_name, photo.image_url) for photo in allocated_photos
            )

        template_index += 1

    body_html = "".join(content_blocks)

    remaining_photos = [
        photo
        for photo in context.photos
        if (photo.file_name, photo.image_url) not in inserted_photo_keys
    ]

    photos_section = ""
    if remaining_photos:
        photos_section = f"""
        <section class="photos">
            <h2>Evidencia fotográfica</h2>
            <div class="photo-grid">{_build_photo_cards(remaining_photos)}</div>
        </section>
        """

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <style>
        @page {{
            size: A4;
            margin: 24mm 18mm 22mm 18mm;
        }}
        body {{
            font-family: Helvetica, Arial, sans-serif;
            color: #0f172a;
            font-size: 11pt;
            line-height: 1.55;
        }}
        header.brand {{
            background: {brand};
            color: #ffffff;
            padding: 18px 24px;
            border-radius: 6px;
            margin-bottom: 18px;
        }}
        header.brand .eyebrow {{
            color: {accent};
            font-size: 9pt;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin: 0 0 4px 0;
        }}
        header.brand h1 {{
            margin: 0;
            font-size: 20pt;
            font-weight: 700;
        }}
        header.brand p {{
            margin: 6px 0 0 0;
            font-size: 10pt;
            color: #e2e8f0;
        }}
        .meta {{
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 18px;
            font-size: 10pt;
            color: #334155;
        }}
        .meta strong {{ color: #0f172a; }}
        h1, h2, h3 {{ color: {brand}; }}
        h2 {{
            border-bottom: 2px solid {accent};
            padding-bottom: 4px;
            margin-top: 22px;
        }}
        ul, ol {{ margin: 6px 0 6px 18px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ border: 1px solid #cbd5f5; padding: 6px 8px; text-align: left; }}
        th {{ background: #e2e8f0; }}
        section.photos {{ margin-top: 24px; }}
        .photo-grid {{ display: block; }}
        .section-photo-grid {{ margin: 12px 0 20px 0; }}
        figure.photo-card {{
            display: inline-block;
            width: 48%;
            margin: 1% 1%;
            padding: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #f8fafc;
            vertical-align: top;
        }}
        figure.photo-card img {{
            max-width: 100%;
            width: auto;
            height: auto;
            max-height: 220px;
            display: block;
            margin: 0 auto;
        }}
        figure.photo-card figcaption {{
            font-size: 9pt;
            color: #475569;
            margin-top: 4px;
        }}
        footer {{
            margin-top: 28px;
            font-size: 9pt;
            color: #64748b;
            text-align: center;
        }}
    </style>
</head>
<body>
    <header class="brand">
        <p class="eyebrow">Plataforma de Supervisión de Campo</p>
        <h1>{title}</h1>
        <p>Proyecto: {project}</p>
    </header>

    <section class="meta">
        <p><strong>Plantilla:</strong> {template}</p>
        <p><strong>Tono:</strong> {tone}</p>
        <p><strong>Generado:</strong> {generated_at}</p>
    </section>

    <section class="content">
        {body_html}
    </section>

    {photos_section}

    <footer>
        Documento generado automáticamente por la plataforma. Revisar antes de publicar.
    </footer>
</body>
</html>
"""


class ExportService:
    """Exporta reportes a HTML o PDF."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def render_html(self, context: ReportRenderContext) -> str:
        return _build_html_document(context, self.settings)

    def render_pdf(self, context: ReportRenderContext) -> bytes:
        html_document = self.render_html(context)
        buffer = BytesIO()
        result = pisa.CreatePDF(src=html_document, dest=buffer, encoding="utf-8")
        if result.err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible renderizar el reporte a PDF.",
            )
        return buffer.getvalue()


def get_export_service() -> ExportService:
    return ExportService(get_settings())


def build_render_context(
    *,
    title: str,
    project_name: str,
    template_name: str | None,
    template_sections: list[Any],
    tone: str | None,
    content_markdown: str | None,
    photos: list[PhotoReference],
    generated_at: datetime | None = None,
) -> ReportRenderContext:
    return ReportRenderContext(
        title=title,
        project_name=project_name,
        template_name=template_name,
        tone=tone,
        generated_at=generated_at or datetime.now(tz=UTC),
        content_markdown=content_markdown or "",
        photos=photos,
        template_sections=template_sections,
    )
