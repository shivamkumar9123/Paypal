from pydantic import BaseModel, Field
from typing import List, Optional


class TransactionRecord(BaseModel):
    transaction_id: str = Field(..., description="Unique identifier for the transaction")
    sender_id: str = Field(..., description="Account ID sending the funds")
    receiver_id: str = Field(..., description="Account ID receiving the funds")
    amount: float = Field(..., gt=0, description="Monetary value of the transaction")
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp")


class CsvValidationError(BaseModel):
    row: Optional[int] = Field(None, description="Row index where validation failed")
    field: Optional[str] = Field(None, description="Field name that failed validation")
    message: str = Field(..., description="Human-readable description of the error")


class CsvUploadResponse(BaseModel):
    success: bool
    total_rows: int
    valid_rows: int
    errors: List[CsvValidationError] = []
    message: str
