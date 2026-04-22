from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from io import BytesIO
from typing import BinaryIO

import aioboto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from app.config import Settings, get_settings

@dataclass(slots=True)
class StoredObject:
    bucket_name: str
    object_key: str
    file_url: str
    content_type: str


class StorageService:
    """Cliente asíncrono para MinIO vía API compatible con S3."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._session = aioboto3.Session()
        self._client_kwargs = {
            "service_name": "s3",
            "endpoint_url": settings.s3_endpoint_url,
            "aws_access_key_id": settings.minio_access_key,
            "aws_secret_access_key": settings.minio_secret_key,
            "region_name": settings.minio_region,
            "config": Config(signature_version="s3v4"),
        }

    async def _get_client(self) -> AsyncIterator[BaseClient]:
        async with self._session.client(**self._client_kwargs) as client:
            yield client

    async def ensure_bucket(self, bucket_name: str) -> None:
        try:
            async for client in self._get_client():
                await client.head_bucket(Bucket=bucket_name)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code not in {"404", "NoSuchBucket"}:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="No fue posible validar el bucket en MinIO.",
                ) from exc

            async for client in self._get_client():
                await client.create_bucket(Bucket=bucket_name)

    async def upload_file(
        self,
        *,
        bucket_name: str,
        object_key: str,
        file_stream: BinaryIO,
        content_type: str,
    ) -> StoredObject:
        await self.ensure_bucket(bucket_name)

        payload = file_stream.read()
        buffer = BytesIO(payload)

        try:
            async for client in self._get_client():
                await client.upload_fileobj(
                    Fileobj=buffer,
                    Bucket=bucket_name,
                    Key=object_key,
                    ExtraArgs={"ContentType": content_type},
                )
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible subir el archivo a MinIO.",
            ) from exc

        file_url = f"{self.settings.s3_endpoint_url}/{bucket_name}/{object_key}"
        return StoredObject(
            bucket_name=bucket_name,
            object_key=object_key,
            file_url=file_url,
            content_type=content_type,
        )

    async def delete_file(self, *, bucket_name: str, object_key: str) -> None:
        try:
            async for client in self._get_client():
                await client.delete_object(Bucket=bucket_name, Key=object_key)
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible eliminar el archivo en MinIO.",
            ) from exc

    async def read_text_file(self, *, bucket_name: str, object_key: str) -> str:
        try:
            async for client in self._get_client():
                response = await client.get_object(Bucket=bucket_name, Key=object_key)
                async with response["Body"] as stream:
                    content = await stream.read()
                    return content.decode("utf-8")
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible leer el archivo desde MinIO.",
            ) from exc

    async def generate_presigned_url(
        self,
        *,
        bucket_name: str,
        object_key: str,
        expires_in_seconds: int = 3600,
    ) -> str:
        try:
            async for client in self._get_client():
                return await client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket_name, "Key": object_key},
                    ExpiresIn=expires_in_seconds,
                )
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible generar la URL firmada del archivo.",
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible inicializar el cliente de almacenamiento.",
        )


def get_storage_service() -> StorageService:
    return StorageService(get_settings())
