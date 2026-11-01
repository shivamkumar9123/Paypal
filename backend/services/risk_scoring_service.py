from typing import List, Tuple
from backend.schemas.graph import PatternDetection, ScoreContribution


def calculate_group_risk(
    patterns: List[PatternDetection],
    accounts_count: int,
    transactions_count: int,
    total_volume: float,
) -> Tuple[float, str, List[ScoreContribution]]:
    """
    Calculates a bounded, transparent, explainable heuristic risk score (0 to 100).
    Returns (score, risk_level, score_breakdown).
    """
    breakdown: List[ScoreContribution] = []
    base_score = 0.0

    pattern_types = set(p.pattern_type for p in patterns)

    if "CIRCULAR_FLOW" in pattern_types:
        pts = 45.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Circular Money Movement",
                points=pts,
                reason="Direct closed loop detected; funds circulate back to an originator account without economic justification.",
            )
        )

    if "MULTI_HOP_CHAIN" in pattern_types:
        pts = 25.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Multi-Hop Layering Chain",
                points=pts,
                reason="Sequential rapid transfers across multiple intermediary accounts designed to obscure funds origin.",
            )
        )

    if "RAPID_CONNECTED_TRANSFER" in pattern_types:
        pts = 20.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Rapid Connected Passthrough",
                points=pts,
                reason="Immediate re-transfer of received funds through an account within minutes, typical of mule accounts.",
            )
        )

    if "COMMON_RECIPIENT_CONCENTRATION" in pattern_types:
        pts = 25.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Common-Recipient Smurfing",
                points=pts,
                reason="Multiple distinct senders funneling structured funds to a single collector within a short time window.",
            )
        )

    if "REPEATED_INTERACTIONS" in pattern_types:
        pts = 15.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Repeated Account Ping-Pong",
                points=pts,
                reason="Unusually high frequency of back-and-forth transfers between counterparties in a short period.",
            )
        )

    if "VELOCITY_ANOMALY" in pattern_types:
        pts = 10.0
        base_score += pts
        breakdown.append(
            ScoreContribution(
                signal_name="Velocity Burst Anomaly",
                points=pts,
                reason="Sudden anomalous transaction frequency spike within a narrow 15-minute window.",
            )
        )

    # Complexity & Volume adjustments (bounded)
    if accounts_count >= 4:
        acc_pts = min(10.0, float(accounts_count * 1.5))
        base_score += acc_pts
        breakdown.append(
            ScoreContribution(
                signal_name="Coordinated Network Breadth",
                points=round(acc_pts, 1),
                reason=f"Network encompasses {accounts_count} interconnected participant accounts.",
            )
        )

    if total_volume > 10000.0:
        vol_pts = min(10.0, 5.0 + (total_volume / 20000.0) * 5.0)
        base_score += vol_pts
        breakdown.append(
            ScoreContribution(
                signal_name="Elevated Financial Exposure",
                points=round(vol_pts, 1),
                reason=f"Significant total transaction volume of ${total_volume:,.2f} at risk.",
            )
        )

    # Bound strictly between 0.0 and 100.0
    final_score = min(100.0, max(0.0, round(base_score, 1)))

    if final_score >= 80.0:
        level = "CRITICAL"
    elif final_score >= 60.0:
        level = "HIGH"
    elif final_score >= 35.0:
        level = "MEDIUM"
    else:
        level = "LOW"

    return final_score, level, breakdown


def generate_summary_narrative(
    patterns: List[PatternDetection],
    accounts: List[str],
    total_volume: float,
) -> str:
    """Generates an evidence-grounded explainable narrative for investigators."""
    types = [p.title for p in patterns]
    narratives = []

    narratives.append(
        f"Potentially coordinated network involving {len(accounts)} accounts with total transfer volume of ${total_volume:,.2f}."
    )

    for p in patterns:
        narratives.append(f"{p.title}: {p.description}")

    narratives.append(
        "Observation Note: Patterns reflect structural network anomalies indicative of potential coordinated fraud or layering. Recommend immediate account relationship verification."
    )

    return " ".join(narratives)


def generate_suggested_steps(patterns: List[PatternDetection]) -> List[str]:
    """Generates concrete, actionable investigative steps for fraud analysts."""
    steps = [
        "1. Freeze outbound transfers on primary hub and intermediary accounts pending review.",
        "2. Inspect device fingerprints, shared IP addresses, and bank routing numbers among connected accounts.",
    ]
    pattern_types = set(p.pattern_type for p in patterns)

    if "CIRCULAR_FLOW" in pattern_types:
        steps.append("3. Trace fund cycle origin: verify whether initial funding was from a compromised instrument.")
    if "COMMON_RECIPIENT_CONCENTRATION" in pattern_types:
        steps.append("4. Contact sender account holders to verify whether transfers were authorized or orchestrated by a third party.")
    if "RAPID_CONNECTED_TRANSFER" in pattern_types or "MULTI_HOP_CHAIN" in pattern_types:
        steps.append("5. Subpoena or place hold on final cash-out / offshore destination account.")

    steps.append("6. File Suspicious Activity Report (SAR) if no legitimate commercial rationale is provided.")
    return steps
