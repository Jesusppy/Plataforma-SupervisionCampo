from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.models.template import Template
from app.models.user import User


ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "Admin123!")
ADMIN_FULL_NAME = os.environ.get("SEED_ADMIN_FULL_NAME", "Administrador de Plataforma")

DEMO_EMAIL = os.environ.get("SEED_DEMO_EMAIL", "demo@example.com")
DEMO_PASSWORD = os.environ.get("SEED_DEMO_PASSWORD", "Demo123!")
DEMO_FULL_NAME = os.environ.get("SEED_DEMO_FULL_NAME", "Usuario Demo")


def _client_a_sections() -> list[dict[str, object]]:
    return [
        {
            "title": "Resumen general",
            "description": "Explica de forma breve y comprensible qué se revisó y cuál es el estado general.",
        },
        {
            "title": "Qué se observó en la visita",
            "description": "Describe hallazgos con palabras simples y evita tecnicismos innecesarios.",
        },
        {
            "title": "Evidencia fotográfica",
            "description": "Inserta la foto principal de la visita y relaciónala con el hallazgo explicado.",
            "includes_photo": True,
        },
        {
            "title": "Recomendaciones prácticas",
            "description": "Propón acciones claras, priorizadas y fáciles de entender por el cliente.",
        },
    ]


def _client_b_sections() -> list[dict[str, object]]:
    return [
        {
            "title": "Resumen ejecutivo",
            "description": "Sintetiza alcance, condición del emplazamiento y nivel de riesgo operativo.",
        },
        {
            "title": "Hallazgos técnicos",
            "description": "Detalla observaciones con terminología técnica y criterio de supervisión forestal.",
        },
        {
            "title": "Evidencia fotográfica y trazabilidad",
            "description": "Asocia la evidencia visual al hallazgo técnico descrito en la sección precedente.",
            "includes_photo": True,
        },
        {
            "title": "Conclusiones y medidas correctivas",
            "description": "Cierra con valoración profesional, criticidad y acciones correctivas recomendadas.",
        },
    ]


async def _upsert_user(
    *,
    email: str,
    password: str,
    full_name: str,
    is_superuser: bool,
) -> User:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                is_active=True,
                is_superuser=is_superuser,
            )
            session.add(user)
            action = "creado"
        else:
            user.full_name = full_name
            user.hashed_password = hash_password(password)
            user.is_active = True
            user.is_superuser = is_superuser
            action = "actualizado"

        await session.commit()
        await session.refresh(user)

    role = "administrador" if is_superuser else "demo"
    print(f"Usuario {role} {action}: {email}")
    return user


async def _upsert_template(
    *,
    user_id: str,
    name: str,
    description: str,
    tone: str,
    instructions: str,
    sections: list[dict[str, object]],
) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Template).where(
                Template.name == name,
                Template.user_id == user_id,
            )
        )
        template = result.scalar_one_or_none()

        if template is None:
            template = Template(
                user_id=user_id,
                name=name,
                description=description,
                tone=tone,
                instructions=instructions,
                sections=sections,
                is_active=True,
            )
            session.add(template)
            action = "creada"
        else:
            template.description = description
            template.tone = tone
            template.instructions = instructions
            template.sections = sections
            template.is_active = True
            action = "actualizada"

        await session.commit()
        print(f"Plantilla {action}: {name}")


async def main() -> None:
    admin_user = await _upsert_user(
        email=ADMIN_EMAIL,
        password=ADMIN_PASSWORD,
        full_name=ADMIN_FULL_NAME,
        is_superuser=True,
    )
    await _upsert_user(
        email=DEMO_EMAIL,
        password=DEMO_PASSWORD,
        full_name=DEMO_FULL_NAME,
        is_superuser=False,
    )
    await _upsert_template(
        user_id=admin_user.id,
        name="Cliente A - Informe claro de supervisión",
        description="Versión orientada a cliente no técnico, con redacción sencilla y directa.",
        tone="sencillo-claro (Cliente A)",
        instructions=(
            "Redacta como técnico forestal explicando el estado de la visita con lenguaje sencillo,"
            " frases cortas y conclusiones fáciles de entender por una persona no especialista."
        ),
        sections=_client_a_sections(),
    )
    await _upsert_template(
        user_id=admin_user.id,
        name="Cliente B - Informe técnico de supervisión",
        description="Versión orientada a cliente institucional con tono técnico-formal.",
        tone="tecnico-formal (Cliente B)",
        instructions=(
            "Redacta como técnico forestal senior para un cliente institucional. Usa terminología"
            " técnica, precisión descriptiva, valoración de riesgo y enfoque formal."
        ),
        sections=_client_b_sections(),
    )
    print("Seed completado correctamente.")


if __name__ == "__main__":
    asyncio.run(main())