import pytest
from backend.services.graph_fraud_service import GraphFraudEngine
from backend.schemas.transaction import TransactionRecord


@pytest.fixture
def engine():
    return GraphFraudEngine()


def test_circular_money_movement_detection(engine):
    # Ring of 3 accounts: A -> B -> C -> A
    txs = [
        TransactionRecord(transaction_id="T1", sender_id="ACC_A", receiver_id="ACC_B", amount=1000.0, timestamp="2026-11-01T10:00:00Z"),
        TransactionRecord(transaction_id="T2", sender_id="ACC_B", receiver_id="ACC_C", amount=990.0, timestamp="2026-11-01T10:05:00Z"),
        TransactionRecord(transaction_id="T3", sender_id="ACC_C", receiver_id="ACC_A", amount=980.0, timestamp="2026-11-01T10:10:00Z"),
    ]
    response = engine.analyze(txs)
    assert len(response.groups) >= 1
    cycle_groups = [g for g in response.groups if any(p.pattern_type == "CIRCULAR_FLOW" for p in g.patterns)]
    assert len(cycle_groups) == 1
    assert set(cycle_groups[0].accounts) == {"ACC_A", "ACC_B", "ACC_C"}
    assert cycle_groups[0].risk_level in ["HIGH", "CRITICAL"]


def test_common_recipient_smurfing_detection(engine):
    # 4 distinct mules sending to 1 collector within 20 minutes
    txs = [
        TransactionRecord(transaction_id="S1", sender_id="MULE_1", receiver_id="COLLECTOR", amount=2900.0, timestamp="2026-11-01T11:00:00Z"),
        TransactionRecord(transaction_id="S2", sender_id="MULE_2", receiver_id="COLLECTOR", amount=2950.0, timestamp="2026-11-01T11:05:00Z"),
        TransactionRecord(transaction_id="S3", sender_id="MULE_3", receiver_id="COLLECTOR", amount=2980.0, timestamp="2026-11-01T11:10:00Z"),
        TransactionRecord(transaction_id="S4", sender_id="MULE_4", receiver_id="COLLECTOR", amount=2920.0, timestamp="2026-11-01T11:15:00Z"),
    ]
    response = engine.analyze(txs)
    smurf_groups = [g for g in response.groups if any(p.pattern_type == "COMMON_RECIPIENT_CONCENTRATION" for p in g.patterns)]
    assert len(smurf_groups) >= 1
    assert "COLLECTOR" in smurf_groups[0].accounts


def test_multi_hop_chain_detection(engine):
    # A -> B -> C -> D rapid sequential layering
    txs = [
        TransactionRecord(transaction_id="H1", sender_id="ACC_1", receiver_id="ACC_2", amount=5000.0, timestamp="2026-11-01T12:00:00Z"),
        TransactionRecord(transaction_id="H2", sender_id="ACC_2", receiver_id="ACC_3", amount=4900.0, timestamp="2026-11-01T12:05:00Z"),
        TransactionRecord(transaction_id="H3", sender_id="ACC_3", receiver_id="ACC_4", amount=4800.0, timestamp="2026-11-01T12:10:00Z"),
        TransactionRecord(transaction_id="H4", sender_id="ACC_4", receiver_id="ACC_5", amount=4700.0, timestamp="2026-11-01T12:15:00Z"),
    ]
    response = engine.analyze(txs)
    chain_groups = [g for g in response.groups if any(p.pattern_type == "MULTI_HOP_CHAIN" for p in g.patterns)]
    assert len(chain_groups) >= 1


def test_repeated_interactions_detection(engine):
    # Ping-pong between two accounts
    txs = [
        TransactionRecord(transaction_id="P1", sender_id="P1", receiver_id="P2", amount=500.0, timestamp="2026-11-01T13:00:00Z"),
        TransactionRecord(transaction_id="P2", sender_id="P2", receiver_id="P1", amount=500.0, timestamp="2026-11-01T13:03:00Z"),
        TransactionRecord(transaction_id="P3", sender_id="P1", receiver_id="P2", amount=500.0, timestamp="2026-11-01T13:06:00Z"),
        TransactionRecord(transaction_id="P4", sender_id="P2", receiver_id="P1", amount=500.0, timestamp="2026-11-01T13:09:00Z"),
    ]
    response = engine.analyze(txs)
    pair_groups = [g for g in response.groups if any(p.pattern_type == "REPEATED_INTERACTIONS" for p in g.patterns)]
    assert len(pair_groups) >= 1
    assert set(pair_groups[0].accounts) == {"P1", "P2"}


def test_legitimate_high_volume_merchant_not_flagged_as_ring(engine):
    # A merchant receiving 8 payments across 8 hours (1 per hour) with no cycles and no rapid outgoing
    txs = [
        TransactionRecord(transaction_id=f"M_{i}", sender_id=f"CUST_{i}", receiver_id="MERCHANT_LEGAL", amount=50.0 + i * 10, timestamp=f"2026-11-01T{8+i:02d}:00:00Z")
        for i in range(8)
    ]
    response = engine.analyze(txs)
    # The merchant should NOT be part of any suspicious group
    merchant_groups = [g for g in response.groups if "MERCHANT_LEGAL" in g.accounts]
    assert len(merchant_groups) == 0


def test_isolated_accounts_and_empty_dataset(engine):
    # Empty dataset
    resp_empty = engine.analyze([])
    assert resp_empty.summary.total_transactions == 0
    assert len(resp_empty.groups) == 0

    # Normal isolated single payment
    txs = [TransactionRecord(transaction_id="T_ISO", sender_id="USER_X", receiver_id="USER_Y", amount=15.0, timestamp="2026-11-01T09:00:00Z")]
    resp_iso = engine.analyze(txs)
    assert resp_iso.summary.total_transactions == 1
    assert len(resp_iso.groups) == 0
