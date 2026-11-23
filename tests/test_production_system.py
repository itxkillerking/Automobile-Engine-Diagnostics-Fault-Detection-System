import os
import sys
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPLOY_DIR = os.path.join(BASE_DIR, "final_model_deploy")
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from final_model_deploy.inference import load_artifact, predict_engine_health

def run_all_tests():
    print("=== RUNNING PHASE 9 AUTOMATED PRODUCTION TESTS ===\n")

    # Test 1: Check all deployment files exist
    req_files = ["engine_diagnosis_prod_v1.joblib", "inference.py", "model_metadata.json"]
    for f in req_files:
        path = os.path.join(DEPLOY_DIR, f)
        assert os.path.exists(path), f"FAIL: Missing {f} in final_model_deploy!"
    print("[PASS] Test 1: All 3 deployment files exist in final_model_deploy/")

    artifact = load_artifact()

    # Test 2: Healthy Engine Prediction
    healthy_df = pd.DataFrame([artifact["healthy_mean"]])
    res_healthy = predict_engine_health(healthy_df, artifact)[0]
    assert res_healthy["status"] == "OK", "FAIL: Healthy sample returned error"
    assert res_healthy["engine_health"] == "HEALTHY", "FAIL: Healthy baseline misclassified"
    print(f"[PASS] Test 2: Healthy baseline -> {res_healthy['engine_health']} ({res_healthy['confidence_pct']}% conf)")

    # Test 3: Unhealthy Fault Prediction + 'Why' Explanation
    fault_sample = pd.DataFrame([{
        "MAP": 1.45, "TPS": 1.15, "Force": 180.0, "Power": 4.20, "RPM": 2400.0,
        "Consumption L/H": 3.50, "Consumption L/100KM": 6.38,
        "CO": 0.45, "HC": 135.0, "CO2": 12.44, "O2": 0.85, "AFR": 15.10
    }])
    res_fault = predict_engine_health(fault_sample, artifact)[0]
    assert res_fault["engine_health"] == "UNHEALTHY", "FAIL: Fault sample not marked UNHEALTHY"
    assert len(res_fault["why_unhealthy"]) > 20, "FAIL: Missing 'Why Unhealthy' explanation"
    print(f"[PASS] Test 3: Fault detection & explanation -> {res_fault['fault_name']}")

    # Test 4: Batch Prediction (Multiple Rows)
    batch_df = pd.concat([healthy_df, fault_sample], ignore_index=True)
    res_batch = predict_engine_health(batch_df, artifact)
    assert len(res_batch) == 2, "FAIL: Batch prediction count mismatch"
    print(f"[PASS] Test 4: Batch prediction processed {len(res_batch)} rows")

    # Test 5: Invalid Sensor Input Rejection (Negative RPM)
    bad_df = healthy_df.copy()
    bad_df["RPM"] = -250.0
    res_bad = predict_engine_health(bad_df, artifact)[0]
    assert res_bad["status"] == "ERROR", "FAIL: Negative RPM was not rejected!"
    print(f"[PASS] Test 5: Invalid input guard -> {res_bad['message']}")

    print("\n====================================================")
    print("ALL 5 PRODUCTION TESTS PASSED SUCCESSFULLY! (100%)")
    print("====================================================")

if __name__ == "__main__":
    run_all_tests()
