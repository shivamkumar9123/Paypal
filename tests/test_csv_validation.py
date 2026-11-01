from backend.services.transaction_data_service import parse_and_validate_csv


def test_valid_csv_parsing():
    valid_csv = """transaction_id,sender_id,receiver_id,amount,timestamp
TX_01,ACC_1,ACC_2,150.00,2026-11-01T10:00:00Z
TX_02,ACC_2,ACC_3,200.50,2026-11-01T10:05:00Z
"""
    records, errors = parse_and_validate_csv(valid_csv)
    assert len(errors) == 0
    assert len(records) == 2
    assert records[0].transaction_id == "TX_01"
    assert records[0].amount == 150.00


def test_missing_header_columns():
    bad_csv = """transaction_id,sender_id,amount
TX_01,ACC_1,150.00
"""
    records, errors = parse_and_validate_csv(bad_csv)
    assert len(errors) == 1
    assert "Missing required column(s)" in errors[0].message


def test_negative_amount_and_self_transfer():
    csv_content = """transaction_id,sender_id,receiver_id,amount,timestamp
TX_01,ACC_1,ACC_1,100.00,2026-11-01T10:00:00Z
TX_02,ACC_1,ACC_2,-50.00,2026-11-01T10:05:00Z
TX_03,ACC_1,ACC_2,abc,2026-11-01T10:10:00Z
"""
    records, errors = parse_and_validate_csv(csv_content)
    assert len(records) == 0
    assert len(errors) == 3
    assert any("Self-transfers" in e.message for e in errors)
    assert any("must be positive" in e.message for e in errors)
    assert any("Invalid numeric amount" in e.message for e in errors)


def test_duplicate_transaction_id():
    csv_content = """transaction_id,sender_id,receiver_id,amount,timestamp
TX_01,ACC_1,ACC_2,100.00,2026-11-01T10:00:00Z
TX_01,ACC_2,ACC_3,200.00,2026-11-01T10:05:00Z
"""
    records, errors = parse_and_validate_csv(csv_content)
    assert len(records) == 1
    assert len(errors) == 1
    assert "Duplicate transaction_id" in errors[0].message


def test_invalid_timestamp():
    csv_content = """transaction_id,sender_id,receiver_id,amount,timestamp
TX_01,ACC_1,ACC_2,100.00,not_a_valid_date
"""
    records, errors = parse_and_validate_csv(csv_content)
    assert len(errors) == 1
    assert "Invalid ISO 8601 timestamp" in errors[0].message
