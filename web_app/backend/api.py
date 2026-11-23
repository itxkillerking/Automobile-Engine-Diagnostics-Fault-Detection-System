import io
import json
import os
import sys
from typing import Dict

import pandas as pd
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Resolve paths cleanly from D:\ML-PROJECT\web_app\backend\api.py
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.dirname(BACKEND_DIR)
PROJECT_ROOT = os.path.dirname(WEB_APP_DIR)
FRONTEND_DIR = os.path.join(WEB_APP_DIR, "frontend")
DEPLOY_DIR = os.path.join(PROJECT_ROOT, "final_model_deploy")

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from final_model_deploy.inference import (
    add_physics_features,
    load_artifact,
    predict_engine_health,
)

# Load locked ML artifact & metadata once at server startup
ARTIFACT = load_artifact()
METADATA_PATH = os.path.join(DEPLOY_DIR, "model_metadata.json")
with open(METADATA_PATH, "r", encoding="utf-8-sig") as f:
    MODEL_METADATA = json.load(f)

SENSOR_SPECS = [
    {"key": "MAP", "label": "Intake Pressure (MAP)", "unit": "bar", "group": "air_load", "min": 0.2, "max": 4.5, "step": 0.05},
    {"key": "TPS", "label": "Throttle Position (TPS)", "unit": "%", "group": "air_load", "min": 0.1, "max": 100.0, "step": 0.1},
    {"key": "Force", "label": "Engine Load Force", "unit": "N", "group": "air_load", "min": 10.0, "max": 2500.0, "step": 5.0},
    {"key": "Power", "label": "Engine Power", "unit": "kW", "group": "air_load", "min": 0.5, "max": 250.0, "step": 0.5},
    {"key": "RPM", "label": "Engine Speed", "unit": "RPM", "group": "air_load", "min": 400.0, "max": 9000.0, "step": 25.0},
    {"key": "Consumption L/H", "label": "Fuel Flow Rate", "unit": "L/h", "group": "fuel", "min": 0.2, "max": 50.0, "step": 0.1},
    {"key": "Consumption L/100KM", "label": "Fuel Economy", "unit": "L/100km", "group": "fuel", "min": 1.0, "max": 40.0, "step": 0.1},
    {"key": "AFR", "label": "Air-Fuel Ratio (AFR)", "unit": ":1", "group": "fuel", "min": 7.0, "max": 25.0, "step": 0.05},
    {"key": "CO", "label": "Carbon Monoxide (CO)", "unit": "%", "group": "exhaust", "min": 0.0, "max": 15.0, "step": 0.05},
    {"key": "HC", "label": "Hydrocarbons (HC)", "unit": "ppm", "group": "exhaust", "min": 0.0, "max": 2000.0, "step": 5.0},
    {"key": "CO2", "label": "Carbon Dioxide (CO2)", "unit": "%", "group": "exhaust", "min": 1.0, "max": 17.0, "step": 0.05},
    {"key": "O2", "label": "Exhaust Oxygen (O2)", "unit": "%", "group": "exhaust", "min": 0.0, "max": 21.0, "step": 0.05},
]

FAULT_ZONE_MAP = {
    0: "healthy",
    1: "fuel_rail",          # Rich Air-Fuel Mixture -> Injectors / Fuel Rail
    2: "intake_combustion",  # Lean Burn -> Intake Manifold / Cylinders
    3: "ignition_coils",     # Low Ignition Voltage -> Spark Plugs / Coils
}

PRESETS = {
    "healthy": {
        "label": "Healthy Baseline",
        "values": {k: round(float(v), 3) for k, v in ARTIFACT["healthy_mean"].items()},
    },
    "rich": {
        "label": "Rich Mixture (Fault 1)",
        "values": {
            "MAP": 3.25, "TPS": 3.10, "Force": 710.0, "Power": 20.03, "RPM": 4666.5,
            "Consumption L/H": 13.65, "Consumption L/100KM": 12.80,
            "CO": 9.29, "HC": 921.6, "CO2": 10.20, "O2": 0.45, "AFR": 12.10,
        },
    },
    "lean": {
        "label": "Lean Burn (Fault 2)",
        "values": {
            "MAP": 1.45, "TPS": 1.15, "Force": 180.0, "Power": 4.20, "RPM": 2400.0,
            "Consumption L/H": 3.50, "Consumption L/100KM": 6.38,
            "CO": 0.45, "HC": 135.0, "CO2": 12.44, "O2": 0.85, "AFR": 15.10,
        },
    },
    "ignition": {
        "label": "Low Ignition Voltage (Fault 3)",
        "values": {
            "MAP": 2.10, "TPS": 1.75, "Force": 390.0, "Power": 9.10, "RPM": 2950.0,
            "Consumption L/H": 5.80, "Consumption L/100KM": 10.20,
            "CO": 1.85, "HC": 195.0, "CO2": 12.80, "O2": 0.52, "AFR": 14.20,
        },
    },
}

