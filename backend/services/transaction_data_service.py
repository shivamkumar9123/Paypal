import csv
import io
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from dateutil import parser as date_parser

from backend.schemas.transaction import TransactionRecord, CsvUploadResponse, CsvValidationError

REQUIRED_COLUMNS = ["transaction_id", "sender_id", "receiver_id", "amount", "timestamp"]
MAX_ROW_LIMIT = 5000
SAMPLE_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "sample_transactions.csv"

# Global active transaction memory store for the current session
_active_transactions: List[TransactionRecord] = []


def parse_and_validate_csv(csv_content: str) -> Tuple[List[TransactionRecord], List[CsvValidationError]]:
    errors: List[CsvValidationError] = []
    records: List[TransactionRecord] = []
    seen_tx_ids = set()

    if not csv_content or not csv_content.strip():
        errors.append(CsvValidationError(message="The CSV file is completely empty."))
        return [], errors

    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    if not reader.fieldnames:
        errors.append(CsvValidationError(message="CSV file contains no headers."))
        return [], errors

    # Check for missing required columns
    normalized_headers = [h.strip() for h in reader.fieldnames if h]
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in normalized_headers]
    if missing_cols:
        errors.append(
            CsvValidationError(
                message=f"Missing required column(s): {', '.join(missing_cols)}. Expected headers: {', '.join(REQUIRED_COLUMNS)}"
            )
        )
        return [], errors

    row_count = 0
    for idx, row in enumerate(reader, start=2):  # start=2 considering header is row 1
        row_count += 1
        if row_count > MAX_ROW_LIMIT:
            errors.append(
                CsvValidationError(
                    row=idx,
                    message=f"File exceeds maximum allowed limit of {MAX_ROW_LIMIT} rows."
                )
            )
            break

        tx_id = (row.get("transaction_id") or "").strip()
        sender_id = (row.get("sender_id") or "").strip()
        receiver_id = (row.get("receiver_id") or "").strip()
        raw_amount = (row.get("amount") or "").strip()
        raw_timestamp = (row.get("timestamp") or "").strip()

        # Check missing identifiers
        if not tx_id:
            errors.append(CsvValidationError(row=idx, field="transaction_id", message="Missing transaction_id."))
            continue
        if not sender_id:
            errors.append(CsvValidationError(row=idx, field="sender_id", message="Missing sender_id."))
            continue
        if not receiver_id:
            errors.append(CsvValidationError(row=idx, field="receiver_id", message="Missing receiver_id."))
            continue
        if sender_id == receiver_id:
            errors.append(CsvValidationError(row=idx, field="receiver_id", message="Self-transfers (sender_id equals receiver_id) are not allowed."))
            continue

        # Check duplicate transaction IDs
        if tx_id in seen_tx_ids:
            errors.append(CsvValidationError(row=idx, field="transaction_id", message=f"Duplicate transaction_id: '{tx_id}'."))
            continue
        seen_tx_ids.add(tx_id)

        # Parse amount
        try:
            amount = float(raw_amount)
            if amount <= 0:
                errors.append(CsvValidationError(row=idx, field="amount", message=f"Amount must be positive, got {raw_amount}."))
                continue
        except (ValueError, TypeError):
            errors.append(CsvValidationError(row=idx, field="amount", message=f"Invalid numeric amount '{raw_amount}'."))
            continue

        # Parse timestamp
        try:
            parsed_dt = date_parser.isoparse(raw_timestamp)
            iso_timestamp = parsed_dt.isoformat()
        except Exception:
            try:
                parsed_dt = datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
                iso_timestamp = parsed_dt.isoformat()
            except Exception:
                errors.append(CsvValidationError(row=idx, field="timestamp", message=f"Invalid ISO 8601 timestamp '{raw_timestamp}'."))
                continue

        records.append(
            TransactionRecord(
                transaction_id=tx_id,
                sender_id=sender_id,
                receiver_id=receiver_id,
                amount=amount,
                timestamp=iso_timestamp,
            )
        )

    if not records and not errors:
        errors.append(CsvValidationError(message="No data rows found in the CSV file."))

    return records, errors


def load_sample_dataset() -> List[TransactionRecord]:
    global _active_transactions
    if not SAMPLE_DATA_PATH.exists():
        raise FileNotFoundError(f"Sample data file not found at {SAMPLE_DATA_PATH}")

    content = SAMPLE_DATA_PATH.read_text(encoding="utf-8")
    records, errors = parse_and_validate_csv(content)
    if errors:
        raise ValueError(f"Error loading bundled sample data: {errors[0].message}")
    _active_transactions = records
    return _active_transactions


def get_active_transactions() -> List[TransactionRecord]:
    global _active_transactions
    if not _active_transactions:
        load_sample_dataset()
    return _active_transactions


def set_active_transactions(records: List[TransactionRecord]) -> None:
    global _active_transactions
    _active_transactions = records


def reset_active_transactions() -> List[TransactionRecord]:
    return load_sample_dataset()
