from fastapi.testclient import TestClient

from backend.main import app
from backend.services.fraud_service import FEATURES

client = TestClient(app)


def valid_payload():
    return {f: 0.0 for f in FEATURES}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_features_endpoint_lists_all_features():
    response = client.get("/fraud/features")
    assert response.status_code == 200
    assert response.json()["features"] == FEATURES


def test_predict_valid_transaction():
    response = client.post("/fraud/predict", json=valid_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"] in {"FRAUD", "LEGITIMATE"}
    assert 0.0 <= body["fraud_probability"] <= 1.0


def test_predict_missing_feature_returns_422():
    payload = valid_payload()
    del payload[FEATURES[0]]
    response = client.post("/fraud/predict", json=payload)
    assert response.status_code == 422
    assert "Missing required features" in response.json()["detail"]


def test_predict_non_numeric_returns_422():
    payload = valid_payload()
    payload[FEATURES[1]] = "abc"
    response = client.post("/fraud/predict", json=payload)
    assert response.status_code == 422