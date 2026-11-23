# Raw Benchmark Data Provenance & Verification

The original upstream benchmark dataset is **EngineFaultDB** (*Vergara et al., IEEE Access 2023*):
- **Repository:** https://github.com/leoxthomas/EngineFaultDB
- **Paper DOI:** https://doi.org/10.1109/ACCESS.2023.3331316
- **Test Engine:** Opel / Chevrolet C14NE (1.4L, 4-cylinder, multipoint electronic fuel injection) on dynamometer test bench.

### Record Count & Ingestion Audit
- **Original CSV Loaded from Source:** 55,999 records $\times$ 15 columns (from `EngineFaultDB_Final.csv`).
- **Exact Duplicate Rows:** Exactly 1 duplicate row identified during exploratory data analysis (consecutive duplicate row in the tail).
- **Post-Deduplication Dataset:** 55,998 records $\times$ 15 columns.

### Measurement Units & Calibration Uncertainty
- **Source Documentation:** The IEEE Access publication and official repository document:
  - `MAP`: Manifold Absolute Pressure in kilopascals (kPa)
  - `TPS`: Throttle Position Sensor in percentage (%)
  - Emissions (`CO`, `CO2`, `O2` in %; `HC` in ppm; `Lambda` dimensionless ratio)
- **Empirical Stored Ranges:**
  - `MAP`: Values range from 0.453 to 4.547 (mean ~1.833, median ~1.391).
  - `TPS`: Values range from 0.382 to 4.048 (mean ~1.395, median ~0.781).
- **Unresolved Calibration Note:** The stored numerical values fall in an unexpected range that does not match standard atmospheric MAP values (~20–100 kPa) or typical throttle percentage spans (0–100%). However, without official source confirmation of DAQ calibration formulas or conversion transfer functions, no assumptions or claims regarding specific analog voltage conversions (e.g., GM Delco scales) are asserted. Stored values are preserved as recorded without artificial transformations.

### Holdout Disclosure
- **Exploratory Analysis Context:** Initial exploratory data analysis (auditing missing values, duplicate checks, and overall feature correlations) was performed on the full dataset prior to establishing the leakage-safe validation split.
- **Strict Isolation for Modeling:** Once the group-aware 5-fold outer partition was established, Outer Fold 1 (`Holdout_Test`, 11,000 records) was strictly excluded from all baseline model fitting, loss weighting, cross-validation, and model selection.
- **Pending Evaluation:** Final evaluation on `Holdout_Test` remains locked until model selection and optimization are formally completed.

### Directory Structure & Data Artifacts:
- `data/raw/`: Dedicated for upstream documentation and benchmark provenance.
- `data/interim/EngineFaultDB_Cleaned.csv`: Intermediate export after deduplication (55,998 rows).
- `data/processed/EngineFaultDB_3Class_Prepared.csv`: Final prepared dataset with 3-class target mapping (`Engine_Condition`), 12 selected input features, and inferred segment metadata (`Block_ID_Inferred`).
