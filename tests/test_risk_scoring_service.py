from backend.services.risk_scoring_service import calculate_group_risk, generate_summary_narrative, generate_suggested_steps
from backend.schemas.graph import PatternDetection


def test_risk_scoring_bounds_and_breakdown():
    # Empty patterns
    score, level, breakdown = calculate_group_risk([], accounts_count=2, transactions_count=1, total_volume=100.0)
    assert 0.0 <= score <= 100.0
    assert level == "LOW"

    # Critical patterns (Cycle + Multi-hop + High Volume)
    patterns = [
        PatternDetection(
            pattern_type="CIRCULAR_FLOW",
            title="Circular Flow",
            description="Cycle detected",
            severity="CRITICAL",
            accounts_involved=["A", "B", "C"],
            transactions_involved=["T1", "T2", "T3"],
        ),
        PatternDetection(
            pattern_type="MULTI_HOP_CHAIN",
            title="Multi Hop",
            description="Chain detected",
            severity="HIGH",
            accounts_involved=["A", "B", "C", "D"],
            transactions_involved=["T1", "T2", "T3", "T4"],
        ),
        PatternDetection(
            pattern_type="RAPID_CONNECTED_TRANSFER",
            title="Rapid Transfer",
            description="Passthrough",
            severity="HIGH",
            accounts_involved=["B", "C", "D"],
            transactions_involved=["T2", "T3"],
        ),
    ]

    score, level, breakdown = calculate_group_risk(patterns, accounts_count=4, transactions_count=4, total_volume=25000.0)
    assert score == 100.0
    assert level == "CRITICAL"
    assert len(breakdown) >= 3

    # For an uncapped scenario, verify exact points match
    uncapped_patterns = [patterns[2]]  # RAPID_CONNECTED_TRANSFER only = 20 pts
    u_score, u_level, u_breakdown = calculate_group_risk(uncapped_patterns, accounts_count=2, transactions_count=2, total_volume=500.0)
    assert u_score == 20.0
    assert u_level == "LOW"
    assert sum(item.points for item in u_breakdown) == u_score


def test_narrative_and_suggested_steps_generation():
    patterns = [
        PatternDetection(
            pattern_type="CIRCULAR_FLOW",
            title="Circular Money Movement",
            description="Closed loop A -> B -> C -> A",
            severity="CRITICAL",
            accounts_involved=["A", "B", "C"],
            transactions_involved=["T1", "T2", "T3"],
        )
    ]
    narrative = generate_summary_narrative(patterns, ["A", "B", "C"], 15000.0)
    assert "Potentially coordinated network" in narrative
    assert "$15,000.00" in narrative
    assert "Circular Money Movement" in narrative

    steps = generate_suggested_steps(patterns)
    assert len(steps) >= 3
    assert any("Freeze outbound" in s for s in steps)
    assert any("fund cycle origin" in s for s in steps)
