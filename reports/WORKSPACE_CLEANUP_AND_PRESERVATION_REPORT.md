# Project Workspace Cleanup & Preservation Report

**Project:** Vehicle Engine Health Monitoring & Fault Diagnosis System  
**Workspace:** `D:/ML-PROJECT`  
**Execution Date:** 2026-11-12  
**Status:** Complete & Verified — Ready for Vehicle Engine Implementation  

---

## 1. Executive Summary

This report documents the comprehensive cleanup, reorganization, and preservation procedure executed on `D:/ML-PROJECT` in preparation for the **Vehicle Engine Health Monitoring & Fault Diagnosis System**. All mandatory preservation constraints were strictly enforced: zero original datasets, cleaned datasets, valuable notebooks, research reports, or trained models were deleted or corrupted. The canonical automotive master notebook was preserved at `notebooks/MASTER_PROJECT_NOTEBOOK.ipynb` with matching cryptographic hashes, and all historical marine diesel engine (`MU323DGSC`) experiments and rebuilds were safely archived into dedicated historical structures.

---

## 2. Workspace Structure: Before and After

### 2.1 Original Workspace Structure
```
D:\ML-PROJECT\
├── .agent\
├── .agents\
├── data\
│   ├── interim\
│   │   └── EngineFaultDB_Cleaned.csv
│   ├── processed\
│   │   ├── EngineFaultDB_3Class_Prepared.csv
│   │   └── marine_engine\
│   └── raw\
│       ├── Marine_Engine_Fault_Data_v1.zip
│       └── Marine_Engine_Fault_Data_v1\
├── notebooks\
│   ├── ML_PROJECT_UOL_MASTER.ipynb
│   └── colab\
│       └── PHASE_7_1_PARALLEL_CPU_WORKER.ipynb
├── OLD_FILES_BACKUP\             # 561 files (478.33 MB)
├── REBUILD_V1\                   # 54 files (5.34 MB)
├── REBUILD_V2\                   # 210 files (56.79 MB)
├── reports\                      # 45 historical marine markdown reports
├── results\                      # 501 experimental result files & plots
├── scripts\                      # Utility scripts
├── src\                          # Legacy source code
├── validation\                   # Split manifests
├── AGENTS.md
├── README.md
└── skills-lock.json
```

### 2.2 Final Clean Reorganized Workspace Structure
```
D:\ML-PROJECT\
├── data\
│   ├── raw\
│   │   ├── automotive\               # Target directory for uncleaned raw EngineFaultDB
│   │   └── marine\                   # Marine_Engine_Fault_Data_v1.zip & unpacked runs
│   └── processed\
│       ├── automotive\               # EngineFaultDB_Cleaned.csv & EngineFaultDB_3Class_Prepared.csv
│       ├── marine\                   # primary/secondary features & mmap directory
│       └── marine_engine\            # Backwards-compatible canonical mirror
├── notebooks\
│   ├── MASTER_PROJECT_NOTEBOOK.ipynb # CANONICAL MASTER NOTEBOOK (54 cells, verified SHA256)
│   ├── ML_PROJECT_UOL_MASTER.ipynb   # Preserved original copy
│   └── archive\                      # Colab worker notebook & historical notebooks
├── src\                              # Modular source code
├── models\
│   └── archive_marine\               # Dedicated directory for historical marine model archives
├── reports\
│   ├── automotive\                   # Clean reports directory for Vehicle Engine project
│   ├── archive_marine\               # All 45 historical marine engine markdown reports
│   └── WORKSPACE_CLEANUP_AND_PRESERVATION_REPORT.md # This verification report
├── experiments\
│   └── archive_marine\
│       └── results\                  # 501 preserved historical experiment files & plots
├── archive\
│   ├── REBUILD_V1\                   # Preserved rebuild iteration 1
│   ├── REBUILD_V2\                   # Preserved rebuild iteration 2
│   └── OLD_FILES_BACKUP\             # Preserved legacy backups
├── BACKUP_PRE_CLEANUP\               # Cryptographically verified pre-cleanup backup
├── docs\                             # Project documentation and guides
├── logs\                             # Execution logs
├── scripts\                          # Core pipeline and utility scripts
├── validation\                       # Validation split manifests
├── AGENTS.md                         # Permanent project instructions
├── README.md                         # Project overview
└── skills-lock.json                  # Skills lockfile
```

---

## 3. Inventory & Execution Statistics

