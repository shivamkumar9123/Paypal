from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_graph_endpoints_flow():
    # 1. Reset and load sample data
    resp_sample = client.post("/graph/load-sample")
    assert resp_sample.status_code == 200
    data = resp_sample.json()
    assert "summary" in data
    assert "nodes" in data
    assert "edges" in data
    assert "groups" in data
    assert data["summary"]["total_transactions"] > 0
    assert len(data["groups"]) > 0

    first_group_id = data["groups"][0]["group_id"]

    # 2. Get specific group details
    resp_group = client.get(f"/graph/groups/{first_group_id}")
    assert resp_group.status_code == 200
    grp = resp_group.json()
    assert grp["group_id"] == first_group_id
    assert grp["risk_score"] > 0
    assert len(grp["patterns"]) > 0
    assert len(grp["suggested_steps"]) > 0

    # 3. Update investigation status for group
    resp_status = client.patch(
        f"/graph/groups/{first_group_id}/status",
        json={"status": "UNDER_REVIEW", "notes": "Auditing accounts with compliance."},
    )
    assert resp_status.status_code == 200
    status_data = resp_status.json()
    assert status_data["status"] == "UNDER_REVIEW"
    assert status_data["notes"] == "Auditing accounts with compliance."

    # 4. Verify updated status reflects in group fetch
    resp_group_after = client.get(f"/graph/groups/{first_group_id}")
    assert resp_group_after.json()["status"] == "UNDER_REVIEW"

    # 5. Check dashboard summary
    resp_dash = client.get("/dashboard/summary")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert "metrics" in dash
    assert "status_distribution" in dash
    assert dash["status_distribution"]["UNDER_REVIEW"] >= 1

    # 6. Check demo data endpoint
    resp_demo = client.get("/graph/demo-data")
    assert resp_demo.status_code == 200
    assert resp_demo.json()["total_records"] > 0

    # 7. Check paypal status endpoint
    resp_pp = client.get("/paypal/status")
    assert resp_pp.status_code == 200
    assert "configured" in resp_pp.json()


def test_csv_upload_endpoint():
    valid_csv = b"transaction_id,sender_id,receiver_id,amount,timestamp\nTX_UP_1,U1,U2,100.0,2026-11-01T10:00:00Z\n"
    response = client.post(
        "/graph/upload-csv",
        files={"file": ("test.csv", valid_csv, "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["valid_rows"] == 1


def test_csv_upload_invalid_file():
    invalid_csv = b"random,junk,content\n1,2,3\n"
    response = client.post(
        "/graph/upload-csv",
        files={"file": ("invalid.csv", invalid_csv, "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert len(body["errors"]) > 0
