import os
import shutil
import hashlib
import json

WORKSPACE = r"d:/ML-PROJECT"
BACKUP_DIR = os.path.join(WORKSPACE, "BACKUP_PRE_CLEANUP")

files_to_backup = [
    os.path.join("notebooks", "ML_PROJECT_UOL_MASTER.ipynb"),
    os.path.join("data", "interim", "EngineFaultDB_Cleaned.csv"),
    os.path.join("data", "processed", "EngineFaultDB_3Class_Prepared.csv"),
    os.path.join("data", "processed", "marine_engine", "mmap", "X_primary_63.npy"),
    os.path.join("data", "processed", "marine_engine", "mmap", "y_target.npy"),
    os.path.join("data", "processed", "marine_engine", "mmap", "run_groups.npy"),
    os.path.join("data", "processed", "marine_engine", "mmap", "metadata.csv"),
    os.path.join("data", "processed", "marine_engine", "mmap", "sample_indices.npy")
]

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()

print("=" * 80)
print("STEP 1: CREATING PRE-CLEANUP SAFETY BACKUP & VERIFYING CHECKSUMS")
print("=" * 80)

os.makedirs(BACKUP_DIR, exist_ok=True)
manifest = {}

for rel_path in files_to_backup:
    src = os.path.join(WORKSPACE, rel_path)
    dst = os.path.join(BACKUP_DIR, rel_path)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    
    print(f"Backing up: {rel_path}...")
    shutil.copy2(src, dst)
    
    src_hash = get_sha256(src)
    dst_hash = get_sha256(dst)
    src_size = os.path.getsize(src)
    dst_size = os.path.getsize(dst)
    
    assert src_hash == dst_hash, f"Hash mismatch for {rel_path}!"
    assert src_size == dst_size, f"Size mismatch for {rel_path}!"
    
    manifest[rel_path] = {
        "sha256": src_hash,
        "size_bytes": src_size,
        "status": "VERIFIED_BIT_IDENTICAL"
    }
    print(f"  -> Verified bit-identical! SHA256: {src_hash[:16]}... ({src_size / (1024*1024):.2f} MB)")

manifest_path = os.path.join(BACKUP_DIR, "backup_manifest.json")
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)

print("\nAll critical files backed up and verified successfully.")
print(f"Manifest written to: {manifest_path}")
print("=" * 80)