- **Total Files Inspected:** 1,541 files (1,401.22 MB)
- **Total Files Backed Up Before Modification:** 8 critical canonical datasets and notebooks (78.36 MB)
- **Files Reorganized / Moved:** 588 files
- **Files Archived into Historical Locations:** 825 files across `archive/` and `experiments/archive_marine/`
- **Files Deleted:** Exactly 43 compiled Python bytecode files (`.pyc`) and 14 `__pycache__` directories (0.38 MB). Zero user data, source code, models, or documentation files were deleted.
- **Unresolved / Uncertain Files:** 0 files (every single file was audited, categorized, and preserved).

---

## 4. Preserved Datasets Registry

### 4.1 Automotive Datasets (Current Vehicle Engine Project)
- **`data/processed/automotive/EngineFaultDB_Cleaned.csv`**
  * Dimensions: 55,998 rows $\times$ 15 columns
  * Size: 5.04 MB
  * SHA256: `dadf962aa1f0ac5bb78f0d579c3a37fc09d5792ae5e1824cb7337daae8a13a89`
  * Features: MAP, TPS, Force, Power, RPM, Consumption L/H, Consumption L/100KM, Speed, CO, HC, CO2, O2, Lambda, AFR, Fault.
  * Status: **Verified Intact and Readable**.
- **`data/processed/automotive/EngineFaultDB_3Class_Prepared.csv`**
  * Dimensions: 55,998 rows $\times$ 15 columns
  * Size: 4.61 MB
  * SHA256: `15102ad24ba0f3ac95ee4cf579893d5c58908f516a5789f252cf1479d2b274c3`
  * Features: Fault_Original, Engine_Condition, Block_ID_Inferred, MAP, TPS, Force, Power, RPM, Consumption L/H, Consumption L/100KM, CO, HC, CO2, O2, Lambda.
  * Status: **Verified Intact and Readable**.
- **Raw Uncleaned Automotive Data:**
  * Status: **Documented as Missing**. The project repository currently begins with the cleaned 55,998-record datasets (`EngineFaultDB_Cleaned.csv`). `data/raw/automotive/` is established as the designated ingestion folder when raw logs are provided.

### 4.2 Marine Engine Datasets (Preserved Historical Project)
- **`data/raw/marine/Marine_Engine_Fault_Data_v1.zip`** (25.31 MB) & unpacked raw runs (14 runs, 65.7 MB) $\rightarrow$ Preserved.
- **`data/processed/marine/marine_engine/primary_16_run_features.csv`** (79.92 MB) $\rightarrow$ Preserved.
- **`data/processed/marine/marine_engine/secondary_10_run_features.csv`** (43.79 MB) $\rightarrow$ Preserved.
- **Canonical MMAP Files (`data/processed/marine_engine/mmap/`):**
  * `X_primary_63.npy` (55.16 MB) $\rightarrow$ SHA256: `fc89ac43f3f1216d65b8e7be283a628f52098be568b5ee502cf3709ee13dd79d` (Verified Identical)
  * `y_target.npy` (0.88 MB) $\rightarrow$ SHA256: `38c0bf86f9f3f5b93cd44dd04cc8c88a7f2e00ac9a810be13a461cb6cf57596b` (Verified Identical)
  * `run_groups.npy` (0.44 MB) $\rightarrow$ SHA256: `727bb2ad281b0f9dd90ca660eb2fd48953ef41d5c7eed5943cb0d2a532540479` (Verified Identical)
  * `metadata.csv` (10.11 MB) $\rightarrow$ SHA256: `e928fef059f4a25f8e9ea2c90e366171e2a583dffdc0058bc66bc7f3a6dc1086` (Verified Identical)

---

## 5. Master Notebook Preservation Details

