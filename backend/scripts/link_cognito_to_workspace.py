"""One-off admin script: link a Cognito user to the data workspace so that,
when they log in via Cognito, they land on the existing workspace (with all the
data) instead of an empty new one.

Idempotent. Dry-run by default; pass --apply to commit.

Run (dry-run):  .venv/Scripts/python.exe -m scripts.link_cognito_to_workspace
Run (commit):   .venv/Scripts/python.exe -m scripts.link_cognito_to_workspace --apply
"""

from __future__ import annotations

import sys
import uuid

from sqlalchemy import delete, select

from app.core.auth import LOCAL_WORKSPACE_ID
from app.db.models import Transaction, User, WorkspaceMember
from app.db.session import SessionLocal

# The Cognito user (adrianomvc@gmail.com) and the workspace that holds the data.
COGNITO_USER_ID = "542874c8-90f1-70b3-9128-819a7b3edc5f"
DATA_WORKSPACE_ID = LOCAL_WORKSPACE_ID  # 00000000-...0002


def main() -> None:
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.supabase_user_id == COGNITO_USER_ID))
        if user is None:
            print(f"!! Cognito user {COGNITO_USER_ID} não encontrado. Abortando.")
            return
        print(f"Usuário: {user.email} (id={user.id[:8]})")

        memberships = db.scalars(
            select(WorkspaceMember)
            .where(WorkspaceMember.user_id == COGNITO_USER_ID)
            .order_by(WorkspaceMember.created_at, WorkspaceMember.id)
        ).all()
        print("Memberships atuais:", [(m.workspace_id[:8], m.role) for m in memberships])

        tx_count = len(
            db.scalars(
                select(Transaction.id).where(Transaction.workspace_id == DATA_WORKSPACE_ID)
            ).all()
        )
        print(f"Workspace de dados {DATA_WORKSPACE_ID[:8]} tem {tx_count} transações.")

        already = db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == COGNITO_USER_ID,
                WorkspaceMember.workspace_id == DATA_WORKSPACE_ID,
            )
        )
        other = [m for m in memberships if m.workspace_id != DATA_WORKSPACE_ID]
        print(f"Ação: {'já é membro' if already else 'ADD owner'} no workspace de dados; "
              f"REMOVE {len(other)} membership(s) de outros workspaces.")

        if not apply:
            print("\nDRY-RUN. Rode com --apply para efetivar.")
            return

        if already is None:
            db.add(WorkspaceMember(
                id=str(uuid.uuid4()),
                workspace_id=DATA_WORKSPACE_ID,
                user_id=COGNITO_USER_ID,
                role="owner",
            ))
        db.execute(
            delete(WorkspaceMember).where(
                WorkspaceMember.user_id == COGNITO_USER_ID,
                WorkspaceMember.workspace_id != DATA_WORKSPACE_ID,
            )
        )
        db.commit()

        final = db.scalars(
            select(WorkspaceMember)
            .where(WorkspaceMember.user_id == COGNITO_USER_ID)
            .order_by(WorkspaceMember.created_at, WorkspaceMember.id)
        ).all()
        print("APLICADO. Memberships finais:", [(m.workspace_id[:8], m.role) for m in final])
    finally:
        db.close()


if __name__ == "__main__":
    main()
