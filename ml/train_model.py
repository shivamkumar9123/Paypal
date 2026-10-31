import os
import time
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    average_precision_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline

# File paths
DATA_PATH = "data/creditcard.csv"
MODEL_PATH = "models/fraud_model.joblib"

def main():
    start_time = time.time()

    print("=" * 55)
    print("       FraudShield AI - Fraud Detection Training")
    print("=" * 55)

    # 1. Load dataset
    print("\n[1/5] Loading dataset...")
    df = pd.read_csv(DATA_PATH)

    print("Dataset shape:", df.shape)
    print("\nClass distribution:")
    print(df["Class"].value_counts().sort_index())

    # 2. Prepare features and target
    print("\n[2/5] Preparing features...")

    X = df.drop(columns=["Class"])
    y = df["Class"].astype(int)

    if set(y.unique()) != {0, 1}:
        raise ValueError("Dataset must contain both Class 0 and Class 1.")

    # 3. Split dataset
    print("\n[3/5] Splitting dataset...")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    print("Training rows:", len(X_train))
    print("Testing rows:", len(X_test))

    # 4. Train ML model
    print("\n[4/5] Training Logistic Regression model...")
    print("This may take a few minutes.")

    model = Pipeline([
        ("scaler", StandardScaler()),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ])

    model.fit(X_train, y_train)

    # 5. Evaluate model
    print("\n[5/5] Evaluating model...")

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["Legitimate", "Fraud"],
            zero_division=0,
        )
    )

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions, labels=[0, 1]))

    print(
        "Average Precision:",
        round(average_precision_score(y_test, probabilities), 4),
    )

    print(
        "ROC-AUC:",
        round(roc_auc_score(y_test, probabilities), 4),
    )

    # Save trained model and metadata
    os.makedirs("models", exist_ok=True)

    joblib.dump(
        {
            "model": model,
            "features": X.columns.tolist(),
            "target": "Class",
            "threshold": 0.5,
        },
        MODEL_PATH,
    )

    print(f"\nModel saved successfully: {MODEL_PATH}")
    print(f"Training time: {time.time() - start_time:.1f} seconds")
    print("\nFraudShield AI training completed!")

if __name__ == "__main__":
    main()