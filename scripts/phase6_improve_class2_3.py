import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"

def add_physics_features(df):
    data = df.copy()
    # Engine physics interaction features
    data["Torque_Proxy"] = data["Power"] / (data["RPM"] + 1e-5)
    data["Combustion_Efficiency"] = data["CO2"] / (data["CO"] + data["CO2"] + 1e-5)
    data["Unburned_Fuel_Ratio"] = data["HC"] / (data["Consumption L/H"] + 1e-5)
    data["Load_to_MAP"] = data["Force"] / (data["MAP"] + 1e-5)
    data["O2_to_AFR"] = data["O2"] / (data["AFR"] + 1e-5)
    return data

def run_improvement():
    print("1. Loading original unscaled training split to inspect Class 2 vs Class 3...")
    X_raw = pd.read_csv(os.path.join(processed_dir, "X_train.csv"))
    y_raw = pd.read_csv(os.path.join(processed_dir, "y_train.csv")).squeeze()

    # Balance raw training data equally
    df_all = X_raw.copy()
    df_all["Fault"] = y_raw.values
    min_count = int(df_all["Fault"].value_counts().min())
    df_bal = (
        df_all.groupby("Fault")
        .sample(n=min_count, random_state=42)
        .sample(frac=1.0, random_state=42)
        .reset_index(drop=True)
    )

    # Compare Class 2 vs Class 3 means and min/max
    print("\n=== CLASS 2 (Lean Burn) vs CLASS 3 (Low Voltage) SENSOR MEANS ===")
    c2_mean = df_bal[df_bal["Fault"] == 2].drop(columns=["Fault"]).mean()
    c3_mean = df_bal[df_bal["Fault"] == 3].drop(columns=["Fault"]).mean()
    comp_df = pd.DataFrame({"Class_2_Mean": c2_mean, "Class_3_Mean": c3_mean})
    comp_df["Diff_%"] = ((comp_df["Class_3_Mean"] - comp_df["Class_2_Mean"]).abs() / (comp_df["Class_2_Mean"].abs() + 1e-5)) * 100
    print(comp_df.round(3))

    # Add new physics features
    print("\n2. Adding 5 Engine Physics Features and Scaling...")
    X_eng = add_physics_features(df_bal.drop(columns=["Fault"]))
    y_bal = df_bal["Fault"]

    X_tr, X_val, y_tr, y_val = train_test_split(
        X_eng, y_bal, test_size=0.20, random_state=42, stratify=y_bal
    )

    scaler = StandardScaler()
    X_tr_s = pd.DataFrame(scaler.fit_transform(X_tr), columns=X_eng.columns)
    X_val_s = pd.DataFrame(scaler.transform(X_val), columns=X_eng.columns)

    # Train Hybrid Ensemble: Deep MLP + ExtraTrees
    print("\n3. Training Hybrid Deep Neural Network + ExtraTrees Ensemble...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        activation="relu",
        alpha=1e-3,
        batch_size=256,
        max_iter=100,
        early_stopping=True,
        random_state=42
    )
    et = ExtraTreesClassifier(n_estimators=200, max_depth=18, n_jobs=2, random_state=42)

    ensemble = VotingClassifier(
        estimators=[("mlp", mlp), ("et", et)],
        voting="soft",
        n_jobs=2
    )
    ensemble.fit(X_tr_s, y_tr)

    y_pred = ensemble.predict(X_val_s)
    y_prob = ensemble.predict_proba(X_val_s)
    max_conf = np.max(y_prob, axis=1)

    print("\n=== IMPROVED MODEL RESULTS (ALL VALIDATION SAMPLES) ===")
    print(f"4-Class Accuracy:   {accuracy_score(y_val, y_pred):.4f}")
    print(f"4-Class Macro F1:   {f1_score(y_val, y_pred, average='macro'):.4f}")
    print("\nPer-Class Report:")
    print(classification_report(
        y_val, y_pred,
        target_names=["0: Healthy", "1: Rich Mix", "2: Lean Burn", "3: Low Voltage"],
        digits=4
    ))
    print("Confusion Matrix:")
    print(confusion_matrix(y_val, y_pred))

    # Check accuracy when confidence is high (>= 70%) vs Uncertain (< 70%)
    high_conf_mask = max_conf >= 0.70
    print("\n=== CONFIDENCE THRESHOLD ANALYSIS (70% CUTOFF) ===")
    print(f"High-Confidence Predictions (>=70%): {high_conf_mask.mean()*100:.2f}% of data")
    print(f"Accuracy on High-Confidence Samples: {accuracy_score(y_val[high_conf_mask], y_pred[high_conf_mask]):.4f}")

if __name__ == "__main__":
    run_improvement()