import os
import time
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix
)

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"
reports_dir = r"D:\ML-PROJECT\reports"

def evaluate_model(name, y_true, y_pred, elapsed_sec):
    acc = accuracy_score(y_true, y_pred)
    bal_acc = balanced_accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(y_true, y_pred, average="macro")
    
    # Check Healthy (0) vs Unhealthy (1, 2, 3) accuracy
    y_true_health = (y_true > 0).astype(int)
    y_pred_health = (y_pred > 0).astype(int)
    health_acc = accuracy_score(y_true_health, y_pred_health)

    print(f"\n==========================================")
    print(f"MODEL: {name} (Time: {elapsed_sec:.2f}s)")
    print(f"==========================================")
    print(f"1. Healthy vs Unhealthy Accuracy: {health_acc:.4f}")
    print(f"2. 4-Class Accuracy:              {acc:.4f}")
    print(f"3. 4-Class Macro F1-Score:        {macro_f1:.4f}")
    print("\nPer-Class Report:")
    print(classification_report(
        y_true, y_pred,
        target_names=["0: Healthy", "1: Rich Mix", "2: Lean Burn", "3: Low Voltage"],
        digits=4
    ))
    print("Confusion Matrix (Rows = True, Cols = Predicted):")
    print(confusion_matrix(y_true, y_pred))

    return {
        "Model": name,
        "Health_Acc": round(health_acc, 4),
        "4Class_Acc": round(acc, 4),
        "Balanced_Acc": round(bal_acc, 4),
        "Macro_F1": round(macro_f1, 4),
        "Time_Sec": round(elapsed_sec, 2)
    }

def run_phase4():
    print("Loading BALANCED and SCALED training data...")
    X = pd.read_csv(os.path.join(processed_dir, "X_train_balanced.csv"))
    y = pd.read_csv(os.path.join(processed_dir, "y_train_balanced.csv")).squeeze()

    # 80% internal train, 20% internal validation (X_test remains untouched)
    X_tr, X_val, y_tr, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train Shape: {X_tr.shape} | Validation Shape: {X_val.shape}")

    results = []

    # 1. Logistic Regression
    print("\n[1/3] Training Logistic Regression...")
    t0 = time.time()
    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(X_tr, y_tr)
    results.append(evaluate_model("Logistic Regression", y_val, lr.predict(X_val), time.time() - t0))

    # 2. Random Forest (RAM-safe n_jobs=2)
    print("\n[2/3] Training Random Forest...")
    t0 = time.time()
    rf = RandomForestClassifier(n_estimators=150, max_depth=16, n_jobs=2, random_state=42)
    rf.fit(X_tr, y_tr)
    results.append(evaluate_model("Random Forest", y_val, rf.predict(X_val), time.time() - t0))

    # 3. Deep Neural Network (MLP 128-64-32)
    print("\n[3/3] Training Deep Neural Network (MLP 128-64-32)...")
    t0 = time.time()
    mlp = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=1e-4,
        batch_size=256,
        learning_rate_init=0.001,
        max_iter=80,
        early_stopping=True,
        n_iter_no_change=10,
        random_state=42
    )
    mlp.fit(X_tr, y_tr)
    results.append(evaluate_model("Deep Neural Network (MLP)", y_val, mlp.predict(X_val), time.time() - t0))

    results_df = pd.DataFrame(results)
    os.makedirs(reports_dir, exist_ok=True)
    results_df.to_csv(os.path.join(reports_dir, "phase4_validation_comparison.csv"), index=False)

    print("\n=== PHASE 4 SUMMARY TABLE ===")
    print(results_df.to_string(index=False))

if __name__ == "__main__":
    run_phase4()