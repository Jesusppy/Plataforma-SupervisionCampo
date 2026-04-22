"""Script de validación E2E para la Plataforma de Supervisión de Campo.

Ejecución:
    python test_e2e.py

Requiere que FastAPI esté levantado en http://localhost:8000.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import UTC, datetime

import httpx

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000/api/v1")
REQUEST_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


async def ping_health(client: httpx.AsyncClient) -> None:
    print(f"[1/3] Ping a {API_BASE_URL}/health ...")
    response = await client.get("/health")
    response.raise_for_status()
    payload = response.json()
    print(f"      OK -> status={payload.get('status', 'desconocido')}")


async def create_project(client: httpx.AsyncClient) -> str:
    print("[2/3] Creando proyecto de prueba ...")
    response = await client.post(
        "/projects",
        json={
            "name": f"Proyecto E2E {datetime.now(tz=UTC).isoformat(timespec='seconds')}",
            "description": "Proyecto creado automáticamente por test_e2e.py",
        },
    )
    response.raise_for_status()
    project = response.json()
    project_id = project["id"]
    print(f"      Proyecto creado con ID: {project_id}")
    return project_id


async def create_visit(client: httpx.AsyncClient, project_id: str) -> str:
    print("[3/3] Creando visita asociada al proyecto ...")
    response = await client.post(
        "/visits",
        json={
            "project_id": project_id,
            "visited_at": datetime.now(tz=UTC).isoformat(),
            "notes": "Visita generada automáticamente por test_e2e.py",
            "ai_context": None,
        },
    )
    response.raise_for_status()
    visit = response.json()
    visit_id = visit["id"]
    print(f"      Visita creada con ID: {visit_id}")
    return visit_id


async def run_e2e() -> int:
    print("=== Validación E2E Plataforma de Supervisión de Campo ===")
    print(f"API base: {API_BASE_URL}\n")

    async with httpx.AsyncClient(
        base_url=API_BASE_URL,
        timeout=REQUEST_TIMEOUT,
    ) as client:
        try:
            await ping_health(client)
            project_id = await create_project(client)
            visit_id = await create_visit(client, project_id)
        except httpx.HTTPStatusError as exc:
            print(
                "\nERROR: el backend devolvió un error HTTP.\n"
                f"  - URL: {exc.request.url}\n"
                f"  - Status: {exc.response.status_code}\n"
                f"  - Body: {exc.response.text}",
            )
            return 1
        except httpx.HTTPError as exc:
            print(f"\nERROR de conexión con el backend: {exc}")
            return 1

    print("\nResumen:")
    print(f"  Proyecto creado: {project_id}")
    print(f"  Visita creada:   {visit_id}")
    print("\nValidación E2E completada correctamente.")
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(run_e2e())
    sys.exit(exit_code)
