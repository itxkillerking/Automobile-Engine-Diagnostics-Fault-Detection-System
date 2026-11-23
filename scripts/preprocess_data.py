import pandas as pd
from sklearn.model_selection import train_test_split
import os

file_path = r"D:\ML-PROJECT\data\raw\automotive\EngineFaultDB_Final.csv"
processed_dir = r"D:\ML-PROJECT\data\processed\automotive"

def clean_and_split():
    print("Loading raw dataset...")
    df = pd.read_csv(file_path)
    
    print("Dropping perfectly redundant features: 'Speed' and 'Lambda'...")
    df_cleaned = df.drop(columns=['Speed', 'Lambda'])
    
    print("Separating features (X) and target (y)...")
    X = df_cleaned.drop(columns=['Fault'])
    y = df_cleaned['Fault']
    
    print("Splitting data (80% Training / 20% Testing) with class stratification...")
    # stratify=y ensures both sets have the exact same ratio of Fault classes
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    print("Saving processed datasets...")
    os.makedirs(processed_dir, exist_ok=True)
    
    X_train.to_csv(os.path.join(processed_dir, 'X_train.csv'), index=False)
    X_test.to_csv(os.path.join(processed_dir, 'X_test.csv'), index=False)
    y_train.to_csv(os.path.join(processed_dir, 'y_train.csv'), index=False)
    y_test.to_csv(os.path.join(processed_dir, 'y_test.csv'), index=False)
    
    print("\nSUCCESS! Phase 3 Split Complete.")
    print(f"Training Features Shape: {X_train.shape}")
    print(f"Testing Features Shape: {X_test.shape}")

if __name__ == "__main__":
    clean_and_split()