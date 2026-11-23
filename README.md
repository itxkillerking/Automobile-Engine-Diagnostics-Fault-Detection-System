# Automobile Engine Diagnostics & Fault Detection System

A machine learning system and interactive 3D digital twin application for real-time internal combustion engine health monitoring and fault classification.

Built on dynamometer bench telemetry from an Opel/Chevrolet 1.4L petrol engine, this project combines **physics-informed domain features**, a **Two-Stage Hybrid Deep Neural Network ensemble**, and an **interactive 3D web dashboard** to diagnose engine combustion and electrical faults with root-cause explanations.

---

## Where the Dataset Comes From

The benchmark dataset used in this project is **EngineFaultDB**, an open-access experimental dataset collected and published by researchers:

* **Source Repository:** [https://github.com/leoxthomas/EngineFaultDB](https://github.com/leoxthomas/EngineFaultDB)
* **Research Paper:** *Vergara et al., "EngineFaultDB: A Multimodal Sensor Dataset for Internal Combustion Engine Fault Diagnostics"*, IEEE Access (2023)
* **Paper DOI:** [10.1109/ACCESS.2023.3331316](https://doi.org/10.1109/ACCESS.2023.3331316)
* **IEEE Xplore Entry:** [https://ieeexplore.ieee.org/document/10313160](https://ieeexplore.ieee.org/document/10313160)

### Test Engine & Data Collection Setup
* **Engine:** Opel / Chevrolet C14NE — 1.4-liter (1,389 cc), inline 4-cylinder, 8 valves, overhead camshaft (OHC), multipoint electronic fuel injection (MPFI) spark-ignition petrol engine.
* **Test Bench:** Eddy-current dynamometer bench equipped with high-speed data acquisition (DAQ) channels and a Rosemount Analytical NGA 6000 multi-channel 5-gas exhaust analyzer.
* **Original Record Count:** 55,999 records across 15 telemetry columns (55,998 clean records after removing a single consecutive duplicate in the tail).

### Monitored Sensor Channels (12 Inputs)
The model takes 12 core sensor channels grouped into air/load, fuel delivery, and exhaust emissions:
* **Air & Load:** `MAP` (Manifold Absolute Pressure, bar), `TPS` (Throttle Position, %), `Force` (Engine Load Force, N), `Power` (Engine Power, kW), `RPM` (Engine Speed, rev/min).
* **Fuel Flow & Economy:** `Consumption L/H` (Fuel Flow Rate, L/h), `Consumption L/100KM` (Fuel Economy, L/100km), `AFR` (Air-to-Fuel Ratio, :1).
* **5-Gas Exhaust Emissions:** `CO` (Carbon Monoxide, % vol), `HC` (Unburned Hydrocarbons, ppm vol), `CO2` (Carbon Dioxide, % vol), `O2` (Oxygen, % vol).

### Target Conditions (4 Diagnostic Classes)
1. **Class 0 — Normal / Healthy Operation:** Engine running within balanced factory stoichiometric parameters.
2. **Class 1 — Rich Air-Fuel Mixture (Fault 1):** Excess fuel injection relative to air. Causes incomplete combustion, elevated CO, and high unburned HC emissions.
3. **Class 2 — Lean Burn (Fault 2):** Excess air or insufficient fuel delivery. Causes elevated exhaust O2, higher combustion temperatures, and lower engine torque.
4. **Class 3 — Low Ignition Voltage (Fault 3):** Weak spark delivery at the plugs under load. Causes misfires, incomplete flame propagation, and unburned fuel/oxygen traces in exhaust.

---

## The Hybrid Neural Network Model

### The Problem We Solved
Separating a healthy engine from a faulty one is relatively straightforward with standard ML models. The hard part is telling **Lean Burn (Fault 2)** apart from **Low Ignition Voltage (Fault 3)**. Both conditions cause incomplete combustion and show elevated exhaust oxygen, which confuses single-model classifiers and leads to high false alarm rates.

To solve this, we built a **Two-Stage Hybrid Architecture**:

```
[ Incoming 12-Sensor Telemetry ]
               │
               ▼
   [ Physical Plausibility Guards ]  ──(Negative values, impossible RPM/MAP/AFR)──► Rejection / Alert
               │
               ▼
  [ Physics Feature Engineering ]
  • Torque Proxy = Power / RPM
  • Combustion Efficiency = CO2 / (CO + CO2)
  • Unburned Fuel Ratio = HC / Fuel Flow
  • Load to MAP = Force / MAP
  • O2 to AFR = O2 / AFR
               │
               ▼
 ┌────────────────────────────────────────────────────────┐
 │ Stage 1: Primary Neural Network (MLP: 128 -> 64)       │
 │ Separates Healthy vs Rich vs Lean/Ignition Group       │
 └──────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    [ Class 0: Healthy ]        [ Lean/Ignition Group ]
    [ Class 1: Rich    ]                  │
                                          ▼
                      ┌──────────────────────────────────────────────┐
                      │ Stage 2: Hybrid NN + Tree Ensemble           │
                      │ • Deep MLP (256 -> 128 -> 64)                │
                      │ • Balanced Random Forest (150 trees)         │
                      │ • Balanced Extra Trees (150 trees)           │
                      │ (Soft-voting consensus on cleaned features)  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                ┌────────────┴────────────┐
                                ▼                         ▼
                       [ Class 2: Lean Burn ]    [ Class 3: Low Spark ]
```

### 1. Stage 1 — Primary Group Neural Network
* Architecture: Deep MLP (128 -> 64 hidden units, ReLU activations, early stopping).
* Purpose: Groups the classification problem into 3 stable categories: Healthy (Class 0), Rich Mixture (Class 1), and Combined Lean/Ignition (Class 2/3).
* Performance: **100.0% accuracy** on Healthy baseline separation and **99.96% accuracy** on primary group classification.

### 2. Stage 2 — Hybrid Deep NN & Tree Ensemble
* Architecture: Soft-voting ensemble combining:
  * Deep Multi-Layer Perceptron (256 -> 128 -> 64 neurons)
  * Random Forest Classifier (150 estimators, max depth 16)
  * Extra Trees Classifier (150 estimators, max depth 18)
* Purpose: Specialized sub-fault classification on cleaned physical manifolds to reliably separate Lean Burn from Low Ignition Voltage.
* Out-of-fold accuracy on clean sub-fault data: **94.78%**.

### 3. Physics-Informed Feature Engineering
Rather than feeding raw telemetry blindly into the models, the pipeline derives domain features grounded in internal combustion engine physics:
* `Torque_Proxy` = $\frac{\text{Power}}{\text{RPM} + 10^{-5}}$: Mechanical torque indicator.
* `Combustion_Efficiency` = $\frac{\text{CO}_2}{\text{CO} + \text{CO}_2 + 10^{-5}}$: Combustion completeness ratio.
* `Unburned_Fuel_Ratio` = $\frac{\text{HC}}{\text{Consumption L/H} + 10^{-5}}$: Fuel vaporization and burn efficiency.
* `Load_to_MAP` = $\frac{\text{Force}}{\text{MAP} + 10^{-5}}$: Volumetric charging efficiency.
* `O2_to_AFR` = $\frac{\text{O}_2}{\text{AFR} + 10^{-5}}$: Stoichiometric balance marker.

### 4. Real-World Sensor Plausibility Guards
Before any inference runs, the pipeline validates sensor readings against universal physical limits for spark-ignition petrol engines:
* RPM must be between 400 and 9,000 RPM.
* MAP must be between 0.2 and 4.5 bar.
* AFR must be between 7.0 and 25.0 :1.
* Exhaust CO2 cannot exceed 17.0% (stoichiometric ceiling).
* Exhaust O2 cannot exceed atmospheric 21.0%.
* Any negative reading or missing sensor triggers an immediate descriptive rejection, protecting the model from garbage data or disconnected sensors.

### 5. Automated "Why Unhealthy" Root-Cause Diagnosis
When an anomaly is flagged, the system doesn't just return a class label. It calculates z-score deviations against healthy engine baselines and prints plain-English diagnostics (e.g., *"Rich Air-Fuel Mixture: CO is HIGH (9.29% vs baseline 0.85%), AFR is LOW (12.1 vs baseline 14.6)"*).

---

## Mini Project: Interactive 3D Digital Twin & Web Dashboard

We built a full interactive web application located in `web_app/`:

* **Interactive 3D Engine Bay (Three.js):**
  * Real-time 3D rendered engine block with interactive orbit controls (rotate, zoom, pan).
  * Wireframe toggle and engine component inspection.
  * **Animated fault highlights:** When a fault is detected, the affected physical components pulse red in 3D:
    * *Rich Mixture* lights up the fuel rail and electronic injectors.
    * *Lean Burn* highlights the intake manifold and combustion chambers.
    * *Low Ignition Voltage* highlights the spark plugs and ignition coil pack.
* **Live Telemetry Sliders & Gauges:**
  * Control all 12 engine parameters with responsive sliders.
  * Instant ML prediction output showing health status, confidence percentage, sub-fault details, and sensor deviation reasons.
* **Quick Presets:**
  * One-click presets for *Healthy Baseline*, *Rich Mixture (Fault 1)*, *Lean Burn (Fault 2)*, and *Low Ignition Voltage (Fault 3)* so you can test the system right away.
* **Batch CSV Diagnostics:**
  * Upload any multi-row sensor CSV file to diagnose entire driving logs or dyno test runs in bulk.
* **Vehicle Builder Tab:**
  * Configure custom engine parameters, fuel systems, and displacement.
* **Streamlit Analytics Dashboard (`src/app.py`):**
  * An additional Streamlit interface for exploring model predictions, historical runs, and sensor distributions.

---

## How to Set Up on Your PC

Follow these steps to run the complete system locally.

### Prerequisites
* **Python 3.10, 3.11, or 3.12** installed on your machine.
* **Git** installed.

### Step 1: Clone the Repository
Open PowerShell, Command Prompt, or terminal and run:

```bash
git clone https://github.com/itxkillerking/Automobile-Engine-Diagnostics-Fault-Detection-System.git
cd Automobile-Engine-Diagnostics-Fault-Detection-System
```

### Step 2: Create and Activate a Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

*(If PowerShell blocks script execution, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first)*

**On Windows (CMD):**
```cmd
python -m venv .venv
.\.venv\Scripts\activate.bat
```

**On Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Required Packages
Install all required dependencies using `requirements.txt`:

```bash
pip install -r requirements.txt
```

### Step 4: Run the Production Test Suite
Verify that your local environment and model artifacts are working:

```bash
python tests/test_production_system.py
```
You should see:
```text
=== RUNNING PHASE 9 AUTOMATED PRODUCTION TESTS ===
[PASS] Test 1: All 3 deployment files exist in final_model_deploy/
[PASS] Test 2: Healthy baseline -> HEALTHY (99.96% conf)
[PASS] Test 3: Fault detection & explanation -> Fault 2: Lean Burn
[PASS] Test 4: Batch prediction processed 2 rows
[PASS] Test 5: Invalid input guard -> REJECTED: Sensor readings cannot be negative.
ALL 5 PRODUCTION TESTS PASSED SUCCESSFULLY! (100%)
```

### Step 5: Launch the 3D Web Application
Start the FastAPI server that powers both the API and the interactive frontend:

```bash
uvicorn web_app.backend.api:app --reload --port 8000
```

Now open your web browser and navigate to:
```
http://localhost:8000
```

You can now drag the telemetry sliders, click presets, rotate the 3D engine in real time, and upload batch test CSV files!

### (Optional) Step 6: Launch the Streamlit Analytics Interface
If you want to use the Streamlit interface instead:

```bash
streamlit run src/app.py
```
It will open automatically at `http://localhost:8501`.

---

## Repository Structure

```text
Automobile-Engine-Diagnostics-Fault-Detection-System/
├── README.md                           # Documentation, dataset citation, and setup guide
├── requirements.txt                    # Python package dependencies
├── .gitignore                          # Clean ignore rules (excludes caches, venv, large archives)
│
├── final_model_deploy/                 # Self-contained production deployment bundle
│   ├── engine_diagnosis_prod_v1.joblib # Trained Two-Stage Hybrid NN model artifact
│   ├── inference.py                    # Inference pipeline with physics features & guards
│   ├── model_metadata.json             # Model specifications, versions, and sensor mappings
│   └── __init__.py
│
├── web_app/                            # 3D Digital Twin & Diagnostic Web App
│   ├── backend/
│   │   └── api.py                      # FastAPI server with /api/predict and /api/batch-predict
│   └── frontend/
│       ├── index.html                  # Main dashboard layout
│       ├── css/style.css               # Modern automotive UI styling
│       ├── js/
│       │   ├── app.js                  # Frontend telemetry logic & API integration
│       │   ├── engine3d.js             # Three.js 3D engine model & fault visualizer
│       │   ├── vehicleBuilder.js       # Vehicle configuration module
│       │   └── workshopScene.js        # 3D workshop environment scene
│       └── assets/logo.png             # Dashboard branding
│
├── src/                                # Core data science code
│   ├── app.py                          # Streamlit interactive application
│   ├── predictor.py                    # Training & inference pipeline definitions
│   └── __init__.py
│
├── data/
│   ├── raw/automotive/                 # Raw benchmark CSV from EngineFaultDB
│   ├── interim/                        # Cleaned data after duplicate removal
│   └── processed/automotive/           # Feature-engineered training and test sets
│
├── notebooks/
│   ├── MASTER_PROJECT_NOTEBOOK.ipynb   # Master exploration, training, and evaluation notebook
│   └── ML_PROJECT_UOL_MASTER.ipynb     # Step-by-step experiment notebook
│
├── reports/                            # Evaluation plots, confusion matrices, and audit logs
│   ├── class_distribution.png
│   ├── correlation_heatmap.png
│   ├── phase5_test_confusion_matrix.png
│   └── summary_statistics.csv
│
├── scripts/                            # Data preprocessing and training scripts
│   ├── preprocess_data.py
│   ├── scale_data.py
│   ├── phase4_baseline_and_nn.py
│   ├── phase5_final_evaluation.py
│   └── forensic_audit.py
│
├── tests/
│   └── test_production_system.py      # Automated regression tests for deployment
│
└── validation/                         # Validation splits and segment mapping manifests
    ├── build_validation_splits.py
    └── validation_split_manifest.csv
```

---

## Model Evaluation Summary

| Diagnostic Target | Model Layer | Test Accuracy | Key Sensor Indicators |
|---|---|---|---|
| **Healthy vs Unhealthy** | Stage 1 MLP (128 -> 64) | **100.0%** | Balanced AFR (~14.6:1), low CO (<1%), baseline CO2 (~14%) |
| **Primary Fault Group** | Stage 1 MLP (128 -> 64) | **99.96%** | High CO/HC for Rich; high O2 for Lean/Ignition |
| **Sub-Fault Disentanglement** | Stage 2 Hybrid Ensemble (MLP + RF + ET) | **94.78%** | AFR, Combustion Efficiency, Torque Proxy, O2/AFR ratio |

---

## Citation & Acknowledgments

If you find this project or dataset helpful in your research or learning, please cite the upstream EngineFaultDB benchmark:

```bibtex
@article{vergara2023enginefaultdb,
  title={EngineFaultDB: A Multimodal Sensor Dataset for Internal Combustion Engine Fault Diagnostics},
  author={Vergara, Leonardo and others},
  journal={IEEE Access},
  volume={11},
  pages={1331316},
  year={2023},
  publisher={IEEE},
  doi={10.1109/ACCESS.2023.3331316}
}
```

---

## License
This project is shared for educational, research, and non-commercial portfolio purposes. The benchmark dataset follows the original license terms provided by the EngineFaultDB authors.
