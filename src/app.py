import os
import sys
import datetime
import pandas as pd
import streamlit as st

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from final_model_deploy.inference import load_artifact, validate_input, predict_engine_health

st.set_page_config(page_title="Engine Health & Fault Diagnosis", layout="wide")

@st.cache_resource
def load_system():
    return load_artifact()

st.title("Vehicle Engine Health Monitoring & Fault Diagnosis System")
st.caption("Production v1.0 | Two-Stage Hybrid Deep Neural Network (Adaptive Multi-Engine Diagnostics)")

artifact = load_system()
REQUIRED_SENSORS = artifact["required_sensors"]

if "history" not in st.session_state:
    st.session_state["history"] = []

tab1, tab2, tab3 = st.tabs(["1. Manual Sensor Diagnosis", "2. Batch CSV Upload", "3. Prediction History"])

with tab1:
    st.subheader("Enter Vehicle Engine Sensor Readings")
    preset = st.selectbox(
        "Load Example Sensor Preset:",
        [
            "Healthy Engine Baseline (Class 0)",
            "Rich Air-Fuel Mixture Fault (Class 1)",
            "Lean Burn Fault (Class 2)",
            "Low Ignition Voltage Fault (Class 3)"
        ]
    )

    if preset == "Healthy Engine Baseline (Class 0)":
        defaults = artifact["healthy_mean"]
    elif preset == "Rich Air-Fuel Mixture Fault (Class 1)":
        defaults = {
            "MAP": 3.25, "TPS": 3.10, "Force": 710.0, "Power": 20.03, "RPM": 4666.5,
            "Consumption L/H": 13.65, "Consumption L/100KM": 12.80,
            "CO": 9.29, "HC": 921.6, "CO2": 10.20, "O2": 0.45, "AFR": 12.10
        }
    elif preset == "Lean Burn Fault (Class 2)":
        defaults = {
            "MAP": 1.45, "TPS": 1.15, "Force": 180.0, "Power": 4.20, "RPM": 2400.0,
            "Consumption L/H": 3.50, "Consumption L/100KM": 6.38,
            "CO": 0.45, "HC": 135.0, "CO2": 12.44, "O2": 0.85, "AFR": 15.10
        }
    else:
        defaults = {
            "MAP": 2.10, "TPS": 1.75, "Force": 390.0, "Power": 9.10, "RPM": 2950.0,
            "Consumption L/H": 5.80, "Consumption L/100KM": 10.20,
            "CO": 1.85, "HC": 195.0, "CO2": 12.80, "O2": 0.52, "AFR": 14.20
        }

    cols = st.columns(4)
    user_input = {}
    for idx, sensor in enumerate(REQUIRED_SENSORS):
        with cols[idx % 4]:
            user_input[sensor] = st.number_input(
                sensor, value=float(round(defaults[sensor], 3)), format="%.3f"
            )

    if st.button("Run Engine Diagnosis", type="primary"):
        input_df = pd.DataFrame([user_input])
        result = predict_engine_health(input_df, artifact)[0]

        if result["status"] == "ERROR":
            st.error(result["message"])
        else:
            # Wide columns so Fault Name is never truncated with "..."
            c1, c2, c3 = st.columns([1, 2, 1])
            c1.metric("Engine Status", result["engine_health"])
            c2.metric("Diagnosis", result["fault_name"])
            c3.metric("Confidence", f"{result['confidence_pct']}%")

            st.markdown("### Why the Engine Is Healthy / Unhealthy:")
            if result["engine_health"] == "HEALTHY":
                st.success(result["why_unhealthy"])
            else:
                st.error(result["why_unhealthy"])

            st.info(result["diagnostic_note"])

            st.markdown("**Top Sensor Indicators:**")
            for item in result["abnormal_sensors"]:
                st.write(f"- {item}")

            record_entry = {
                "Timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "Engine_Health": result["engine_health"],
                "Diagnosis": result["fault_name"],
                "Confidence_%": result["confidence_pct"],
                "Why_Explanation": result["why_unhealthy"],
                "Note": result["diagnostic_note"]
            }
            st.session_state["history"].append(record_entry)

            report_text = (
                f"VEHICLE ENGINE DIAGNOSTIC REPORT\n"
                f"Generated: {record_entry['Timestamp']}\n"
                f"==========================================\n"
                f"Engine Status:            {result['engine_health']}\n"
                f"Fault Category:           {result['fault_name']}\n"
                f"Diagnosis Confidence:     {result['confidence_pct']}%\n\n"
                f"WHY / FAULT EXPLANATION:\n{result['why_unhealthy']}\n\n"
                f"DIAGNOSTIC NOTE:\n{result['diagnostic_note']}\n"
            )
            st.download_button(
                "Download Diagnostic Report (.txt)",
                data=report_text,
                file_name="engine_diagnostic_report.txt",
                mime="text/plain"
            )

with tab2:
    st.subheader("Upload Sensor CSV File for Batch Diagnosis")
    uploaded_file = st.file_uploader("Upload CSV", type=["csv"])
    if uploaded_file is not None:
        batch_df = pd.read_csv(uploaded_file)
        is_valid, msg = validate_input(batch_df, REQUIRED_SENSORS)
        if not is_valid:
            st.error(msg)
        elif st.button("Diagnose Uploaded Batch"):
            batch_results = predict_engine_health(batch_df, artifact)
            out_df = batch_df[REQUIRED_SENSORS].copy()
            out_df["Engine_Health"] = [r["engine_health"] for r in batch_results]
            out_df["Fault_Category"] = [r["fault_name"] for r in batch_results]
            out_df["Confidence_%"] = [r["confidence_pct"] for r in batch_results]
            out_df["Why_Unhealthy"] = [r["why_unhealthy"] for r in batch_results]
            st.success("Batch Diagnosis Complete!")
            st.dataframe(out_df.head(50))
            st.download_button(
                "Download Batch Results (.csv)",
                data=out_df.to_csv(index=False).encode("utf-8"),
                file_name="batch_diagnostic_results.csv",
                mime="text/csv"
            )

with tab3:
    st.subheader("Session Prediction History")
    if not st.session_state["history"]:
        st.info("No manual predictions run in this session yet.")
    else:
        hist_df = pd.DataFrame(st.session_state["history"])
        st.dataframe(hist_df)
