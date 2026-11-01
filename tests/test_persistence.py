from backend.database.db import (
    upsert_investigation,
    get_investigation,
    get_all_investigations,
    reset_investigations,
)


def test_sqlite_investigation_persistence():
    reset_investigations()

    # Create new status record
    res = upsert_investigation(
        group_id="GRP_TEST_01",
        status="UNDER_REVIEW",
        notes="High volume smurfing pattern flagged.",
        assigned_to="Jane Doe",
    )
    assert res["status"] == "UNDER_REVIEW"
    assert res["notes"] == "High volume smurfing pattern flagged."

    # Fetch and check
    saved = get_investigation("GRP_TEST_01")
    assert saved is not None
    assert saved["status"] == "UNDER_REVIEW"
    assert saved["assigned_to"] == "Jane Doe"

    # Update status to ESCALATED and add note
    updated = upsert_investigation(
        group_id="GRP_TEST_01",
        status="ESCALATED",
        notes="Escalated to Compliance Director.",
    )
    assert updated["status"] == "ESCALATED"
    assert updated["notes"] == "Escalated to Compliance Director."
    # assigned_to should be preserved
    assert updated["assigned_to"] == "Jane Doe"

    # All investigations list
    all_inv = get_all_investigations()
    assert "GRP_TEST_01" in all_inv
    assert all_inv["GRP_TEST_01"]["status"] == "ESCALATED"
