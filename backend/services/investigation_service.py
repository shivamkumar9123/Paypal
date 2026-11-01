from typing import Dict, Any, Optional, List
from backend.database.db import (
    get_investigation,
    upsert_investigation,
    get_all_investigations,
    reset_investigations,
)
from backend.schemas.investigation import InvestigationStatus, InvestigationRecord


def update_group_status(
    group_id: str,
    status: InvestigationStatus,
    notes: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> Dict[str, Any]:
    return upsert_investigation(
        group_id=group_id,
        status=status.value,
        notes=notes,
        assigned_to=assigned_to,
    )


def fetch_group_investigation(group_id: str) -> Optional[Dict[str, Any]]:
    return get_investigation(group_id)


def fetch_all_investigations() -> Dict[str, Dict[str, Any]]:
    return get_all_investigations()


def reset_all_investigations() -> None:
    reset_investigations()
