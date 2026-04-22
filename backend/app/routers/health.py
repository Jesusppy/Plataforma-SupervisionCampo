from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Valida el estado basico del servicio")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
