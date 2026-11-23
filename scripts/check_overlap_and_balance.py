import os
import pandas as pd

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"

def balance_classes():
    print("1. Loading already-scaled training data...")
    X_train = pd.read_csv(os.path.join(processed_dir, "X_train_scaled.csv"))
    y_train = pd.read_csv(os.path.join(processed_dir, "y_train.csv")).squeeze()

    print("\n=== BEFORE BALANCING (Training Class Counts) ===")
    print(y_train.value_counts().sort_index())

    print("\n2. Balancing all 4 classes to be 100% equal...")
    train_df = X_train.copy()
    train_df["Fault"] = y_train.values

    min_count = int(train_df["Fault"].value_counts().min())
    
    # Pandas 3.x safe sampling: keeps the 'Fault' column intact
    balanced_df = (
        train_df.groupby("Fault")
        .sample(n=min_count, random_state=42)
        .sample(frac=1.0, random_state=42)
        .reset_index(drop=True)
    )

    X_train_bal = balanced_df.drop(columns=["Fault"])
    y_train_bal = balanced_df["Fault"]

    print("\n=== AFTER BALANCING (Training Class Counts) ===")
    print(y_train_bal.value_counts().sort_index())

    X_train_bal.to_csv(os.path.join(processed_dir, "X_train_balanced.csv"), index=False)
    y_train_bal.to_csv(os.path.join(processed_dir, "y_train_balanced.csv"), index=False)
    print("\nSUCCESS! Saved X_train_balanced.csv and y_train_balanced.csv.")

if __name__ == "__main__":
    balance_classes()