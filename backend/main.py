from pydantic import BaseModel
from typing import Dict

from backend.services.fraud_service import predict_credit_card_fraud
from fastapi import FastAPI, HTTPException

from backend.services.fraud_service import (
    DEFAULT_THRESHOLD,
    FEATURES,
    predict_credit_card_fraud,
)

app = FastAPI(title="PayPal AI Assistant")


@app.get("/")
def root():
    return {"service": "PayPal AI Assistant", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/fraud/features")
def fraud_features():
    """List the features the model expects."""
    return {"features": FEATURES, "threshold": DEFAULT_THRESHOLD}


@app.post("/fraud/predict")
def fraud_predict(transaction: dict[str, float]):
    try:
        return predict_credit_card_fraud(transaction)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))