app = FastAPI(title="Engine Diagnostics Telemetry API", version="1.0.0")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static assets
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")


@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/api/config")
def get_config():
    return {
        "status": "READY",
        "metadata": MODEL_METADATA,
        "sensors": SENSOR_SPECS,
        "presets": PRESETS,
        "healthy_baseline": {k: round(float(v), 3) for k, v in ARTIFACT["healthy_mean"].items()},
    }


@app.post("/api/predict")
def predict_single(payload: Dict[str, float]):
    df = pd.DataFrame([payload])
    result = predict_engine_health(df, ARTIFACT)[0]

    if result["status"] == "ERROR":
        return result

    # Enrich with per-sensor Z-score telemetry for live deviation bars
    telemetry = []
    for spec in SENSOR_SPECS:
        col = spec["key"]
        val = float(payload[col])
        mean_val = float(ARTIFACT["healthy_mean"][col])
        std_val = float(ARTIFACT["healthy_std"][col]) or 1.0
        signed_z = (val - mean_val) / std_val
        abs_z = abs(signed_z)

        if abs_z < 1.5:
            severity = "normal"
        elif abs_z < 3.0:
            severity = "caution"
        else:
            severity = "critical"

        telemetry.append({
            "key": col,
            "label": spec["label"],
            "unit": spec["unit"],
            "value": round(val, 3),
            "baseline": round(mean_val, 3),
            "z_score": round(signed_z, 2),
            "abs_z": round(abs_z, 2),
            "severity": severity,
        })

    telemetry.sort(key=lambda x: x["abs_z"], reverse=True)

    # Calculate 5 physics ratios for the Neural Pipeline telemetry display
    eng = add_physics_features(df[ARTIFACT["required_sensors"]]).iloc[0]
    physics_ratios = {
        "Torque_Proxy": round(float(eng["Torque_Proxy"]), 5),
        "Combustion_Efficiency": round(float(eng["Combustion_Efficiency"]), 4),
        "Unburned_Fuel_Ratio": round(float(eng["Unburned_Fuel_Ratio"]), 2),
        "Load_to_MAP": round(float(eng["Load_to_MAP"]), 2),
        "O2_to_AFR": round(float(eng["O2_to_AFR"]), 4),
    }

    pred_cls = int(result["predicted_class"])
    result["fault_zone"] = FAULT_ZONE_MAP.get(pred_cls, "healthy")
    result["stage_path"] = "stage1_direct" if pred_cls in (0, 1) else "stage2_ensemble"
    result["sensor_telemetry"] = telemetry
    result["physics_ratios"] = physics_ratios
    return result


@app.post("/api/predict-batch")
async def predict_batch(file: UploadFile = File(...)):
    try:
        raw_bytes = await file.read()
        batch_df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        return {"status": "ERROR", "message": f"Failed to read CSV file: {exc}"}

    results = predict_engine_health(batch_df, ARTIFACT)
    if results and results[0].get("status") == "ERROR":
        return results[0]

    summary = {"total": len(results), "healthy": 0, "rich": 0, "lean": 0, "ignition": 0}
    rows_out = []
    for idx, res in enumerate(results):
        cls_id = int(res["predicted_class"])
        if cls_id == 0:
            summary["healthy"] += 1
        elif cls_id == 1:
            summary["rich"] += 1
        elif cls_id == 2:
            summary["lean"] += 1
        elif cls_id == 3:
            summary["ignition"] += 1

        rows_out.append({
            "row_index": idx + 1,
            "rpm": round(float(batch_df.iloc[idx]["RPM"]), 1),
            "afr": round(float(batch_df.iloc[idx]["AFR"]), 2),
            "co": round(float(batch_df.iloc[idx]["CO"]), 2),
            "hc": round(float(batch_df.iloc[idx]["HC"]), 1),
            "engine_health": res["engine_health"],
            "fault_name": res["fault_name"],
            "confidence_pct": res["confidence_pct"],
            "why_unhealthy": res["why_unhealthy"],
        })

    return {
        "status": "OK",
        "filename": file.filename,
        "summary": summary,
        "rows": rows_out[:200],
        "truncated": len(rows_out) > 200,
    }