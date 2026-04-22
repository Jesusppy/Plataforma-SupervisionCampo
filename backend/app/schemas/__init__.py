from app.schemas.attachment import AttachmentBase, AttachmentCreate, AttachmentRead, AttachmentUpdate
from app.schemas.auth import TokenResponse, UserLoginRequest, UserRead, UserRegisterRequest
from app.schemas.project import ProjectBase, ProjectCreate, ProjectDetail, ProjectRead, ProjectUpdate
from app.schemas.report import ReportBase, ReportCreate, ReportGenerateRequest, ReportRead, ReportUpdate
from app.schemas.template import TemplateBase, TemplateCreate, TemplateRead, TemplateUpdate
from app.schemas.visit import VisitBase, VisitCreate, VisitRead, VisitUpdate

__all__ = [
    "AttachmentBase",
    "AttachmentCreate",
    "AttachmentRead",
    "AttachmentUpdate",
    "ProjectBase",
    "ProjectCreate",
    "ProjectDetail",
    "ProjectRead",
    "ProjectUpdate",
    "ReportBase",
    "ReportCreate",
    "ReportGenerateRequest",
    "ReportRead",
    "ReportUpdate",
    "TemplateBase",
    "TemplateCreate",
    "TemplateRead",
    "TemplateUpdate",
    "VisitBase",
    "VisitCreate",
    "TokenResponse",
    "UserLoginRequest",
    "UserRead",
    "UserRegisterRequest",
    "VisitRead",
    "VisitUpdate",
]