- **Canonical Master Notebook Path:**
  [`notebooks/MASTER_PROJECT_NOTEBOOK.ipynb`](file:///d:/ML-PROJECT/notebooks/MASTER_PROJECT_NOTEBOOK.ipynb)
- **Original Source File:**
  `notebooks/ML_PROJECT_UOL_MASTER.ipynb`
- **Integrity Verification:**
  * File Size: 1.69 MB
  * Cell Count: **Exactly 54 cells** (markdown text, LaTeX formulas, code, matplotlib visualization outputs)
  * SHA256 Checksum: `279ac7aaac650e99975206ee2e876aaa38caad613e89ec4b794bce6171a1e8e1`
  * Preserved Content:
    1. Section 1: Project Introduction & Operational Domain
    2. Section 2: Dataset Source & Engine Specifications (`EngineFaultDB`, Vergara et al.)
    3. Section 3: Exploratory Data Analysis (EDA) & Summary Statistics
    4. Section 4: Missing Value Analysis & Deduplication Provenance
    5. Section 5: Outlier Analysis & Engineering Decisions
    6. Section 6: Feature Engineering, Cross-Validation & Baseline Evaluations
- **Archive Notebooks:**
  * `notebooks/archive/PHASE_7_1_PARALLEL_CPU_WORKER.ipynb` (24 KB) preserved for reference.

---

## 6. Pre-Cleanup Backup Verification Log

Prior to moving or altering any files, a safety backup was created in `D:/ML-PROJECT/BACKUP_PRE_CLEANUP/`. All files were verified bit-for-bit identical via SHA256:

| Backed-Up File Relative Path | Size (MB) | Verified SHA256 Checksum | Backup Status |
| :--- | :---: | :--- | :---: |
| `notebooks/ML_PROJECT_UOL_MASTER.ipynb` | 1.65 MB | `279ac7aaac650e99975206ee2e876aaa38caad613e89ec4b794bce6171a1e8e1` | Verified Match |
| `data/interim/EngineFaultDB_Cleaned.csv` | 5.04 MB | `dadf962aa1f0ac5bb78f0d579c3a37fc09d5792ae5e1824cb7337daae8a13a89` | Verified Match |
| `data/processed/EngineFaultDB_3Class_Prepared.csv` | 4.61 MB | `15102ad24ba0f3ac95ee4cf579893d5c58908f516a5789f252cf1479d2b274c3` | Verified Match |
| `data/processed/marine_engine/mmap/X_primary_63.npy` | 55.16 MB | `fc89ac43f3f1216d65b8e7be283a628f52098be568b5ee502cf3709ee13dd79d` | Verified Match |
| `data/processed/marine_engine/mmap/y_target.npy` | 0.88 MB | `38c0bf86f9f3f5b93cd44dd04cc8c88a7f2e00ac9a810be13a461cb6cf57596b` | Verified Match |
| `data/processed/marine_engine/mmap/run_groups.npy` | 0.44 MB | `727bb2ad281b0f9dd90ca660eb2fd48953ef41d5c7eed5943cb0d2a532540479` | Verified Match |
| `data/processed/marine_engine/mmap/metadata.csv` | 10.11 MB | `e928fef059f4a25f8e9ea2c90e366171e2a583dffdc0058bc66bc7f3a6dc1086` | Verified Match |
| `data/processed/marine_engine/mmap/sample_indices.npy` | 0.88 MB | `109cbab08bb02d2073d842ff39f5cbb81b213b28b78809e5b8d009b0b471ca00` | Verified Match |

Backup manifest successfully saved to:
`D:/ML-PROJECT/BACKUP_PRE_CLEANUP/backup_manifest.json`

---

## 7. Final Verification Checks

An independent verification script (`scripts/verify_cleanup_integrity.py`) was executed to confirm workspace integrity:
1. `notebooks/MASTER_PROJECT_NOTEBOOK.ipynb` exists and passes full JSON parsing (54 cells) $\rightarrow$ **PASS**.
2. Both automotive datasets exist in `data/processed/automotive/` with 55,998 rows and 15 columns $\rightarrow$ **PASS**.
3. All 4 canonical marine mmap files match baseline SHA256 hashes $\rightarrow$ **PASS**.
4. Exactly 45 historical marine reports exist in `reports/archive_marine/` $\rightarrow$ **PASS**.
5. All historical rebuilds (`REBUILD_V1`, `REBUILD_V2`, `OLD_FILES_BACKUP`) are intact in `archive/` $\rightarrow$ **PASS**.
6. All 501 experimental result files exist in `experiments/archive_marine/results/` $\rightarrow$ **PASS**.
7. Pre-cleanup backup manifest verified with 8 bit-identical assets $\rightarrow$ **PASS**.

---

## 8. Final Stopping Condition

In strict adherence to Section 9 of the cleanup authorization:
- **Model Training:** Halted (zero models trained).
- **Automotive Project Implementation:** Halted (not initiated).
- **Workspace Status:** Cleaned, structured, verified, and ready for the Vehicle Engine Health Monitoring & Fault Diagnosis System.

