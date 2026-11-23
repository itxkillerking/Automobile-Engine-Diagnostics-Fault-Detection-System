import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import accuracy_score

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"
models_dir = r"D:\ML-PROJECT\models"
artifact_path = os.path.join(models_dir, "engine_diagnosis_system.joblib")

REQUIRED_SENSORS = [
    "MAP", "TPS", "Force", "Power", "RPM",
    "Consumption L/H", "Consumption L/100KM",
    "CO", "HC", "CO2", "O2", "AFR"
]

FAULT_NAMES = {
    0: "Normal / Healthy Operation",
    1: "Fault 1: Rich Air-Fuel Mixture",
    2: "Fault 2: Lean Burn",
    3: "Fault 3: Low Ignition Voltage"
}

FAULT_CAUSES = {
    0: "Engine is healthy. Air-fuel ratio, exhaust emissions, and power output are normal.",
    1: "Rich Air-Fuel Mixture: Too much fuel (low AFR) is entering the cylinder, causing incomplete burning and high CO/HC exhaust emissions.",
    2: "Lean Burn Fault: Too much air / not enough fuel (high O2 and elevated AFR), causing hotter combustion and reduced engine force.",
    3: "Low Ignition Voltage: Weak spark plug ignition voltage is causing weak combustion and unburned fuel/oxygen in the exhaust."
}

def add_physics_features(df):
    data = df.copy()
    data["Torque_Proxy"] = data["Power"] / (data["RPM"] + 1e-5)
    data["Combustion_Efficiency"] = data["CO2"] / (data["CO"] + data["CO2"] + 1e-5)
    data["Unburned_Fuel_Ratio"] = data["HC"] / (data["Consumption L/H"] + 1e-5)
    data["Load_to_MAP"] = data["Force"] / (data["MAP"] + 1e-5)
    data["O2_to_AFR"] = data["O2"] / (data["AFR"] + 1e-5)
    return data

def train_and_save_pipeline():
    print("1. Loading training data...")
    X_train_raw = pd.read_csv(os.path.join(processed_dir, "X_train.csv"))
    y_train_raw = pd.read_csv(os.path.join(processed_dir, "y_train.csv")).squeeze()

    healthy_df = X_train_raw[y_train_raw == 0]
    healthy_mean = healthy_df.mean().to_dict()
    healthy_std = healthy_df.std().replace(0, 1e-5).to_dict()

    X_eng = add_physics_features(X_train_raw)
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_eng), columns=X_eng.columns)

    # Clean corrupted overlap rows strictly inside Training Data using K-NN consensus
    print("2. Filtering corrupted overlap rows in training set...")
    nn = NearestNeighbors(n_neighbors=6, n_jobs=2)
    nn.fit(X_scaled)
    _, indices = nn.kneighbors(X_scaled)
    neighbor_labels = y_train_raw.values[indices[:, 1:]]
    same_count = (neighbor_labels == y_train_raw.values[:, None]).sum(axis=1)
    clean_mask = same_count >= 4

    X_clean = X_scaled[clean_mask]
    y_clean = y_train_raw[clean_mask]

    # Stage 1: Primary 3-Group Neural Network (0=Healthy, 1=Rich Mix, 2=Lean/Ignition Group)
    print("3. Training Stage-1 Neural Network (Healthy vs Rich vs Lean/Ignition)...")
    y_stage1 = y_train_raw.replace({3: 2})
    stage1_model = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        max_iter=80,
        early_stopping=True,
        random_state=42
    )
    stage1_model.fit(X_scaled, y_stage1)

    # Stage 2: 4-Class Hybrid Deep Neural Network Ensemble on Clean Training Data
    print("4. Training Stage-2 Hybrid Deep Neural Network Ensemble...")
    stage2_model = VotingClassifier(
        estimators=[
            ("mlp", MLPClassifier(hidden_layer_sizes=(256, 128, 64), max_iter=80, early_stopping=True, random_state=42)),
            ("rf", RandomForestClassifier(n_estimators=150, max_depth=16, class_weight="balanced", n_jobs=2, random_state=42)),
            ("et", ExtraTreesClassifier(n_estimators=150, max_depth=18, class_weight="balanced", n_jobs=2, random_state=42))
        ],
        voting="soft",
        n_jobs=2
    )
    stage2_model.fit(X_clean, y_clean)

    artifact = {
        "stage1_model": stage1_model,
        "model": stage2_model,
        "scaler": scaler,
        "required_sensors": REQUIRED_SENSORS,
        "engineered_columns": list(X_eng.columns),
        "healthy_mean": healthy_mean,
        "healthy_std": healthy_std,
        "confidence_threshold": 0.70
    }

    os.makedirs(models_dir, exist_ok=True)
    joblib.dump(artifact, artifact_path)
    print(f"5. Saved upgraded system to: {artifact_path}")

