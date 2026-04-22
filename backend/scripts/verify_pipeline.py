"""Verificación integral del happy path de la plataforma.

Ejecución:
    python scripts/verify_pipeline.py

Variables opcionales:
    API_BASE_URL=http://localhost:8000/api/v1
"""

from __future__ import annotations

import asyncio
import os
import struct
import sys
import uuid
import zlib
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000/api/v1")
REQUEST_TIMEOUT = httpx.Timeout(90.0, connect=10.0)
OUTPUT_PDF_PATH = Path(__file__).resolve().parent.parent / "test_output.pdf"


class PipelineError(RuntimeError):
    """Error controlado para abortar la verificación con mensaje legible."""


@dataclass(slots=True)
class PipelineContext:
    email: str
    password: str
    full_name: str
    project_id: str | None = None
    visit_id: str | None = None
    attachment_id: str | None = None
    template_id: str | None = None
    report_id: str | None = None


def info(message: str) -> None:
    print(f"ℹ️  {message}")


def success(message: str) -> None:
    print(f"✅ {message}")


def phase(title: str) -> None:
    print(f"\n🚀 {title}")


def failure(message: str) -> None:
    print(f"\n❌ {message}")


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return b"".join(
        [
            struct.pack(">I", len(data)),
            chunk_type,
            data,
            struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF),
        ]
    )


def build_red_square_png(size: int = 100) -> BytesIO:
    """Genera un PNG RGB en memoria con un cuadrado rojo sólido."""

    if size <= 0:
        raise ValueError("El tamaño del PNG debe ser mayor que cero.")

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    row = b"\x00" + (b"\xff\x00\x00" * size)
    pixel_data = row * size
    idat = zlib.compress(pixel_data, level=9)

    payload = b"".join(
        [
            signature,
            _png_chunk(b"IHDR", ihdr),
            _png_chunk(b"IDAT", idat),
            _png_chunk(b"IEND", b""),
        ]
    )
    return BytesIO(payload)


async def ensure_success(
    response: httpx.Response,
    *,
    expected_statuses: tuple[int, ...],
    action: str,
) -> dict[str, Any]:
    if response.status_code not in expected_statuses:
        raise PipelineError(
            f"{action} falló con HTTP {response.status_code}: {response.text}"
        )

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.json()
    return {"raw": response.text}


async def ping_health(client: httpx.AsyncClient) -> None:
    phase("Salud del backend")
    response = await client.get("/health")
    payload = await ensure_success(
        response,
        expected_statuses=(200,),
        action="Ping de salud",
    )
    success(f"Backend disponible en {API_BASE_URL}")
    info(f"Estado reportado: {payload.get('status', 'desconocido')}")


async def register_and_login(
    client: httpx.AsyncClient,
    context: PipelineContext,
) -> None:
    phase("Auth: register -> login")

    register_response = await client.post(
        "/auth/register",
        json={
            "email": context.email,
            "password": context.password,
            "full_name": context.full_name,
        },
    )
    register_payload = await ensure_success(
        register_response,
        expected_statuses=(201,),
        action="Registro de usuario",
    )
    success("Usuario registrado correctamente")
    info(f"Usuario: {register_payload['user']['email']}")

    login_response = await client.post(
        "/auth/login/json",
        json={
            "email": context.email,
            "password": context.password,
        },
    )
    login_payload = await ensure_success(
        login_response,
        expected_statuses=(200,),
        action="Login de usuario",
    )
    token = login_payload.get("access_token")
    if not token:
        raise PipelineError("El login no devolvió un access_token utilizable.")

    client.headers["Authorization"] = f"Bearer {token}"
    success("Login confirmado y header Authorization configurado")


async def create_project_and_visit(
    client: httpx.AsyncClient,
    context: PipelineContext,
) -> None:
    phase("Data: create project -> create visit")

    project_response = await client.post(
        "/projects",
        json={
            "name": f"Proyecto Happy Path {datetime.now(tz=UTC).isoformat(timespec='seconds')}",
            "description": "Proyecto creado automáticamente por verify_pipeline.py",
        },
    )
    project_payload = await ensure_success(
        project_response,
        expected_statuses=(201,),
        action="Creación de proyecto",
    )
    context.project_id = project_payload["id"]
    success("Proyecto creado")
    info(f"Project ID: {context.project_id}")

    visit_response = await client.post(
        "/visits",
        json={
            "project_id": context.project_id,
            "visited_at": datetime.now(tz=UTC).isoformat(),
            "notes": (
                "Visita de inspección generada por verify_pipeline.py. "
                "Se observa un punto rojo de referencia para validar el flujo multimodal."
            ),
            "ai_context": "La imagen adjunta es un cuadrado rojo de 100x100 para pruebas de exportación y descripción visual.",
        },
    )
    visit_payload = await ensure_success(
        visit_response,
        expected_statuses=(201,),
        action="Creación de visita",
    )
    context.visit_id = visit_payload["id"]
    success("Visita creada")
    info(f"Visit ID: {context.visit_id}")


