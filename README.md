# Automobile Engine Diagnostics & Fault Detection System

We built this project to detect internal combustion engine faults from sensor readings and show what is going wrong inside an interactive 3D engine bay. A FastAPI backend runs a saved scikit-learn diagnostic model and serves a Three.js web app where you can drag telemetry sliders, upload batch CSV logs, and see affected engine parts light up.

Live demo: [Vercel deployment link](https://your-vercel-app.vercel.app)

The dataset comes from EngineFaultDB (Vergara et al., IEEE Access 2023, DOI: `10.1109/ACCESS.2023.3331316`, GitHub: `https://github.com/leoxthomas/EngineFaultDB`). Those recordings were taken from an Opel/Chevrolet C14NE 1.4L 4-cylinder petrol engine on an eddy-current dynamometer test bench using a Rosemount Analytical NGA 6000 5-gas exhaust analyzer.

## How the Model Works

The saved pipeline in `final_model_deploy/engine_diagnosis_prod_v1.joblib` runs predictions in two stages. Before classifying anything, `final_model_deploy/inference.py` checks that sensor inputs fall inside realistic physical limits for a running spark-ignition engine and computes five derived ratios: `Torque_Proxy`, `Combustion_Efficiency`, `Unburned_Fuel_Ratio`, `Load_to_MAP`, and `O2_to_AFR`. Stage 1 uses a Multi-Layer Perceptron (`128 -> 64`) to separate healthy runs, rich mixture faults, and the combined lean/ignition group. When Stage 1 flags the lean/ignition group, Stage 2 runs a soft-voting ensemble of a deeper MLP (`256 -> 128 -> 64`), a Balanced Random Forest (150 trees), and a Balanced Extra Trees classifier (150 trees) to separate lean burn from low ignition voltage. For unhealthy predictions, the inference script also calculates Z-score deviations against healthy baseline averages so the UI can explain which sensors drifted.

## Project Layout

- `main.py` exposes the FastAPI `app` object for local runs and Vercel deployment
- `requirements.txt` lists the Python packages needed for the backend API and model
- `web_app/` holds `backend/api.py` along with the HTML, CSS, and Three.js frontend in `frontend/`
- `final_model_deploy/` contains the production joblib model, `inference.py`, and `model_metadata.json`
- `src/` has the training pipeline (`predictor.py`) and a secondary Streamlit app (`app.py`)
- `data/` stores the raw EngineFaultDB file, cleaned CSV, and automotive train/test splits
- `models/` keeps the fitted scaler and training model artifact
- `notebooks/` contains the exploratory analysis and model training notebooks
- `scripts/` holds standalone preprocessing, scaling, baseline, and evaluation scripts
- `validation/` contains the group-aware split script and split manifests
- `reports/` stores confusion matrix plots, correlation heatmaps, and metric CSVs
- `tests/` contains `test_production_system.py` for checking end-to-end model inference

## Sensors & Fault Outputs

The classifier expects 12 intake, fuel, and exhaust channels:

- `MAP`: intake manifold absolute pressure in bar (0.2 to 4.5)
- `TPS`: throttle position sensor in % (0.1 to 100.0)
- `Force`: engine load force in N (0 or higher)
- `Power`: engine power output in kW (0 or higher)
- `RPM`: engine speed in RPM (400 to 9000)
- `Consumption L/H`: fuel flow rate in L/h (0 or higher)
- `Consumption L/100KM`: fuel economy in L/100km (0 or higher)
- `AFR`: air-fuel ratio (7.0 to 25.0)
- `CO`: carbon monoxide in % vol (0.0 to 15.0)
- `HC`: unburned hydrocarbons in ppm (0 or higher)
- `CO2`: carbon dioxide in % vol (1.0 to 17.0)
- `O2`: exhaust oxygen in % vol (0.0 to 21.0)

The model outputs four classes:

- `0` (Healthy): normal air-fuel balance and emission readings
- `1` (Rich Mixture): too much fuel relative to air, raising CO and HC (highlights the fuel rail and injectors in 3D)
- `2` (Lean Burn): excess air or low fuel delivery, raising AFR and exhaust O2 (highlights the intake and combustion area)
- `3` (Low Ignition Voltage): weak spark or misfire under load (highlights the spark plugs and ignition coils)

If a predicted fault reaches extreme readings (such as AFR at or below 11.2 or at or above 18.0, CO at 5.5% or higher, HC at 600 ppm or higher, O2 at 8.0% or higher, RPM near redline, or multiple channels hitting critical Z-score deviations), the frontend in `web_app/frontend/js/app.js` upgrades the status banner to a critical danger warning.

## Running Locally

Create a virtual environment (Python 3.10 or newer) and activate it:

```bash
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# Linux / macOS: source .venv/bin/activate
```

Install the dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000` in your browser.

To run the production inference check script:

```bash
python tests/test_production_system.py
```

## API Routes

- `GET /`: serves `web_app/frontend/index.html`
- `GET /api/config`: returns model metadata, sensor ranges, test presets, and healthy baseline values
- `POST /api/predict`: takes a JSON object with the 12 sensor readings and returns the predicted class, confidence, fault zone, physics ratios, and per-sensor Z-scores
- `POST /api/predict-batch`: accepts an uploaded CSV file (`file` field) and returns summary counts plus row predictions for up to 200 rows
