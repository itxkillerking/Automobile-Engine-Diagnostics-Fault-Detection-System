import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import os

file_path = r"D:\ML-PROJECT\data\raw\automotive\EngineFaultDB_Final.csv"
reports_dir = r"D:\ML-PROJECT\reports"

def run_eda():
    print("Starting Exploratory Data Analysis (EDA)...")
    df = pd.read_csv(file_path)
    
    # 1. Summary Statistics
    print("Generating summary statistics...")
    summary_stats = df.describe()
    summary_stats.to_csv(os.path.join(reports_dir, 'summary_statistics.csv'))
    
    # 2. Correlation Matrix Heatmap
    print("Generating correlation heatmap (this might take a few seconds)...")
    plt.figure(figsize=(12, 10))
    corr_matrix = df.corr()
    sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f', linewidths=0.5)
    plt.title('Feature Correlation Heatmap')
    plt.tight_layout()
    heatmap_path = os.path.join(reports_dir, 'correlation_heatmap.png')
    plt.savefig(heatmap_path, dpi=300)
    plt.close() # Close plot to free up memory
    
    # 3. Class Distribution Bar Chart
    print("Generating class distribution chart...")
    plt.figure(figsize=(8, 6))
    sns.countplot(data=df, x='Fault', hue='Fault', palette='viridis', legend=False)
    plt.title('Fault Class Distribution')
    plt.tight_layout()
    class_dist_path = os.path.join(reports_dir, 'class_distribution.png')
    plt.savefig(class_dist_path, dpi=300)
    plt.close() # Close plot to free up memory
    
    print("\nEDA complete! The following files have been saved:")
    print(f"1. {os.path.join(reports_dir, 'summary_statistics.csv')}")
    print(f"2. {heatmap_path}")
    print(f"3. {class_dist_path}")

if __name__ == "__main__":
    run_eda()