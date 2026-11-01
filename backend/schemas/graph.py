from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from backend.schemas.investigation import InvestigationStatus


class GraphNode(BaseModel):
    id: str
    label: str
    in_degree: int = 0
    out_degree: int = 0
    total_inflow: float = 0.0
    total_outflow: float = 0.0
    risk_level: str = "LOW"
    group_ids: List[str] = []


class GraphEdge(BaseModel):
    id: str
    from_node: str
    to_node: str
    amount: float
    timestamp: str
    transaction_id: str
    is_suspicious: bool = False
    group_ids: List[str] = []


class PatternDetection(BaseModel):
    pattern_type: str
    title: str
    description: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    accounts_involved: List[str]
    transactions_involved: List[str]
    evidence_details: Dict[str, Any] = {}


class ScoreContribution(BaseModel):
    signal_name: str
    points: float
    reason: str


class SuspiciousGroup(BaseModel):
    group_id: str
    risk_score: float  # Bounded 0.0 to 100.0
    risk_level: str   # LOW, MEDIUM, HIGH, CRITICAL
    accounts: List[str]
    transactions: List[str]
    patterns: List[PatternDetection]
    score_breakdown: List[ScoreContribution]
    total_volume: float
    earliest_timestamp: Optional[str] = None
    latest_timestamp: Optional[str] = None
    summary_narrative: str
    suggested_steps: List[str]
    status: InvestigationStatus = InvestigationStatus.NEW
    assigned_to: Optional[str] = "Fraud Analyst"
    notes: Optional[str] = ""
    updated_at: str


class GraphAnalysisSummary(BaseModel):
    total_transactions: int
    total_accounts: int
    suspicious_groups_count: int
    suspicious_transactions_count: int
    high_or_critical_groups_count: int
    total_suspicious_volume: float
    total_volume: float
    groups_awaiting_review: int


class GraphAnalysisResponse(BaseModel):
    summary: GraphAnalysisSummary
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    groups: List[SuspiciousGroup]
