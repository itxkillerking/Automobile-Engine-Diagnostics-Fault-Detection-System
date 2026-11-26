# Automobile Engine Diagnostics & Fault Detection System

## Project Overview

This project is an engine fault diagnostic system that pairs a supervised machine learning classifier with an interactive Three.js 3D diagnostic bay and FastAPI web interface. It inspects 12 intake, fuel, and 5-gas exhaust telemetry channels to identify healthy engine operation and pinpoint combustion or ignition faults in real time.

The model is trained on the **EngineFaultDB** dataset (*Vergara et al., IEEE Access 2023*, DOI: `10.1109/ACCESS.2023.3331316`, source: `https://github.com/leoxthomas/EngineFaultDB`), recorded on an Opel/Chevrolet C14NE 1.4L 4-cylinder MPFI petrol engine mounted on an eddy-current dynamometer test bench with a Rosemount Analytical NGA 6000 gas analyzer.

The deployed pipeline (`final_model_deploy/engine_diagnosis_prod_v1.joblib`) uses a two-stage hybrid architecture:
- **Stage 1:** A Multi-Layer Perceptron (`128 -> 64`) separates healthy operation from rich-mixture faults and the combined lean/ignition fault group.
- **Stage 2:** A soft-voting ensemble of an MLP (`256 -> 128 -> 64`), Balanced Random Forest (`150` trees), and Balanced Extra Trees (`150` trees) resolves lean burn against low ignition voltage using five physics-derived ratios (`Torque_Proxy`, `Combustion_Efficiency`, `Unburned_Fuel_Ratio`, `Load_to_MAP`, and `O2_to_AFR`).

---

## Repository Structure

```text
.
├── main.py                              # FastAPI ASGI entrypoint for local and Vercel deployment
├── requirements.txt                     # Runtime dependencies for the API and inference pipeline
├── web_app/
│   ├── backend/
│   │   └── api.py                       # FastAPI routes, sensor specs, presets, and static mount
│   └── frontend/
│       ├── index.html                   # Diagnostic bay UI layout
│       ├── css/style.css                # Application styles
│       ├── assets/logo.png              # Header logo
│       └── js/
│           ├── app.js                   # Telemetry state, API calls, danger escalation, CSV/log views
│           ├── engine3d.js              # Three.js engine bay and component fault highlighting
│           ├── vehicleBuilder.js        # Parametric 3D vehicle body and engine configurations
│           └── workshopScene.js         # Lighting, bay geometry, and camera controls
├── final_model_deploy/
│   ├── engine_diagnosis_prod_v1.joblib  # Production two-stage hybrid model artifact
│   ├── inference.py                     # Feature engineering, plausibility checks, and prediction logic
│   └── model_metadata.json              # Model scope, accuracy metrics, and required sensor list
├── src/
│   ├── app.py                           # Optional Streamlit diagnostic interface
│   └── predictor.py                     # Training and export pipeline for the two-stage classifier
├── data/
│   ├── raw/automotive/                  # Original EngineFaultDB CSV and provenance notes
│   ├── interim/                         # Deduplicated dataset
│   └── processed/automotive/            # Train/test splits and scaled/balanced training matrices
├── models/                              # Saved scaler and training artifact copy
├── notebooks/                           # Exploratory analysis and training notebooks
├── scripts/                             # Preprocessing, scaling, baseline, and evaluation scripts
├── validation/                          # Group-aware split builder and manifest CSVs
├── reports/                             # Distribution plots, heatmaps, and evaluation metrics
└── tests/
    └── test_production_system.py        # Production inference regression tests
```

---

## Monitored Sensors & Fault Classes

### Input Telemetry Channels (12 Sensors)

| Channel | Description | Unit | Valid Plausibility Bounds |
|---|---|---|---|
| `MAP` | Intake Manifold Absolute Pressure | bar | `0.2 - 4.5` |
| `TPS` | Throttle Position Sensor | % | `0.1 - 100.0` |
| `Force` | Engine Load Force | N | `>= 0` |
| `Power` | Engine Power Output | kW | `>= 0` |
| `RPM` | Engine Speed | RPM | `400 - 9000` |
| `Consumption L/H` | Fuel Flow Rate | L/h | `>= 0` |
| `Consumption L/100KM` | Fuel Economy | L/100km | `>= 0` |
| `AFR` | Air-Fuel Ratio | :1 | `7.0 - 25.0` |
| `CO` | Carbon Monoxide | % vol | `0.0 - 15.0` |
| `HC` | Unburned Hydrocarbons | ppm | `>= 0` |
| `CO2` | Carbon Dioxide | % vol | `1.0 - 17.0` |
| `O2` | Exhaust Oxygen | % vol | `0.0 - 21.0` |

### Diagnostic Output States

- **Class 0 — Healthy (`Normal / Healthy Operation`):** Air-fuel balance, power delivery, and 5-gas exhaust readings are within baseline operating limits.
- **Class 1 — Rich Mixture (`Fault 1: Rich Air-Fuel Mixture`):** Excess fuel relative to intake air (low AFR, elevated CO and HC). Highlights the fuel rail and injectors in the 3D bay.
- **Class 2 — Lean Burn (`Fault 2: Lean Burn`):** Excess air or insufficient fuel delivery (elevated AFR and O2, reduced load output). Highlights the intake manifold and combustion zone.
- **Class 3 — Ignition / Misfire (`Fault 3: Low Ignition Voltage`):** Weak spark ignition under load causing incomplete flame propagation. Highlights the spark plugs and ignition coil zone.
- **Critical Danger Alert (`CRITICAL DANGER`):** Frontend threshold escalation triggered when a predicted fault exceeds severe limits (`AFR <= 11.2` or `>= 18.0`, `CO >= 5.5%`, `HC >= 600 ppm`, `O2 >= 8.0%`, `RPM >= 94%` of profile max, or 2+ critical Z-score deviations) or when 3 or more channels simultaneously enter critical Z-score deviation (`|z| >= 3.0`).

---

## Local Setup & Running

1. Create and activate a Python virtual environment (recommended, Python 3.10+):
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # Linux / macOS:
   source .venv/bin/activate
   ```

2. Install dependencies and start the FastAPI server:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. Open your browser to `http://127.0.0.1:8000`.

To run the automated inference tests:
```bash
python tests/test_production_system.py
```

---

## API Endpoints

| Method | Endpoint | Description | Request / Response |
|---|---|---|---|
| `GET` | `/` | Serves the frontend application | Returns `web_app/frontend/index.html` |
| `GET` | `/api/config` | Returns system readiness, model metadata, sensor ranges, presets, and healthy baselines | JSON configuration payload |
| `POST` | `/api/predict` | Runs single-sample diagnosis with physics ratios and per-sensor Z-score deviations | Input: JSON object of 12 sensor values; Output: predicted class, confidence, fault zone, and explanation |
| `POST` | `/api/predict-batch` | Runs bulk diagnosis on an uploaded CSV log | Input: `multipart/form-data` CSV (`file`); Output: summary counts and up to 200 row results |
