from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

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

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                headers=self._get_headers(),
                json={"contents": contents},
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
        pdfs, audios, images, others = self._classify_assets(assets)

        multimodal_parts: list[dict[str, Any]] = []
        for asset in assets:
            multimodal_parts.append(
                {
                    "file_data": {
                        "mime_type": asset.mime_type,
                        "file_uri": asset.uri,
                    }
                }
            )

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
