import pandas as pd

file_path = r"D:\ML-PROJECT\data\raw\automotive\EngineFaultDB_Final.csv"

def run_advanced_audit():
    print("Loading dataset...\n")
    df = pd.read_csv(file_path)
    
    print("=== TRUE CLASS DISTRIBUTION (FAULT COLUMN) ===")
    print(df['Fault'].value_counts().sort_index())
    print("\n")
    
    print("=== STATIONARY & CONSTANT FEATURE CHECK ===")
    # Check if speed or consumption are static because it's a lab bench
    for col in ['Speed', 'Consumption L/100KM']:
        unique_vals = df[col].nunique()
        min_val = df[col].min()
        max_val = df[col].max()
        print(f"{col}: {unique_vals} unique values | Range: {min_val} to {max_val}")
    print("\n")
    
    print("=== DERIVED FEATURE CHECK (MULTICOLLINEARITY) ===")
    # AFR and Lambda measure the exact same physical property.
    corr_afr_lambda = df['AFR'].corr(df['Lambda'])
    print(f"Correlation between AFR and Lambda: {corr_afr_lambda:.6f}")
    print("\n")
    
    print("=== TIME-SERIES / SEQUENTIAL LEAKAGE CHECK ===")
    # If the data is recorded at high frequency, adjacent rows will be almost identical.
    # We will check how often RPM changes by less than 1% from the previous row.
    rpm_diff_percentage = (df['RPM'].diff().abs() / df['RPM'].shift(1)) * 100
    very_similar_rows = (rpm_diff_percentage <= 1.0).sum()
    total_valid_rows = len(df) - 1
    leakage_risk = (very_similar_rows / total_valid_rows) * 100
    
    print(f"Rows where RPM changes by <= 1% from the previous row: {very_similar_rows}")
    print(f"Time-Series Leakage Risk Indicator: {leakage_risk:.2f}%")
    if leakage_risk > 80:
        print("WARNING: This is high-frequency sequential data. Random splitting will cause severe leakage.")

if __name__ == "__main__":
    run_advanced_audit()