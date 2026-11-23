import os
import shutil
import hashlib
import json

WORKSPACE = r"d:/ML-PROJECT"
NOTEBOOKS_DIR = os.path.join(WORKSPACE, "notebooks")
ARCHIVE_NOTEBOOKS_DIR = os.path.join(NOTEBOOKS_DIR, "archive")

src_master = os.path.join(NOTEBOOKS_DIR, "ML_PROJECT_UOL_MASTER.ipynb")
dst_master = os.path.join(NOTEBOOKS_DIR, "MASTER_PROJECT_NOTEBOOK.ipynb")

print("=" * 80)
print("STEP 2: MASTER NOTEBOOK PRESERVATION")
print("=" * 80)

# 1. Copy canonical master notebook
print(f"Creating master copy: {dst_master}...")
shutil.copy2(src_master, dst_master)

# 2. Verify JSON validity and SHA256
with open(dst_master, "r", encoding="utf-8") as f:
    nb = json.load(f)

cells = nb.get("cells", [])
print(f"Verified master notebook JSON integrity: {len(cells)} cells present.")

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()

src_hash = get_sha256(src_master)
dst_hash = get_sha256(dst_master)
assert src_hash == dst_hash, "SHA256 mismatch between master and copy!"
print(f"Verified bit-identical SHA256: {dst_hash}")

# 3. Create archive directory and move secondary colab notebook
os.makedirs(ARCHIVE_NOTEBOOKS_DIR, exist_ok=True)
colab_nb = os.path.join(NOTEBOOKS_DIR, "colab", "PHASE_7_1_PARALLEL_CPU_WORKER.ipynb")
if os.path.exists(colab_nb):
    dst_colab = os.path.join(ARCHIVE_NOTEBOOKS_DIR, "PHASE_7_1_PARALLEL_CPU_WORKER.ipynb")
    print(f"Moving secondary colab notebook to archive: {dst_colab}...")
    shutil.move(colab_nb, dst_colab)
    # Remove empty colab dir if empty
    colab_dir = os.path.join(NOTEBOOKS_DIR, "colab")
    if os.path.exists(colab_dir) and len(os.listdir(colab_dir)) == 0:
        os.rmdir(colab_dir)

print("\nMaster notebook preservation complete.")
print(f"Master Notebook: {dst_master}")
print("=" * 80)

