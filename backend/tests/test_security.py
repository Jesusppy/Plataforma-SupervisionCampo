from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest


API_PREFIX = "/api/v1"


async def register_user(
    client: httpx.AsyncClient,
    *,
    email: str,
    password: str = "Admin123!",
    full_name: str,
) -> dict[str, str]:
    response = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def create_project(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    name: str,
) -> dict[str, str]:
    response = await client.post(
        f"{API_PREFIX}/projects",
        headers=headers,
        json={
            "name": name,
            "description": f"{name} description",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_visit(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    project_id: str,
) -> dict[str, str]:
    response = await client.post(
        f"{API_PREFIX}/visits",
        headers=headers,
        json={
            "project_id": project_id,
            "visited_at": datetime.now(tz=UTC).isoformat(),
            "notes": "Visita privada del propietario.",
            "ai_context": "Contexto interno.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_report(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    project_id: str,
    title: str,
    source_visit_ids: list[str] | None = None,
) -> dict[str, str]:
    response = await client.post(
        f"{API_PREFIX}/reports",
        headers=headers,
        json={
            "project_id": project_id,
            "title": title,
            "status": "generated",
            "content_markdown": "## Resumen\nContenido sensible del reporte.",
            "source_visit_ids": source_visit_ids or [],
            "generated_at": datetime.now(tz=UTC).isoformat(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_projects_require_a_valid_token(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{API_PREFIX}/projects")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_user_cannot_read_or_modify_another_users_resources(
    client: httpx.AsyncClient,
) -> None:
    owner_headers = await register_user(
        client,
        email="owner@example.com",
        full_name="Owner User",
    )
    intruder_headers = await register_user(
        client,
        email="intruder@example.com",
        full_name="Intruder User",
    )

    private_project = await create_project(
        client,
        owner_headers,
        name="Proyecto Privado",
    )
    private_visit = await create_visit(
        client,
        owner_headers,
        project_id=private_project["id"],
    )
    private_report = await create_report(
        client,
        owner_headers,
        project_id=private_project["id"],
        title="Reporte Privado",
        source_visit_ids=[private_visit["id"]],
    )

    project_read = await client.get(
        f"{API_PREFIX}/projects/{private_project['id']}",
        headers=intruder_headers,
    )
    project_update = await client.put(
        f"{API_PREFIX}/projects/{private_project['id']}",
        headers=intruder_headers,
        json={"name": "Proyecto Secuestrado"},
    )
    visit_read = await client.get(
        f"{API_PREFIX}/visits/{private_visit['id']}",
        headers=intruder_headers,
    )
    visit_update = await client.put(
        f"{API_PREFIX}/visits/{private_visit['id']}",
        headers=intruder_headers,
        json={"notes": "Modificación no autorizada"},
    )
    report_read = await client.get(
        f"{API_PREFIX}/reports/{private_report['id']}",
        headers=intruder_headers,
    )
    report_update = await client.put(
        f"{API_PREFIX}/reports/{private_report['id']}",
        headers=intruder_headers,
        json={"title": "Reporte Secuestrado"},
    )
    intruder_projects = await client.get(
        f"{API_PREFIX}/projects",
        headers=intruder_headers,
    )
    intruder_visits = await client.get(
        f"{API_PREFIX}/visits",
        headers=intruder_headers,
    )
    intruder_reports = await client.get(
        f"{API_PREFIX}/reports",
        headers=intruder_headers,
    )

    assert project_read.status_code == 404
    assert project_update.status_code == 404
    assert visit_read.status_code == 404
    assert visit_update.status_code == 404
    assert report_read.status_code == 404
    assert report_update.status_code == 404
    assert all(project["id"] != private_project["id"] for project in intruder_projects.json())
    assert all(visit["id"] != private_visit["id"] for visit in intruder_visits.json())
    assert all(report["id"] != private_report["id"] for report in intruder_reports.json())


@pytest.mark.asyncio
async def test_only_the_owner_can_export_a_report(
    client: httpx.AsyncClient,
) -> None:
    owner_headers = await register_user(
        client,
        email="report-owner@example.com",
        full_name="Report Owner",
    )
    outsider_headers = await register_user(
        client,
        email="report-outsider@example.com",
        full_name="Report Outsider",
    )

    project = await create_project(
        client,
        owner_headers,
        name="Proyecto Exportable",
    )
    report = await create_report(
        client,
        owner_headers,
        project_id=project["id"],
        title="Reporte Exportable",
    )

    owner_html = await client.get(
        f"{API_PREFIX}/reports/{report['id']}/export",
        params={"format": "html"},
        headers=owner_headers,
    )
    owner_pdf = await client.get(
        f"{API_PREFIX}/reports/{report['id']}/export",
        params={"format": "pdf"},
        headers=owner_headers,
    )
    outsider_html = await client.get(
        f"{API_PREFIX}/reports/{report['id']}/export",
        params={"format": "html"},
        headers=outsider_headers,
    )
    outsider_pdf = await client.get(
        f"{API_PREFIX}/reports/{report['id']}/export",
        params={"format": "pdf"},
        headers=outsider_headers,
    )

    assert owner_html.status_code == 200
    assert owner_html.headers["content-type"].startswith("text/html")
    assert owner_pdf.status_code == 200
    assert owner_pdf.headers["content-type"].startswith("application/pdf")
    assert outsider_html.status_code == 404
    assert outsider_pdf.status_code == 404