"""Dependencias compartidas de FastAPI (autenticación, etc.)."""

from __future__ import annotations

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User

_settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{_settings.api_v1_prefix}/auth/login",
    auto_error=True,
)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenciales inválidas o expiradas.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Valida el JWT y devuelve el usuario activo correspondiente."""

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject:
            raise _UNAUTHORIZED
        user_id = UUID(subject)
    except (jwt.PyJWTError, ValueError) as exc:
        raise _UNAUTHORIZED from exc

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _UNAUTHORIZED
    return user
