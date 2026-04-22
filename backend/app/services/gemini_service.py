from __future__ import annotations

import asyncio
import base64
import ipaddress
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.config import Settings, get_settings


@dataclass(slots=True)
class GenerationAsset:
    mime_type: str
    uri: str
    file_name: str | None = None
    extracted_text: str | None = None


class GeminiService:
    """Cliente asíncrono para Gemini usando la API REST."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._timeout = httpx.Timeout(60.0, connect=10.0)

    def _get_headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json"}

    def _require_api_key(self) -> str:
        if not self.settings.gemini_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="La integración con Gemini no está configurada.",
            )
        return self.settings.gemini_api_key

    def _section_title(self, index: int, section: Any) -> str:
        if isinstance(section, dict):
            return str(section.get("title") or section.get("name") or f"Sección {index + 1}")
        return str(section)

    def _section_requests_photos(self, section: Any) -> bool:
        if not isinstance(section, dict):
            return False
        return bool(
            section.get("includes_photo")
            or section.get("include_photo")
            or section.get("has_photo")
        )

    def _mock_section_content(
        self,
        *,
        title: str,
        section: Any,
        visit_notes: list[str],
        pdfs: list[GenerationAsset],
        audios: list[GenerationAsset],
        images: list[GenerationAsset],
    ) -> str:
        normalized_title = title.lower()
        notes_excerpt = visit_notes[0] if visit_notes else "Sin notas registradas en la visita."
        image_lines = [
            f"- Evidencia MinIO: {asset.file_name or 'sin-nombre'} ({asset.uri})"
            for asset in images
        ]
        pdf_lines = [
            f"- Documento técnico asociado: {asset.file_name or asset.uri}"
            for asset in pdfs
        ]
        audio_lines = [
            f"- Fuente de audio considerada: {asset.file_name or asset.uri}"
            for asset in audios
        ]

        if "resumen" in normalized_title:
            return "\n".join(
                [
                    "Se ejecutó una inspección forestal preventiva sobre un lote con cobertura mixta de pino y regeneración nativa, orientada a verificar estado del sotobosque, continuidad de cortafuegos y condiciones de acceso para cuadrillas.",
                    "",
                    "Los hallazgos preliminares muestran un nivel de riesgo operativo medio: se observan acumulaciones localizadas de material seco, huellas de escorrentía en un talud secundario y necesidad de reforzar el señalamiento del perímetro de intervención.",
                    "",
                    f"Referencia de campo principal: {notes_excerpt}",
                ]
            )

        if self._section_requests_photos(section) or "foto" in normalized_title or "evidencia" in normalized_title:
            photo_block = image_lines or ["- No se recibió evidencia fotográfica en esta ejecución."]
            return "\n".join(
                [
                    "La sección requiere evidencia visual y, por ello, debe leerse junto con la galería incrustada por el exportador PDF.",
                    "",
                    "Observaciones visuales simuladas para validación local:",
                    "- La evidencia fotográfica muestra una zona de ensayo con marcador rojo usado para verificar el pipeline de captura, almacenamiento y exportación.",
                    "- La referencia visual confirma que el motor de exportación puede ubicar e incrustar fotografías provenientes de MinIO en esta sección.",
                    "- Ver evidencia fotográfica adjunta en la exportación final.",
                    "",
                    *photo_block,
                ]
            )

        if "conclusion" in normalized_title or "accion" in normalized_title:
            lines = [
                "1. Reperfilar y limpiar los puntos de acumulación de material vegetal fino detectados en bordes de sendero.",
                "2. Reforzar el mantenimiento del cortafuego secundario antes del siguiente ciclo de calor extremo.",
                "3. Mantener un registro fotográfico periódico en MinIO para comparar evolución de cobertura y erosión.",
            ]
            if pdf_lines:
                lines.extend(["", "Documentación de apoyo considerada:", *pdf_lines])
            if audio_lines:
                lines.extend(["", "Fuentes orales o de patrulla consideradas:", *audio_lines])
            return "\n".join(lines)

        return "\n".join(
            [
                f"Se desarrolla la sección '{title}' con un enfoque de inspección forestal preventiva y trazabilidad de evidencias.",
                "",
                "Se consideran variables de cobertura vegetal, estabilidad superficial del terreno, acceso operativo y coherencia entre lo observado en campo y la evidencia almacenada.",
                "",
                f"Síntesis de visita: {notes_excerpt}",
            ]
        )

    def _build_mock_report_draft(
        self,
        *,
        template_name: str,
        template_structure: list[dict[str, object]],
        tone: str,
        instructions: str | None,
        visit_notes: list[str],
        assets: list[GenerationAsset],
    ) -> str:
        pdfs, audios, images, _others = self._classify_assets(assets)
        sections = template_structure or [
            {"title": "Resumen ejecutivo"},
            {"title": "Evidencia fotográfica", "includes_photo": True},
            {"title": "Conclusiones y acciones"},
        ]

        blocks: list[str] = [
            "<!-- MOCK_LLM: reporte forestal estático para validación local -->",
            f"> Plantilla simulada: {template_name}",
            f"> Tono solicitado: {tone}",
        ]
        if instructions:
            blocks.append(f"> Instrucciones base: {instructions}")

        for index, section in enumerate(sections):
            title = self._section_title(index, section)
            body = self._mock_section_content(
                title=title,
                section=section,
                visit_notes=visit_notes,
                pdfs=pdfs,
                audios=audios,
                images=images,
            )
            blocks.append(f"## {title}\n\n{body}")

        if not any("observaciones del asistente" in self._section_title(index, section).lower() for index, section in enumerate(sections)):
            blocks.append(
                "## Observaciones del asistente\n\n"
                "- El modo `USE_MOCK_LLM` está activo, por lo que este contenido no proviene de Gemini y sirve únicamente para validar el pipeline local.\n"
                "- La sección de evidencia fotográfica contiene referencias explícitas a activos almacenados en MinIO para que la exportación PDF pueda incrustar imágenes reales.\n"
                "- La estructura del documento permanece alineada con la plantilla entregada por la API."
            )

        return "\n\n".join(blocks).strip()

    async def _generate_content(
        self,
        *,
        model: str,
        contents: list[dict[str, Any]],
    ) -> dict[str, Any]:
        api_key = self._require_api_key()
        url = (
            f"{self.settings.gemini_api_base_url}/v1beta/models/"
            f"{model}:generateContent?key={api_key}"
        )

        response: httpx.Response | None = None
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            for attempt in range(3):
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json={"contents": contents},
                )
                if response.status_code < 400:
                    break
                if response.status_code not in {429, 503} or attempt == 2:
                    break
                await asyncio.sleep(2**attempt)

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible obtener respuesta desde Gemini.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini devolvió un error: {response.text}",
            )

        return response.json()

    def _extract_text_response(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates", [])
        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Gemini no devolvió candidatos válidos.",
            )

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if "text" in part]
        if not text_parts:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Gemini no devolvió texto utilizable.",
            )

        return "\n".join(text_parts).strip()

    async def transcribe_audio(self, *, audio_uri: str, mime_type: str) -> str:
        if self.settings.use_mock_llm:
            return (
                "[MOCK_LLM] Transcripción simulada de inspección forestal: "
                "se reporta revisión de cortafuegos, presencia de material seco y acceso transitable para cuadrillas."
            )

        contents = [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Transcribe el audio de forma fiel en español. "
                            "No resumas ni inventes contenido."
                        )
                    },
                    {
                        "file_data": {
                            "mime_type": mime_type,
                            "file_uri": audio_uri,
                        }
                    },
                ],
            }
        ]
        payload = await self._generate_content(
            model=self.settings.gemini_transcription_model,
            contents=contents,
        )
        return self._extract_text_response(payload)

    def _format_section(self, index: int, section: Any) -> str:
        if isinstance(section, dict):
            title = section.get("title") or section.get("name") or f"Sección {index + 1}"
            description = section.get("description") or section.get("guidance") or ""
            hints: list[str] = []
            if section.get("includes_photo") or section.get("include_photo") or section.get("has_photo"):
                hints.append("debe referenciar al menos una FOTO de la visita")
            if section.get("include_pdf_summary"):
                hints.append("debe resumir hallazgos extraídos de los PDFs")
            if section.get("include_audio_insights"):
                hints.append("debe integrar lo dicho en las transcripciones de audio")
            hints_text = f" ({'; '.join(hints)})" if hints else ""
            description_text = f" — {description}" if description else ""
            return f"{index + 1}. {title}{description_text}{hints_text}"
        return f"{index + 1}. {section}"

    def _classify_assets(
        self,
        assets: list[GenerationAsset],
    ) -> tuple[list[GenerationAsset], list[GenerationAsset], list[GenerationAsset], list[GenerationAsset]]:
        pdfs: list[GenerationAsset] = []
        audios: list[GenerationAsset] = []
        images: list[GenerationAsset] = []
        others: list[GenerationAsset] = []
        for asset in assets:
            mime = (asset.mime_type or "").lower()
            if "pdf" in mime:
                pdfs.append(asset)
            elif mime.startswith("audio"):
                audios.append(asset)
            elif mime.startswith("image"):
                images.append(asset)
            else:
                others.append(asset)
        return pdfs, audios, images, others

    def _render_asset_block(self, title: str, assets: list[GenerationAsset]) -> str:
        if not assets:
            return f"{title}: ninguno."
        lines = [f"{title}:"]
        for index, asset in enumerate(assets, start=1):
            label = asset.file_name or asset.uri
            extracted = asset.extracted_text or "sin texto previo"
            lines.append(
                f"  {index}. {label} (MIME: {asset.mime_type}) | texto: {extracted}"
            )
        return "\n".join(lines)

    def _requires_inline_upload(self, uri: str) -> bool:
        parsed = urlparse(uri)
        hostname = parsed.hostname
        if not hostname:
            return False
        if hostname in {"localhost", "127.0.0.1", "::1"}:
            return True
        try:
            return ipaddress.ip_address(hostname).is_private
        except ValueError:
            return False

    async def _build_asset_part(self, asset: GenerationAsset) -> dict[str, Any]:
        if not self._requires_inline_upload(asset.uri):
            return {
                "file_data": {
                    "mime_type": asset.mime_type,
                    "file_uri": asset.uri,
                }
            }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(asset.uri)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"No fue posible descargar el activo local para Gemini: {response.text}",
            )

        return {
            "inline_data": {
                "mime_type": asset.mime_type,
                "data": base64.b64encode(response.content).decode("ascii"),
            }
        }

    async def generate_report_draft(
        self,
        *,
        template_name: str,
        template_structure: list[dict[str, object]],
        tone: str,
        instructions: str | None,
        visit_notes: list[str],
        assets: list[GenerationAsset],
    ) -> str:
        if self.settings.use_mock_llm:
            return self._build_mock_report_draft(
                template_name=template_name,
                template_structure=template_structure,
                tone=tone,
                instructions=instructions,
                visit_notes=visit_notes,
                assets=assets,
            )

        pdfs, audios, images, others = self._classify_assets(assets)

        multimodal_parts: list[dict[str, Any]] = []
        for asset in assets:
            multimodal_parts.append(await self._build_asset_part(asset))

        sections_text = "\n".join(
            self._format_section(index, section)
            for index, section in enumerate(template_structure)
        )
        if not sections_text:
            sections_text = "(la plantilla no declara secciones, usa una estructura ejecutiva coherente)"

        notes_text = "\n\n".join(visit_notes) if visit_notes else "Sin notas registradas."
        instruction_block = instructions or "Sin instrucciones adicionales."

        system_prompt = f"""
