import os
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "engine_diagnosis_prod_v1.joblib")

FAULT_NAMES = {
    0: "Normal / Healthy Operation",
    1: "Fault 1: Rich Air-Fuel Mixture",
    2: "Fault 2: Lean Burn",
    3: "Fault 3: Low Ignition Voltage"
}

FAULT_CAUSES = {
    0: "Engine is healthy. Air-fuel mixture, combustion efficiency, and exhaust emissions are within normal operating limits.",
    1: "Rich Air-Fuel Mixture: Excess fuel relative to air (low AFR or high fuel flow) is causing incomplete combustion and elevated CO/HC emissions.",
    2: "Lean Burn Fault: Excess air or insufficient fuel delivery (elevated AFR/O2 or reduced fuel-to-load ratio) is causing lean combustion.",
    3: "Low Ignition Voltage: Weak spark ignition under load is causing incomplete flame propagation and unburned fuel/oxygen in the exhaust."
}

# Universal physical operating bounds for any running spark-ignition petrol engine
UNIVERSAL_PETROL_LIMITS = {
    "RPM": (400.0, 9000.0, "Running petrol engine speed must be between 400 and 9,000 RPM"),
    "MAP": (0.2, 4.5, "Manifold Absolute Pressure (MAP) must be between 0.2 and 4.5 bar"),
    "TPS": (0.1, 100.0, "Throttle Position Sensor (TPS) must be between 0.1 and 100"),
    "AFR": (7.0, 25.0, "Air-Fuel Ratio (AFR) must be within combustible limits (7.0 to 25.0)"),
    "CO2": (1.0, 17.0, "Exhaust CO2 cannot exceed the ~16% stoichiometric limit (1.0% to 17.0%)"),
    "CO":  (0.0, 15.0, "Exhaust CO must be between 0.0% and 15.0%"),
    "O2":  (0.0, 21.0, "Exhaust O2 cannot exceed atmospheric oxygen (0.0% to 21.0%)")
}

def load_artifact():
    return joblib.load(MODEL_PATH)

def add_physics_features(df):
    data = df.copy()
    data["Torque_Proxy"] = data["Power"] / (data["RPM"] + 1e-5)
    data["Combustion_Efficiency"] = data["CO2"] / (data["CO"] + data["CO2"] + 1e-5)
    data["Unburned_Fuel_Ratio"] = data["HC"] / (data["Consumption L/H"] + 1e-5)
    data["Load_to_MAP"] = data["Force"] / (data["MAP"] + 1e-5)
    data["O2_to_AFR"] = data["O2"] / (data["AFR"] + 1e-5)
    return data

def validate_input(df, required_sensors):
    missing = [col for col in required_sensors if col not in df.columns]
    if missing:
        return False, f"REJECTED: Missing required sensor columns: {missing}"
    sub = df[required_sensors]
    if sub.isnull().any().any():
        return False, "REJECTED: Input contains missing (NaN) sensor values."
    if (sub < 0).any().any():
        return False, "REJECTED: Sensor readings cannot be negative."

    for col, (low, high, desc) in UNIVERSAL_PETROL_LIMITS.items():
        if (sub[col] < low).any() or (sub[col] > high).any():
            bad_val = float(sub[col].iloc[0])
            return False, f"SENSOR PLAUSIBILITY ALERT: {col} = {bad_val:.2f} is physically impossible for a running petrol engine ({desc}). Check sensor wiring or input units."

    return True, "VALID"