async def upload_test_photo(
    client: httpx.AsyncClient,
    context: PipelineContext,
) -> None:
    if not context.visit_id:
        raise PipelineError("No existe una visita activa para subir la imagen.")

    phase("Files: upload photo to MinIO")

    red_square = build_red_square_png(size=100)
    files = {
        "file": ("red-square.png", red_square.getvalue(), "image/png"),
    }
    data = {
        "attachment_type": "photo",
        "extracted_text": "Imagen de prueba: cuadrado rojo sólido 100x100.",
    }

    response = await client.post(
        f"/visits/{context.visit_id}/attachments/upload",
        data=data,
        files=files,
    )
    payload = await ensure_success(
        response,
        expected_statuses=(201,),
        action="Subida de imagen a MinIO",
    )
    context.attachment_id = payload["id"]
    success("Imagen subida y adjunto registrado")
    info(f"Bucket: {payload['bucket_name']} | Objeto: {payload['object_key']}")


async def create_template_and_generate_report(
    client: httpx.AsyncClient,
    context: PipelineContext,
) -> None:
    if not context.project_id or not context.visit_id:
        raise PipelineError("Faltan IDs de proyecto o visita para generar el reporte.")

    phase("AI: create template -> generate report draft")

    template_response = await client.post(
        "/templates",
        json={
            "name": f"Template Happy Path {uuid.uuid4().hex[:8]}",
            "description": "Plantilla operativa para validar el flujo completo con Gemini.",
            "tone": "tecnico",
            "instructions": (
                "Describe la evidencia de forma objetiva, menciona explícitamente la foto "
                "adjunta y cierra con recomendaciones de seguimiento."
            ),
            "sections": [
                {
                    "title": "Resumen ejecutivo",
                    "description": "Síntesis del estado general del proyecto.",
                },
                {
                    "title": "Evidencia fotográfica",
                    "description": "Describe la imagen adjunta y su relevancia.",
                    "includes_photo": True,
                },
                {
                    "title": "Conclusiones y acciones",
                    "description": "Resume hallazgos y siguientes pasos.",
                },
            ],
            "is_active": True,
        },
    )
    template_payload = await ensure_success(
        template_response,
        expected_statuses=(201,),
        action="Creación de plantilla",
    )
    context.template_id = template_payload["id"]
    success("Plantilla creada")
    info(f"Template ID: {context.template_id}")

    generate_response = await client.post(
        "/reports/generate-draft",
        json={
            "project_id": context.project_id,
            "template_id": context.template_id,
            "title": "Reporte Happy Path",
            "source_visit_ids": [context.visit_id],
        },
    )
    report_payload = await ensure_success(
        generate_response,
        expected_statuses=(201,),
        action="Generación de borrador con Gemini",
    )
    context.report_id = report_payload["id"]
    markdown = report_payload.get("content_markdown") or ""
    if not markdown.strip():
        raise PipelineError("Gemini devolvió un reporte vacío.")

    success("Reporte generado por la API")
    info(f"Report ID: {context.report_id}")
    info(f"Longitud del Markdown: {len(markdown)} caracteres")


async def download_and_verify_pdf(
    client: httpx.AsyncClient,
    context: PipelineContext,
) -> None:
    if not context.report_id:
        raise PipelineError("No existe un reporte para exportar.")

    phase("Export: download PDF and verify size")

    response = await client.get(f"/reports/{context.report_id}/export", params={"format": "pdf"})
    if response.status_code != 200:
        raise PipelineError(
            f"La exportación PDF falló con HTTP {response.status_code}: {response.text}"
        )

    content_type = response.headers.get("content-type", "")
    if "application/pdf" not in content_type:
        raise PipelineError(
            f"La exportación no devolvió un PDF válido. Content-Type recibido: {content_type}"
        )

    pdf_bytes = response.content
    if len(pdf_bytes) <= 0:
        raise PipelineError("El PDF exportado pesa 0 KB.")

    OUTPUT_PDF_PATH.write_bytes(pdf_bytes)

    size_kb = len(pdf_bytes) / 1024
    disposition = response.headers.get("content-disposition", "sin encabezado")
    success("PDF descargado, guardado y validado")
    info(f"Tamaño del PDF: {size_kb:.2f} KB")
    info(f"Content-Disposition: {disposition}")
    info(f"Archivo generado: {OUTPUT_PDF_PATH}")


async def run_pipeline() -> int:
    run_id = uuid.uuid4().hex[:8]
    context = PipelineContext(
        email=f"verify-{run_id}@example.com",
        password="CampoSeguro123!",
        full_name="Pipeline Verifier",
    )

    print("🧪 Verificación integral de la Plataforma de Supervisión de Campo")
    info(f"API base: {API_BASE_URL}")
    info(f"Run ID: {run_id}")

    async with httpx.AsyncClient(
        base_url=API_BASE_URL,
        timeout=REQUEST_TIMEOUT,
        headers={"Accept": "application/json"},
    ) as client:
        try:
            await ping_health(client)
            await register_and_login(client, context)
            await create_project_and_visit(client, context)
            await upload_test_photo(client, context)
            await create_template_and_generate_report(client, context)
            await download_and_verify_pdf(client, context)
        except (PipelineError, httpx.HTTPError) as exc:
            failure(str(exc))
            return 1

    print("\n🎉 Happy path completado correctamente")
    info(f"Proyecto: {context.project_id}")
    info(f"Visita: {context.visit_id}")
    info(f"Adjunto: {context.attachment_id}")
    info(f"Plantilla: {context.template_id}")
    info(f"Reporte: {context.report_id}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run_pipeline()))