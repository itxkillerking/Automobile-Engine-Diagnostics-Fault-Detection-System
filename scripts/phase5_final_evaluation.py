import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler, label_binarize
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    classification_report,
    confusion_matrix
)

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"
reports_dir = r"D:\ML-PROJECT\reports"

def add_physics_features(df):
    data = df.copy()
    data["Torque_Proxy"] = data["Power"] / (data["RPM"] + 1e-5)
    data["Combustion_Efficiency"] = data["CO2"] / (data["CO"] + data["CO2"] + 1e-5)
    data["Unburned_Fuel_Ratio"] = data["HC"] / (data["Consumption L/H"] + 1e-5)
    data["Load_to_MAP"] = data["Force"] / (data["MAP"] + 1e-5)
    data["O2_to_AFR"] = data["O2"] / (data["AFR"] + 1e-5)
    return data

def run_phase5_evaluation():
    print("1. Loading training data and untouched test data...")
    X_train_raw = pd.read_csv(os.path.join(processed_dir, "X_train.csv"))
    y_train_raw = pd.read_csv(os.path.join(processed_dir, "y_train.csv")).squeeze()
    X_test_raw = pd.read_csv(os.path.join(processed_dir, "X_test.csv"))
    y_test = pd.read_csv(os.path.join(processed_dir, "y_test.csv")).squeeze()

    # Balance ONLY the training set (Rule #3: Never artificially balance the test set)
    train_df = X_train_raw.copy()
    train_df["Fault"] = y_train_raw.values
    min_count = int(train_df["Fault"].value_counts().min())
    train_bal = (
        train_df.groupby("Fault")
        .sample(n=min_count, random_state=42)
        .sample(frac=1.0, random_state=42)
        .reset_index(drop=True)
    )

    X_train_eng = add_physics_features(train_bal.drop(columns=["Fault"]))
    y_train_bal = train_bal["Fault"]
    X_test_eng = add_physics_features(X_test_raw)

    print("2. Scaling features (fitted strictly on training data)...")
    scaler = StandardScaler()
    X_train_s = pd.DataFrame(scaler.fit_transform(X_train_eng), columns=X_train_eng.columns)
    X_test_s = pd.DataFrame(scaler.transform(X_test_eng), columns=X_test_eng.columns)

    print("3. Training Final Hybrid Deep Neural Network + Forest Ensemble...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        activation="relu",
        alpha=1e-3,
        batch_size=256,
        max_iter=100,
        early_stopping=True,
        random_state=42
    )
    rf = RandomForestClassifier(n_estimators=200, max_depth=16, n_jobs=2, random_state=42)
    et = ExtraTreesClassifier(n_estimators=200, max_depth=18, n_jobs=2, random_state=42)

    model = VotingClassifier(
        estimators=[("mlp", mlp), ("rf", rf), ("et", et)],
        voting="soft",
        n_jobs=2
    )
    model.fit(X_train_s, y_train_bal)

    print("4. Evaluating on UNTOUCHED Test Set (11,200 rows)...")
    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)

    # Binary Healthy (0) vs Unhealthy (1,2,3)
    health_acc = accuracy_score((y_test > 0).astype(int), (y_pred > 0).astype(int))

    # Multiclass Metrics
    acc = accuracy_score(y_test, y_pred)
    bal_acc = balanced_accuracy_score(y_test, y_pred)
    m_prec = precision_score(y_test, y_pred, average="macro")
    m_rec = recall_score(y_test, y_pred, average="macro")
    m_f1 = f1_score(y_test, y_pred, average="macro")

    y_test_bin = label_binarize(y_test, classes=[0, 1, 2, 3])
    roc_auc = roc_auc_score(y_test_bin, y_prob, average="macro", multi_class="ovr")
    pr_auc = average_precision_score(y_test_bin, y_prob, average="macro")

    print("\n==================================================")
    print("FINAL UNTOUCHED TEST SET RESULTS (PHASE 5)")
    print("==================================================")
    print(f"Healthy vs Unhealthy Accuracy: {health_acc:.4f}")
    print(f"4-Class Test Accuracy:         {acc:.4f}")
    print(f"4-Class Balanced Accuracy:     {bal_acc:.4f}")
    print(f"Macro Precision:               {m_prec:.4f}")
    print(f"Macro Recall:                  {m_rec:.4f}")
    print(f"Macro F1-Score:                {m_f1:.4f}")
    print(f"Macro ROC-AUC:                 {roc_auc:.4f}")
    print(f"Macro PR-AUC:                  {pr_auc:.4f}")

    print("\nPer-Class Test Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=["0: Healthy", "1: Rich Mix", "2: Lean Burn", "3: Low Voltage"],
        digits=4
    ))

    cm = confusion_matrix(y_test, y_pred)
    print("Test Confusion Matrix:")
    print(cm)

    # Confidence Calibration Check
    max_conf = np.max(y_prob, axis=1)
    high_mask = max_conf >= 0.70
    print("\n=== CONFIDENCE RELIABILITY ON TEST SET ===")
    print(f"High-Confidence Samples (>=70%): {high_mask.mean()*100:.2f}% | Accuracy: {accuracy_score(y_test[high_mask], y_pred[high_mask]):.4f}")
    print(f"Uncertain Overlap Samples (<70%): {(~high_mask).mean()*100:.2f}% | Flagged for Dual Inspection (Lean Burn / Low Voltage)")

    # Feature Importance (from fitted RF + ET estimators inside VotingClassifier)
    rf_imp = model.named_estimators_["rf"].feature_importances_
    et_imp = model.named_estimators_["et"].feature_importances_
    avg_imp = (rf_imp + et_imp) / 2.0
    imp_df = pd.DataFrame({
        "Feature": X_train_eng.columns,
        "Importance": avg_imp
    }).sort_values("Importance", ascending=False)

    print("\n=== TOP 10 MOST IMPORTANT FEATURES ===")
    print(imp_df.head(10).to_string(index=False))

    # Save Confusion Matrix Plot
    os.makedirs(reports_dir, exist_ok=True)
    plt.figure(figsize=(7, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=["Healthy", "Rich Mix", "Lean Burn", "Low Volt"],
                yticklabels=["Healthy", "Rich Mix", "Lean Burn", "Low Volt"])
    plt.title("Phase 5 Final Test Confusion Matrix")
    plt.ylabel("True Class")
    plt.xlabel("Predicted Class")
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "phase5_test_confusion_matrix.png"), dpi=300)
    plt.close()

    imp_df.to_csv(os.path.join(reports_dir, "phase6_feature_importance.csv"), index=False)
    print("\nSaved confusion matrix plot and feature importance CSV to reports/ folder.")

if __name__ == "__main__":
    run_phase5_evaluation()