def normalize_for_engine_displacement(df, healthy_mean):
    """
    Normalizes displacement-dependent mechanical variables (Power, Force, Consumption L/H)
    when testing larger/smaller engines so the Neural Network evaluates relative load
    without distorting universal exhaust chemistry.
    """
    norm_df = df.copy()
    baseline_specific_power = healthy_mean["Power"] / healthy_mean["RPM"]
    current_specific_power = norm_df["Power"] / (norm_df["RPM"] + 1e-5)
    scale_ratio = current_specific_power / baseline_specific_power

    # If engine displacement/load scale is >2x baseline, normalize mechanical load channels
    heavy_mask = scale_ratio > 2.0
    if heavy_mask.any():
        factor = scale_ratio[heavy_mask]
        norm_df.loc[heavy_mask, "Power"] = norm_df.loc[heavy_mask, "Power"] / factor
        norm_df.loc[heavy_mask, "Force"] = norm_df.loc[heavy_mask, "Force"] / factor
        norm_df.loc[heavy_mask, "Consumption L/H"] = norm_df.loc[heavy_mask, "Consumption L/H"] / np.sqrt(factor)
    return norm_df

def predict_engine_health(df, artifact=None):
    if artifact is None:
        artifact = load_artifact()

    req = artifact["required_sensors"]
    is_valid, msg = validate_input(df, req)
    if not is_valid:
        return [{"status": "ERROR", "message": msg}]

    clean_df = df[req].copy()
    norm_df = normalize_for_engine_displacement(clean_df, artifact["healthy_mean"])
    eng_df = add_physics_features(norm_df)
    scaled_arr = artifact["scaler"].transform(eng_df[artifact["engineered_columns"]])
    scaled_df = pd.DataFrame(scaled_arr, columns=artifact["engineered_columns"])

    # 100% Pure ML Inference (Stage 1 NN + Stage 2 Ensemble)
    s1_probs = artifact["stage1_model"].predict_proba(scaled_df)
    stage2_clf = artifact.get("stage2_specialist", artifact.get("model"))
    s2_probs = stage2_clf.predict_proba(scaled_df)
    s2_classes = stage2_clf.classes_

    outputs = []
    for i in range(len(clean_df)):
        row = clean_df.iloc[i]
        s1_cls = int(np.argmax(s1_probs[i]))
        s1_conf = float(s1_probs[i, s1_cls])

        if s1_cls in [0, 1]:
            pred_cls = s1_cls
            conf = s1_conf
        else:
            s2_idx = int(np.argmax(s2_probs[i]))
            pred_cls = int(s2_classes[s2_idx])
            conf = float(s2_probs[i, s2_idx])

        health_status = "HEALTHY" if pred_cls == 0 else "UNHEALTHY"

        devs = []
        for col in req:
            mean_val = artifact["healthy_mean"][col]
            std_val = artifact["healthy_std"][col]
            z = abs(row[col] - mean_val) / std_val
            direction = "HIGH" if row[col] > mean_val else "LOW"
            devs.append((z, f"{col} is {direction} ({row[col]:.2f} vs baseline {mean_val:.2f})"))
        devs.sort(key=lambda x: x[0], reverse=True)

        top_abnormal = [d[1] for d in devs[:3]] if pred_cls != 0 else ["All combustion and emission ratios within normal operating limits"]
        why_reason = f"{FAULT_CAUSES[pred_cls]} Key sensor indicators: {', '.join(top_abnormal)}."

        if conf < artifact["confidence_threshold"] and pred_cls in [2, 3]:
            warning = (
                f"Primary Fault Group is {s1_conf*100:.1f}% certain (Lean/Ignition Fault), "
                f"with {conf*100:.1f}% sub-fault confidence. Inspect both fuel injectors and ignition coils."
            )
        else:
            warning = f"High reliability ML diagnosis (Primary Group Confidence: {s1_conf*100:.1f}%)."

        outputs.append({
            "status": "OK",
            "engine_health": health_status,
            "predicted_class": pred_cls,
            "fault_name": FAULT_NAMES[pred_cls],
            "confidence_pct": round(conf * 100, 2),
            "stage1_confidence_pct": round(s1_conf * 100, 2),
            "why_unhealthy": why_reason,
            "abnormal_sensors": top_abnormal,
            "diagnostic_note": warning
        })
    return outputs
