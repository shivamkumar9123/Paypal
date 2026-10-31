import pytest

from backend.services.fraud_service import predict_credit_card_fraud, FEATURES


def valid_transaction():
    return {f: 0.0 for f in FEATURES}


def test_valid_transaction_returns_expected_fields():
    result = predict_credit_card_fraud(valid_transaction())
    assert result["prediction"] in {"FRAUD", "LEGITIMATE"}
    assert 0.0 <= result["fraud_probability"] <= 1.0
    assert result["threshold"] == pytest.approx(0.5)


def test_missing_feature_raises():
    tx = valid_transaction()
    del tx[FEATURES[0]]
    with pytest.raises(ValueError, match="Missing required features"):
        predict_credit_card_fraud(tx)


def test_non_numeric_value_raises():
    tx = valid_transaction()
    tx[FEATURES[1]] = "abc"
    with pytest.raises(ValueError, match="valid numbers"):
        predict_credit_card_fraud(tx)


def test_non_finite_value_raises():
    tx = valid_transaction()
    tx[FEATURES[2]] = float("inf")
    with pytest.raises(ValueError, match="finite"):
        predict_credit_card_fraud(tx)
