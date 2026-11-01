import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "fraudring.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                group_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                notes TEXT DEFAULT '',
                assigned_to TEXT DEFAULT 'Fraud Analyst',
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_investigation(group_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT group_id, status, notes, assigned_to, updated_at FROM investigations WHERE group_id = ?",
            (group_id,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def upsert_investigation(
    group_id: str,
    status: str,
    notes: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    existing = get_investigation(group_id)

    final_notes = notes if notes is not None else (existing["notes"] if existing else "")
    final_assigned = assigned_to if assigned_to is not None else (existing["assigned_to"] if existing else "Fraud Analyst")

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO investigations (group_id, status, notes, assigned_to, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(group_id) DO UPDATE SET
                status = excluded.status,
                notes = excluded.notes,
                assigned_to = excluded.assigned_to,
                updated_at = excluded.updated_at
            """,
            (group_id, status, final_notes, final_assigned, now),
        )
        conn.commit()

    return {
        "group_id": group_id,
        "status": status,
        "notes": final_notes,
        "assigned_to": final_assigned,
        "updated_at": now,
    }


def get_all_investigations() -> Dict[str, Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute("SELECT group_id, status, notes, assigned_to, updated_at FROM investigations")
        return {row["group_id"]: dict(row) for row in cursor.fetchall()}


def reset_investigations() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM investigations")
        conn.commit()


# Initialize database on module import
init_db()
