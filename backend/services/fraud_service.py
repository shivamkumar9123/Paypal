from pathlib import Path
import math

import joblib
import pandas as pd


# Locate the project directory
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = PROJECT_ROOT / "models" / "fraud_model.joblib"

# Load the trained ML model
_saved_model = joblib.load(MODEL_PATH)

model = _saved_model["model"]
FEATURES = _saved_model["features"]
DEFAULT_THRESHOLD = float(_saved_model.get("threshold", 0.5))


def predict_credit_card_fraud(transaction: dict) -> dict:
    """Predict fraud using the trained Logistic Regression model."""

    missing_features = [
        feature for feature in FEATURES
        if feature not in transaction
    ]

    if missing_features:
        raise ValueError(
            "Missing required features: "
            + ", ".join(missing_features)
        )

    try:
        row = {
            feature: float(transaction[feature])
            for feature in FEATURES
        }
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "All features must contain valid numbers."
        ) from exc

    if not all(math.isfinite(value) for value in row.values()):
        raise ValueError("Features must contain finite numbers.")

    input_df = pd.DataFrame([row], columns=FEATURES)

    probability = float(model.predict_proba(input_df)[0, 1])
    prediction = int(probability >= DEFAULT_THRESHOLD)

    return {
        "model_type": "Logistic Regression",
        "prediction": "FRAUD" if prediction else "LEGITIMATE",
        "fraud_probability": round(probability, 6),
        "fraud_probability_percent": round(probability * 100, 2),
        "threshold": DEFAULT_THRESHOLD,
        "threshold_percent": round(DEFAULT_THRESHOLD * 100, 2),
    }