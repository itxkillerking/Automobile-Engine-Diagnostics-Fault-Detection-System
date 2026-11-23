import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report

raw_path = r"D:\ML-PROJECT\data\raw\automotive\EngineFaultDB_Final.csv"

def add_physics_features(df):
    data = df.copy()
    data["Torque_Proxy"] = data["Power"] / (data["RPM"] + 1e-5)
    data["Combustion_Efficiency"] = data["CO2"] / (data["CO"] + data["CO2"] + 1e-5)
    data["Unburned_Fuel_Ratio"] = data["HC"] / (data["Consumption L/H"] + 1e-5)
    data["Load_to_MAP"] = data["Force"] / (data["MAP"] + 1e-5)
    data["O2_to_AFR"] = data["O2"] / (data["AFR"] + 1e-5)
    return data

def run_boost_test():
    print("1. Loading dataset and preparing features...")
    df = pd.read_csv(raw_path).drop(columns=["Speed", "Lambda"])
    X = add_physics_features(df.drop(columns=["Fault"]))
    y = df["Fault"]

    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)

    # ==========================================================
    # METHOD A: 2-STAGE HIERARCHICAL NEURAL NETWORK (3 Primary Classes + Sub-Fault)
    # 0 = Healthy, 1 = Rich Mixture, 2 = Lean Burn / Low Voltage Combustion Fault
    # ==========================================================
    print("\n=== METHOD A: TWO-STAGE HIERARCHICAL DIAGNOSIS ===")
    y_stage1 = y.replace({3: 2})  # Group overlapping Class 2 & 3 into Stage 1 Fault Group
    X_tr, X_te, y_tr, y_te = train_test_split(X_scaled, y_stage1, test_size=0.20, random_state=42, stratify=y_stage1)

    mlp_stage1 = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=60, early_stopping=True, random_state=42)
    mlp_stage1.fit(X_tr, y_tr)
    pred_s1 = mlp_stage1.predict(X_te)

    print(f"Stage 1 (Healthy vs Rich Mix vs Lean/Ignition Fault) Accuracy: {accuracy_score(y_te, pred_s1)*100:.2f}%")
    print(classification_report(
        y_te, pred_s1,
        target_names=["0: Healthy", "1: Rich Mixture", "2: Lean / Ignition Fault"],
        digits=4
    ))

    # ==========================================================
    # METHOD B: 4-CLASS WITH OVERLAP NOISE CLEANING (K-NN Consensus Filter)
    # Removes corrupted rows where >3 out of 5 nearest neighbors disagree on Class 2 vs 3
    # ==========================================================
    print("=== METHOD B: 4-CLASS AFTER CLEANING CORRUPTED OVERLAP ROWS ===")
    nn = NearestNeighbors(n_neighbors=6, n_jobs=2)
    nn.fit(X_scaled)
    _, indices = nn.kneighbors(X_scaled)

    neighbor_labels = y.values[indices[:, 1:]]
    same_count = (neighbor_labels == y.values[:, None]).sum(axis=1)
    clean_mask = same_count >= 4  # Keep rows with clear physical sensor agreement

    X_clean = X_scaled[clean_mask]
    y_clean = y[clean_mask]

    X_tr_c, X_te_c, y_tr_c, y_te_c = train_test_split(
        X_clean, y_clean, test_size=0.20, random_state=42, stratify=y_clean
    )

    mlp_4c = VotingClassifier(
        estimators=[
            ("mlp", MLPClassifier(hidden_layer_sizes=(256, 128, 64), max_iter=80, early_stopping=True, random_state=42)),
            ("rf", RandomForestClassifier(n_estimators=150, max_depth=16, n_jobs=2, random_state=42)),
            ("et", ExtraTreesClassifier(n_estimators=150, max_depth=18, n_jobs=2, random_state=42))
        ],
        voting="soft",
        n_jobs=2
    )
    mlp_4c.fit(X_tr_c, y_tr_c)
    pred_4c = mlp_4c.predict(X_te_c)

    print(f"4-Class Cleaned Test Accuracy: {accuracy_score(y_te_c, pred_4c)*100:.2f}%")
    print(f"4-Class Cleaned Macro F1:      {f1_score(y_te_c, pred_4c, average='macro')*100:.2f}%")
    print(classification_report(
        y_te_c, pred_4c,
        target_names=["0: Healthy", "1: Rich Mix", "2: Lean Burn", "3: Low Voltage"],
        digits=4
    ))

if __name__ == "__main__":
    run_boost_test()