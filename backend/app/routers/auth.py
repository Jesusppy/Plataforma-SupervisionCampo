from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserRead,
    UserRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


async def _get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


def _build_token_response(user: User) -> TokenResponse:
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email, "is_superuser": user.is_superuser},
    )
    return TokenResponse(
        access_token=token,
        expires_in_minutes=settings.jwt_access_token_ttl_minutes,
        user=UserRead.model_validate(user),
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un usuario y devuelve un JWT de acceso",
)
async def register_user(
    payload: UserRegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if await _get_user_by_email(session, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado.",
        )

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No fue posible registrar al usuario.",
        ) from exc

    await session.refresh(user)
    return _build_token_response(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Inicia sesión con email y contraseña (OAuth2 password flow)",
)
async def login_with_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await _get_user_by_email(session, form_data.username)
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario está inactivo.",
        )

    return _build_token_response(user)


@router.post(
    "/login/json",
    response_model=TokenResponse,
    summary="Inicia sesión usando un payload JSON (para el frontend)",
)
async def login_with_json(
    payload: UserLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await _get_user_by_email(session, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario está inactivo.",
        )

    return _build_token_response(user)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Devuelve el usuario autenticado",
)
async def read_current_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user
