from dataclasses import dataclass
from uuid import uuid4

from fastapi import HTTPException, status
from supabase import create_client

from app.core.config import settings


@dataclass(frozen=True)
class StoredFile:
    bucket: str
    path: str


class StorageService:
    def store_original_file(
        self,
        workspace_id: str,
        original_filename: str,
        content: bytes,
        source_file_id: str | None = None,
    ) -> StoredFile:
        resolved_source_file_id = source_file_id or str(uuid4())
        path = f"{workspace_id}/{resolved_source_file_id}/{original_filename}"
        bucket = settings.supabase_storage_bucket

        if settings.app_env == "local" or settings.allow_local_auth:
            return StoredFile(bucket=bucket, path=path)

        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase storage is not configured",
            )

        try:
            client = create_client(settings.supabase_url, settings.supabase_service_role_key)
            client.storage.from_(bucket).upload(
                path,
                content,
                file_options={"upsert": "false"},
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to store original file",
            ) from exc

        return StoredFile(bucket=bucket, path=path)
