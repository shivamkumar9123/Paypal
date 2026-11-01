"""
Transaction-level fraud prediction service.
Wraps the scikit-learn credit card fraud detection model.
"""
from backend.services.fraud_service import (
    FEATURES,
    DEFAULT_THRESHOLD,
    predict_credit_card_fraud,
)

# Export aliases for clean architecture
predict_transaction_fraud = predict_credit_card_fraud
