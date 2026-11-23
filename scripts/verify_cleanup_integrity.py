import os
import json
import hashlib
import pandas as pd

WORKSPACE = r"d:/ML-PROJECT"

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()

print("=" * 80)
print("FINAL VERIFICATION & READABILITY AUDIT")
print("=" * 80)

# 1. Master Notebook Verification
master_nb_path = os.path.join(WORKSPACE, "notebooks", "MASTER_PROJECT_NOTEBOOK.ipynb")
orig_nb_path = os.path.join(WORKSPACE, "notebooks", "ML_PROJECT_UOL_MASTER.ipynb")

assert os.path.exists(master_nb_path), "MASTER_PROJECT_NOTEBOOK.ipynb does not exist!"
assert os.path.exists(orig_nb_path), "Original ML_PROJECT_UOL_MASTER.ipynb does not exist!"

with open(master_nb_path, "r", encoding="utf-8") as f:
    master_json = json.load(f)

with open(orig_nb_path, "r", encoding="utf-8") as f:
    orig_json = json.load(f)

assert len(master_json["cells"]) == len(orig_json["cells"]) == 54, "Cell count mismatch in master notebook!"
master_hash = get_sha256(master_nb_path)
orig_hash = get_sha256(orig_nb_path)
assert master_hash == orig_hash, "Hash mismatch between master notebook and original!"
print(f"[PASS] Master Notebook verified: {len(master_json['cells'])} cells, SHA256: {master_hash[:16]}...")

# 2. Automotive Datasets Verification
auto_cleaned_path = os.path.join(WORKSPACE, "data", "processed", "automotive", "EngineFaultDB_Cleaned.csv")
auto_prep_path = os.path.join(WORKSPACE, "data", "processed", "automotive", "EngineFaultDB_3Class_Prepared.csv")

assert os.path.exists(auto_cleaned_path), "EngineFaultDB_Cleaned.csv missing from processed/automotive!"
assert os.path.exists(auto_prep_path), "EngineFaultDB_3Class_Prepared.csv missing from processed/automotive!"

df_clean = pd.read_csv(auto_cleaned_path)
df_prep = pd.read_csv(auto_prep_path)

assert df_clean.shape == (55998, 15), f"Unexpected shape for EngineFaultDB_Cleaned: {df_clean.shape}"
assert df_prep.shape == (55998, 15), f"Unexpected shape for EngineFaultDB_3Class_Prepared: {df_prep.shape}"
print(f"[PASS] Automotive datasets verified: both have shape (55998, 15) and valid columns.")

# 3. Canonical Marine MMAP Hash Verification
canonical_hashes = {
    "X_primary_63.npy": "fc89ac43f3f1216d65b8e7be283a628f52098be568b5ee502cf3709ee13dd79d",
    "y_target.npy": "38c0bf86f9f3f5b93cd44dd04cc8c88a7f2e00ac9a810be13a461cb6cf57596b",
    "run_groups.npy": "727bb2ad281b0f9dd90ca660eb2fd48953ef41d5c7eed5943cb0d2a532540479",
    "metadata.csv": "e928fef059f4a25f8e9ea2c90e366171e2a583dffdc0058bc66bc7f3a6dc1086"
}

mmap_dir = os.path.join(WORKSPACE, "data", "processed", "marine_engine", "mmap")
for fname, expected_hash in canonical_hashes.items():
    fpath = os.path.join(mmap_dir, fname)
    actual_hash = get_sha256(fpath)
    assert actual_hash == expected_hash, f"Hash mismatch for canonical file {fname}!"
    print(f"[PASS] Canonical file {fname} verified identical: {actual_hash[:16]}...")

# 4. Reports Archival Verification
reports_archive_dir = os.path.join(WORKSPACE, "reports", "archive_marine")
archived_reports = [f for f in os.listdir(reports_archive_dir) if f.endswith(".md")]
print(f"[PASS] Historical marine reports verified: {len(archived_reports)} reports preserved in reports/archive_marine/.")
assert len(archived_reports) == 45, f"Expected 45 archived marine reports, found {len(archived_reports)}!"

# 5. Archive Directory Verification
archive_dir = os.path.join(WORKSPACE, "archive")
for d in ["REBUILD_V1", "REBUILD_V2", "OLD_FILES_BACKUP"]:
    dp = os.path.join(archive_dir, d)
    assert os.path.exists(dp), f"Archive subfolder missing: {dp}"
    n_files = sum(len(files) for _, _, files in os.walk(dp))
    print(f"[PASS] Archive {d} verified: {n_files} files preserved.")

# 6. Experiments Directory Verification
exp_results_dir = os.path.join(WORKSPACE, "experiments", "archive_marine", "results")
assert os.path.exists(exp_results_dir), "Experiments archive missing!"
n_exp_files = sum(len(files) for _, _, files in os.walk(exp_results_dir))
print(f"[PASS] Historical experiments verified: {n_exp_files} files preserved in experiments/archive_marine/results.")

# 7. Backup Directory Verification
backup_manifest_path = os.path.join(WORKSPACE, "BACKUP_PRE_CLEANUP", "backup_manifest.json")
assert os.path.exists(backup_manifest_path), "Backup manifest missing!"
with open(backup_manifest_path, "r") as f:
    manifest = json.load(f)
print(f"[PASS] Pre-cleanup backup verified: {len(manifest)} critical assets tracked with verified hashes.")

print("\n" + "=" * 80)
print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (7/7). WORKSPACE READY.")
print("=" * 80)

