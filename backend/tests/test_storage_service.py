import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services.storage_service import StorageService


def test_storage_uses_metadata_path_when_demo_auth_is_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "main")
    monkeypatch.setattr(settings, "allow_local_auth", True)
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")

    stored = StorageService().store_original_file(
        workspace_id="workspace-1",
        original_filename="extrato.txt",
        content=b"conteudo",
        source_file_id="source-1",
    )

    assert stored.bucket == "financial-files"
    assert stored.path == "workspace-1/source-1/extrato.txt"


def test_storage_requires_supabase_configuration_outside_demo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "main")
    monkeypatch.setattr(settings, "allow_local_auth", False)
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")

    with pytest.raises(HTTPException) as exc_info:
        StorageService().store_original_file(
            workspace_id="workspace-1",
            original_filename="extrato.txt",
            content=b"conteudo",
            source_file_id="source-1",
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Supabase storage is not configured"
