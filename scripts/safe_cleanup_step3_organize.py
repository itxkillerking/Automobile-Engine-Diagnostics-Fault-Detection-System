import os
import shutil
import hashlib

WORKSPACE = r"d:/ML-PROJECT"

print("=" * 80)
print("STEP 3: WORKSPACE REORGANIZATION & SAFE ARCHIVAL")
print("=" * 80)

# Helper function for safe move or copy
def safe_move(src, dst):
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        print(f"Moving: {src} -> {dst}")
        shutil.move(src, dst)

def safe_copy(src, dst):
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        print(f"Copying: {src} -> {dst}")
        shutil.copy2(src, dst)

# 1. ORGANIZE DATA DIRECTORIES
print("\n--- 1. Organizing Data Directories ---")
os.makedirs(os.path.join(WORKSPACE, "data", "raw", "automotive"), exist_ok=True)
os.makedirs(os.path.join(WORKSPACE, "data", "raw", "marine"), exist_ok=True)
os.makedirs(os.path.join(WORKSPACE, "data", "processed", "automotive"), exist_ok=True)
os.makedirs(os.path.join(WORKSPACE, "data", "processed", "marine"), exist_ok=True)

# Copy automotive processed datasets to data/processed/automotive/
safe_copy(
    os.path.join(WORKSPACE, "data", "interim", "EngineFaultDB_Cleaned.csv"),
    os.path.join(WORKSPACE, "data", "processed", "automotive", "EngineFaultDB_Cleaned.csv")
)
safe_copy(
    os.path.join(WORKSPACE, "data", "processed", "EngineFaultDB_3Class_Prepared.csv"),
    os.path.join(WORKSPACE, "data", "processed", "automotive", "EngineFaultDB_3Class_Prepared.csv")
)

# Move raw marine data to data/raw/marine/
safe_move(
    os.path.join(WORKSPACE, "data", "raw", "Marine_Engine_Fault_Data_v1.zip"),
    os.path.join(WORKSPACE, "data", "raw", "marine", "Marine_Engine_Fault_Data_v1.zip")
)
safe_move(
    os.path.join(WORKSPACE, "data", "raw", "Marine_Engine_Fault_Data_v1"),
    os.path.join(WORKSPACE, "data", "raw", "marine", "Marine_Engine_Fault_Data_v1")
)

# Copy marine processed data to data/processed/marine/ (retaining marine_engine for backward-compat)
dst_marine_proc = os.path.join(WORKSPACE, "data", "processed", "marine", "marine_engine")
src_marine_proc = os.path.join(WORKSPACE, "data", "processed", "marine_engine")
if os.path.exists(src_marine_proc) and not os.path.exists(dst_marine_proc):
    print(f"Copying {src_marine_proc} -> {dst_marine_proc}...")
    shutil.copytree(src_marine_proc, dst_marine_proc)

# 2. ORGANIZE REPORTS
print("\n--- 2. Organizing Reports ---")
archive_reports_dir = os.path.join(WORKSPACE, "reports", "archive_marine")
automotive_reports_dir = os.path.join(WORKSPACE, "reports", "automotive")
os.makedirs(archive_reports_dir, exist_ok=True)
os.makedirs(automotive_reports_dir, exist_ok=True)

reports_root = os.path.join(WORKSPACE, "reports")
for item in os.listdir(reports_root):
    item_path = os.path.join(reports_root, item)
    if os.path.isfile(item_path) and item.endswith(".md"):
        dst = os.path.join(archive_reports_dir, item)
        print(f"Archiving marine report: {item} -> reports/archive_marine/")
        shutil.move(item_path, dst)

# 3. ORGANIZE EXPERIMENTS (from results/)
print("\n--- 3. Organizing Experiments ---")
exp_dir = os.path.join(WORKSPACE, "experiments", "archive_marine")
os.makedirs(exp_dir, exist_ok=True)
results_dir = os.path.join(WORKSPACE, "results")
if os.path.exists(results_dir):
    dst_res = os.path.join(exp_dir, "results")
    if not os.path.exists(dst_res):
        print(f"Moving results/ -> experiments/archive_marine/results...")
        shutil.move(results_dir, dst_res)

# 4. ORGANIZE ARCHIVE DIRECTORY (REBUILD_V1, REBUILD_V2, OLD_FILES_BACKUP)
print("\n--- 4. Organizing Historical Archive ---")
archive_root = os.path.join(WORKSPACE, "archive")
os.makedirs(archive_root, exist_ok=True)

for folder in ["REBUILD_V1", "REBUILD_V2", "OLD_FILES_BACKUP"]:
    p = os.path.join(WORKSPACE, folder)
    if os.path.exists(p):
        dst = os.path.join(archive_root, folder)
        if not os.path.exists(dst):
            print(f"Archiving historical rebuild/backup folder: {folder} -> archive/{folder}...")
            shutil.move(p, dst)

# 5. CREATE DOCS, LOGS, MODELS/ARCHIVE
print("\n--- 5. Ensuring Standard Structure Folders ---")
os.makedirs(os.path.join(WORKSPACE, "docs"), exist_ok=True)
os.makedirs(os.path.join(WORKSPACE, "logs"), exist_ok=True)
os.makedirs(os.path.join(WORKSPACE, "models", "archive_marine"), exist_ok=True)

# 6. DISPOSABLE CACHE CLEANUP (__pycache__, *.pyc)
print("\n--- 6. Removing Confirmed Disposable Cache Files ---")
pycache_count = 0
pyc_count = 0

for root, dirs, files in os.walk(WORKSPACE, topdown=False):
    for f in files:
        if f.endswith(".pyc") or f.endswith(".tmp"):
            fp = os.path.join(root, f)
            try:
                os.remove(fp)
                pyc_count += 1
            except Exception as e:
                print(f"Could not remove {fp}: {e}")
    for d in dirs:
        if d == "__pycache__":
            dp = os.path.join(root, d)
            try:
                shutil.rmtree(dp)
                pycache_count += 1
            except Exception as e:
                print(f"Could not remove {dp}: {e}")

print(f"Removed {pyc_count} .pyc files and {pycache_count} __pycache__ directories.")
print("=" * 80)
print("WORKSPACE REORGANIZATION & SAFE ARCHIVAL COMPLETE.")
print("=" * 80)