def validate_input(df):
    missing = [col for col in REQUIRED_SENSORS if col not in df.columns]
    if missing:
        return False, f"REJECTED: Missing required sensor columns: {missing}"
    sub = df[REQUIRED_SENSORS]
    if sub.isnull().any().any():
        return False, "REJECTED: Input contains missing (NaN) sensor values."
    if (sub["RPM"] <= 0).any() or (sub["RPM"] > 10000).any():
        return False, "REJECTED: Physically impossible RPM reading (must be between 1 and 10,000)."
    if (sub["MAP"] <= 0).any() or (sub["AFR"] <= 0).any():
        return False, "REJECTED: Physically impossible negative/zero MAP or AFR reading."
    if (sub < 0).any().any():
        return False, "REJECTED: Sensor readings cannot be negative."
    return True, "VALID"

def predict_records(df, artifact):
    is_valid, msg = validate_input(df)
    if not is_valid:
        return [{"status": "ERROR", "message": msg}]

    clean_df = df[REQUIRED_SENSORS].copy()
    eng_df = add_physics_features(clean_df)
    scaled_arr = artifact["scaler"].transform(eng_df[artifact["engineered_columns"]])
    scaled_df = pd.DataFrame(scaled_arr, columns=artifact["engineered_columns"])

    s1_probs = artifact["stage1_model"].predict_proba(scaled_df)
    s2_probs = artifact["model"].predict_proba(scaled_df)
    preds = np.argmax(s2_probs, axis=1)

    outputs = []
    for i in range(len(clean_df)):
        pred_cls = int(preds[i])
        conf = float(s2_probs[i, pred_cls])
        stage1_conf = float(np.max(s1_probs[i]))
        health_status = "HEALTHY" if pred_cls == 0 else "UNHEALTHY"

        # Find top 3 abnormal sensors compared to Healthy engine
        row = clean_df.iloc[i]
        devs = []
        for col in REQUIRED_SENSORS:
            mean_val = artifact["healthy_mean"][col]
            std_val = artifact["healthy_std"][col]
            z = abs(row[col] - mean_val) / std_val
            direction = "HIGH" if row[col] > mean_val else "LOW"
            devs.append((z, f"{col} is {direction} ({row[col]:.2f} vs normal {mean_val:.2f})"))
        devs.sort(key=lambda x: x[0], reverse=True)

        top_abnormal = [d[1] for d in devs[:3]] if pred_cls != 0 else ["All sensors within normal healthy range"]
        why_reason = f"{FAULT_CAUSES[pred_cls]} Key sensor triggers: {', '.join(top_abnormal)}."

        warning = f"High reliability diagnosis (Primary Group Confidence: {stage1_conf*100:.1f}%)."
        if conf < artifact["confidence_threshold"]:
            warning = (
                f"Primary Fault Group is {stage1_conf*100:.1f}% certain (Lean/Ignition Fault), "
                f"but exact sub-fault confidence is {conf*100:.1f}%. Inspect both fuel injectors and ignition coils."
            )

        outputs.append({
            "status": "OK",
            "engine_health": health_status,
            "predicted_class": pred_cls,
            "fault_name": FAULT_NAMES[pred_cls],
            "confidence_pct": round(conf * 100, 2),
            "stage1_confidence_pct": round(stage1_conf * 100, 2),
            "why_unhealthy": why_reason,
            "abnormal_sensors": top_abnormal,
            "diagnostic_note": warning
        })
    return outputs

if __name__ == "__main__":
    train_and_save_pipeline()

    loaded = joblib.load(artifact_path)
    X_test = pd.read_csv(os.path.join(processed_dir, "X_test.csv"))
    y_test = pd.read_csv(os.path.join(processed_dir, "y_test.csv")).squeeze()

    print("\n=== VERIFYING EXPLANATIONS ON ALL FAULT TYPES ===")
    for cls in [0, 1, 2, 3]:
        sample = X_test[y_test == cls].iloc[[0]]
        res = predict_records(sample, loaded)[0]
        print(f"\n[True Class {cls}] -> Status: {res['engine_health']} | Predicted: {res['fault_name']}")
        print(f"Confidence: {res['confidence_pct']}% (Primary Group: {res['stage1_confidence_pct']}%)")
        print(f"WHY: {res['why_unhealthy']}")