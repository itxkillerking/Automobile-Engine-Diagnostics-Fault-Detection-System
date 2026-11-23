import pandas as pd
import os

# Update this filename if your downloaded file is named slightly differently
file_path = r"D:\ML-PROJECT\data\raw\automotive\EngineFaultDB_Final.csv"

def run_audit():
    if not os.path.exists(file_path):
        print(f"Error: Could not find the file at {file_path}")
        print("Please check the exact filename in your automotive folder and update the script.")
        return

    print("Loading dataset...\n")
    df = pd.read_csv(file_path)
    
    print("=== FORENSIC AUDIT: PART 1 ===")
    print(f"Total Records (Rows): {df.shape[0]}")
    print(f"Total Variables (Columns): {df.shape[1]}\n")
    
    print("=== COLUMNS & DATA TYPES ===")
    print(df.dtypes)
    print("\n")
    
    print("=== MISSING VALUES ===")
    missing = df.isnull().sum()
    print(missing[missing > 0] if missing.sum() > 0 else "No missing values found.")
    print("\n")
    
    print("=== EXACT DUPLICATE ROWS ===")
    duplicates = df.duplicated().sum()
    print(f"Total exact duplicate rows: {duplicates}")
    print("\n")
    
    print("=== CLASS DISTRIBUTION ===")
    # The target column is usually the last one. Let's inspect it.
    target_col = df.columns[-1] 
    print(f"Target Column Name: '{target_col}'")
    print(df[target_col].value_counts(dropna=False))

if __name__ == "__main__":
    run_audit()
    