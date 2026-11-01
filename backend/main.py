from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

from backend.schemas.transaction import TransactionRecord, CsvUploadResponse, CsvValidationError
from backend.schemas.graph import (
    GraphAnalysisResponse,
    GraphAnalysisSummary,
    SuspiciousGroup,
)
from backend.schemas.investigation import InvestigationStatus, InvestigationStatusUpdate
from backend.schemas.dashboard import DashboardSummary

from backend.services.fraud_service import (
    DEFAULT_THRESHOLD,
    FEATURES,
    predict_credit_card_fraud,
)
from backend.services.transaction_data_service import (
    load_sample_dataset,
    get_active_transactions,
    set_active_transactions,
    reset_active_transactions,
    parse_and_validate_csv,
)
from backend.services.graph_fraud_service import graph_fraud_engine
from backend.services.investigation_service import update_group_status
from backend.services.paypal_sandbox_service import (
    get_paypal_credentials_status,
    create_sandbox_order,
    capture_sandbox_order,
)

app = FastAPI(
    title="FraudRing AI",
    description="Detecting the connections behind payment fraud.",
    version="1.0.0",
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "FraudRing AI",
        "tagline": "Detecting the connections behind payment fraud.",
        "docs": "/docs",
        "status": "active",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/fraud/features")
def fraud_features():
    """List features expected by the transaction-level ML model."""
    return {"features": FEATURES, "threshold": DEFAULT_THRESHOLD}


@app.post("/fraud/predict")
def fraud_predict(transaction: Dict[str, float]):
    """Predict transaction fraud using the trained scikit-learn model."""
    try:
        return predict_credit_card_fraud(transaction)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/graph/demo-data")
def get_demo_data():
    """Returns sample dataset metadata and sample records."""
    records = get_active_transactions()
    return {
        "dataset_name": "Synthetic Payment Network Dataset",
        "total_records": len(records),
        "records_sample": [r.model_dump() for r in records[:10]],
    }


@app.post("/graph/load-sample", response_model=GraphAnalysisResponse)
def load_sample_and_analyze():
    """Resets active data to the bundled sample dataset and executes analysis."""
    records = reset_active_transactions()
    return graph_fraud_engine.analyze(records)


@app.post("/graph/upload-csv", response_model=CsvUploadResponse)
async def upload_csv_dataset(file: UploadFile = File(...)):
    """Upload and validate a transaction CSV dataset."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are accepted.")

    try:
        content_bytes = await file.read()
        csv_text = content_bytes.decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {str(exc)}")

    records, errors = parse_and_validate_csv(csv_text)

    if errors:
        return CsvUploadResponse(
            success=False,
            total_rows=len(records) + len(errors),
            valid_rows=len(records),
            errors=errors,
            message=f"Validation failed with {len(errors)} error(s).",
        )

    set_active_transactions(records)
    return CsvUploadResponse(
        success=True,
        total_rows=len(records),
        valid_rows=len(records),
        errors=[],
        message=f"Successfully loaded {len(records)} transaction records.",
    )


@app.post("/graph/analyze", response_model=GraphAnalysisResponse)
def run_graph_analysis():
    """Executes graph network analysis on currently active transaction dataset."""
    records = get_active_transactions()
    if not records:
        raise HTTPException(status_code=400, detail="No transaction records available. Please upload CSV or load sample data.")
    return graph_fraud_engine.analyze(records)


@app.get("/graph/summary", response_model=GraphAnalysisSummary)
def get_graph_summary():
    """Returns top-level metric counters for the active graph dataset."""
    records = get_active_transactions()
    analysis = graph_fraud_engine.analyze(records)
    return analysis.summary


@app.get("/graph/groups", response_model=List[SuspiciousGroup])
def list_suspicious_groups():
    """Lists all detected suspicious groups."""
    records = get_active_transactions()
    analysis = graph_fraud_engine.analyze(records)
    return analysis.groups


@app.get("/graph/groups/{group_id}", response_model=SuspiciousGroup)
def get_group_details(group_id: str):
    """Retrieves deep investigation details for a specific group."""
    records = get_active_transactions()
    analysis = graph_fraud_engine.analyze(records)
    for g in analysis.groups:
        if g.group_id == group_id:
            return g
    raise HTTPException(status_code=404, detail=f"Suspicious group '{group_id}' not found.")


@app.patch("/graph/groups/{group_id}/status", response_model=Dict[str, Any])
def update_investigation_status(group_id: str, payload: InvestigationStatusUpdate):
    """Persists workflow status changes for a suspicious group in SQLite."""
    # Verify group exists in current analysis
    records = get_active_transactions()
    analysis = graph_fraud_engine.analyze(records)
    matched = any(g.group_id == group_id for g in analysis.groups)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Suspicious group '{group_id}' not found in current analysis.")

    updated = update_group_status(
        group_id=group_id,
        status=payload.status,
        notes=payload.notes,
        assigned_to=payload.assigned_to,
    )
    return updated


@app.get("/graph/transactions/{transaction_id}")
def get_transaction_evidence(transaction_id: str):
    """Returns transaction details, associated suspicious groups, and ML inference if applicable."""
    records = get_active_transactions()
    matched_tx = next((t for t in records if t.transaction_id == transaction_id), None)
    if not matched_tx:
        raise HTTPException(status_code=404, detail=f"Transaction '{transaction_id}' not found.")

    analysis = graph_fraud_engine.analyze(records)
    involved_groups = [g for g in analysis.groups if transaction_id in g.transactions]

    return {
        "transaction": matched_tx.model_dump(),
        "is_flagged": len(involved_groups) > 0,
        "involved_groups": [g.group_id for g in involved_groups],
        "primary_patterns": [p.pattern_type for g in involved_groups for p in g.patterns],
    }


@app.get("/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    """Provides high-level dashboard metrics, status distribution, and risk breakdown."""
    records = get_active_transactions()
    analysis = graph_fraud_engine.analyze(records)

    status_dist = {"NEW": 0, "UNDER_REVIEW": 0, "ESCALATED": 0, "RESOLVED": 0}
    risk_dist = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

    for g in analysis.groups:
        status_dist[g.status.value] = status_dist.get(g.status.value, 0) + 1
        risk_dist[g.risk_level] = risk_dist.get(g.risk_level, 0) + 1

    return DashboardSummary(
        metrics=analysis.summary,
        recent_groups=analysis.groups[:5],
        status_distribution=status_dist,
        risk_distribution=risk_dist,
    )


# PayPal Sandbox Routes
class PayPalOrderRequest(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = "USD"


class PayPalCaptureRequest(BaseModel):
    order_id: str


@app.get("/paypal/status")
def paypal_status():
    """Checks whether PayPal Sandbox credentials are configured."""
    return get_paypal_credentials_status()


@app.post("/paypal/create-order")
async def paypal_create_order(request: PayPalOrderRequest):
    """Creates a payment order in PayPal Sandbox."""
    try:
        return await create_sandbox_order(amount=request.amount, currency=request.currency)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/paypal/capture-order")
async def paypal_capture_order(request: PayPalCaptureRequest):
    """Captures an approved PayPal order in Sandbox."""
    try:
        return await capture_sandbox_order(order_id=request.order_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))