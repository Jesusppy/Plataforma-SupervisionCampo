from fastapi import APIRouter

from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.projects import router as projects_router
from app.routers.reports import router as reports_router
from app.routers.templates import router as templates_router
from app.routers.visits import router as visits_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(visits_router)
api_router.include_router(templates_router)
api_router.include_router(reports_router)
