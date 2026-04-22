from __future__ import annotations

from pydantic import ConfigDict, EmailStr, Field

from app.schemas.common import SchemaModel, TimestampedModel


class UserRegisterRequest(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class UserLoginRequest(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    password: str


class UserRead(TimestampedModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    full_name: str | None = None
    is_active: bool
    is_superuser: bool


class TokenResponse(SchemaModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserRead
