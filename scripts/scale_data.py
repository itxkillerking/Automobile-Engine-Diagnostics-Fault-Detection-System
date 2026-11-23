import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib
import os

processed_dir = r"D:\ML-PROJECT\data\processed\automotive"
models_dir = r"D:\ML-PROJECT\models"

def scale_features():
    print("Loading split datasets...")
    X_train = pd.read_csv(os.path.join(processed_dir, 'X_train.csv'))
    X_test = pd.read_csv(os.path.join(processed_dir, 'X_test.csv'))
    
    print("Fitting StandardScaler strictly on X_train...")
    scaler = StandardScaler()
    
    # Fit on training data ONLY, then transform both
    X_train_scaled = pd.DataFrame(
        scaler.fit_transform(X_train), 
        columns=X_train.columns
    )
    X_test_scaled = pd.DataFrame(
        scaler.transform(X_test), 
        columns=X_test.columns
    )
    
    print("Saving scaled datasets and scaler artifact...")
    X_train_scaled.to_csv(os.path.join(processed_dir, 'X_train_scaled.csv'), index=False)
    X_test_scaled.to_csv(os.path.join(processed_dir, 'X_test_scaled.csv'), index=False)
    
    os.makedirs(models_dir, exist_ok=True)
    scaler_path = os.path.join(models_dir, 'automotive_scaler.joblib')
    joblib.dump(scaler, scaler_path)
    
    print("\nSUCCESS! Feature Scaling Complete.")
    print(f"Saved scaler to: {scaler_path}")
    print("\nCheck Mean (should be ~0) and Std (should be ~1) of first 3 features in X_train_scaled:")
    for col in X_train_scaled.columns[:3]:
        print(f"  {col}: mean={X_train_scaled[col].mean():.4f}, std={X_train_scaled[col].std():.4f}")

if __name__ == "__main__":
    scale_features()