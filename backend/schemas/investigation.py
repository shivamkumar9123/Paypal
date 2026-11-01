from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


class InvestigationStatus(str, Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class InvestigationRecord(BaseModel):
    group_id: str
    status: InvestigationStatus = InvestigationStatus.NEW
    notes: Optional[str] = ""
    assigned_to: Optional[str] = "Fraud Analyst"
    updated_at: str


class InvestigationStatusUpdate(BaseModel):
    status: InvestigationStatus
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