Eres un asistente técnico experto en supervisión de campo para proyectos de infraestructura.
Tu tarea: generar un informe profesional en Markdown, en español, respetando ESTRICTAMENTE las
secciones y el orden definidos por la plantilla. No inventes secciones nuevas, no cambies su orden
y no omitas ninguna.

Reglas obligatorias:
1. Analiza TODO el material multimodal entregado:
   - Los PDFs adjuntos: extrae datos técnicos, tablas, mediciones y conclusiones.
   - Los audios adjuntos: usa su transcripción fiel para recoger testimonios y observaciones.
   - Las imágenes adjuntas: descríbelas objetivamente (elementos visibles, estado, riesgos) y
     referéncialas en la sección que corresponda según la plantilla.
2. Usa únicamente los hechos presentes en las notas, transcripciones, PDFs e imágenes. Si falta
   información para una sección, escribe "Información no disponible en las evidencias" en esa
   sección, pero NUNCA inventes datos.
3. Mantén el tono solicitado: {tone}.
4. Usa encabezados Markdown (##) por cada sección de la plantilla, en el mismo orden declarado.
5. Cuando una sección indique que debe incluir fotos, haz referencia explícita (por ejemplo:
   "Ver evidencia fotográfica adjunta") para que el exportador las ubique correctamente.
6. Cierra con una sección final "Observaciones del asistente" con riesgos o inconsistencias
   detectadas entre las evidencias.
""".strip()

        user_context = f"""
Nombre de la plantilla: {template_name}
Tono solicitado: {tone}
Fecha de generación UTC: {datetime.now(tz=UTC).isoformat()}

ESTRUCTURA OBLIGATORIA (usar exactamente estos encabezados en este orden):
{sections_text}

INSTRUCCIONES ESPECÍFICAS DE LA PLANTILLA:
{instruction_block}

NOTAS DE LAS VISITAS (usar como fuente principal):
{notes_text}

{self._render_asset_block('PDFs disponibles', pdfs)}

{self._render_asset_block('Audios disponibles (usar transcripción fiel)', audios)}

{self._render_asset_block('Imágenes disponibles (describir y referenciar)', images)}

{self._render_asset_block('Otros adjuntos', others)}
""".strip()

        contents = [
            {
                "role": "user",
                "parts": [
                    {"text": system_prompt},
                    {"text": user_context},
                    *multimodal_parts,
                ],
            }
        ]

        payload = await self._generate_content(
            model=self.settings.gemini_model,
            contents=contents,
        )
        return self._extract_text_response(payload)


def get_gemini_service() -> GeminiService:
    return GeminiService(get_settings())
