from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.schemas.graph import GraphAnalysisSummary, SuspiciousGroup


class DashboardSummary(BaseModel):
    metrics: GraphAnalysisSummary
    recent_groups: List[SuspiciousGroup]
    status_distribution: Dict[str, int]
    risk_distribution: Dict[str, int]
