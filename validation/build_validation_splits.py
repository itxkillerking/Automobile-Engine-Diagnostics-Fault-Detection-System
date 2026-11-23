"""
build_validation_splits.py
==========================
Reproducible Validation Splitting Script for Vehicle Engine Health Prediction.

Project: Vehicle Engine Health Prediction
Dataset: EngineFaultDB (Spark-Ignition C14NE Engine, Option B: 3-Class)
Phase: Phase 3 — Batch 1 (Leakage-Safe Validation Splits)

Approved Validation Architecture:
  1. Inferred Data Segments: 56 segments (Block_ID_Inferred IDs 0 to 55).
  2. Similar Segment Pairs: 14 pairs between original Fault 2 and Fault 3
     with identical MAP & TPS sequences are permanently bound into single validation units:
     (28, 42), (29, 43), (30, 44), (31, 45), (32, 46), (33, 47), (34, 48),
     (35, 49), (36, 50), (37, 51), (38, 52), (39, 53), (40, 54), (41, 55).
     Segment 27 is an unpaired individual segment.
  3. Validation Groups: Exactly 42 unique validation groups (Validation_Group_ID 0 to 41).
  4. Outer 5-Fold Partition:
     - Outer Fold 1: Locked Final Holdout Test Set (8 groups, 11,000 records, ~19.64%).
     - Outer Folds 2–5: Model Development Data (34 groups, 44,998 records, ~80.36%).
  5. Inner 4-Fold Cross-Validation:
     - Development data partitioned into 4 inner folds (Outer Folds 2..5 -> Inner Folds 1..4).
     - Each fold validates on 8–10 unseen groups while training on 24–26 groups.
     - All 4 folds contain all three target classes.
     - Zero group leakage across all train/val boundaries.
"""

import os
import sys
import numpy as np
import pandas as pd


def build_validation_splits(input_csv="data/processed/EngineFaultDB_3Class_Prepared.csv",
                            output_manifest_csv="validation/validation_split_manifest.csv"):
    print("=" * 75)
    print("PHASE 3 — BATCH 1: BUILDING LEAKAGE-SAFE VALIDATION SPLITS")
    print("=" * 75)

    # 1. Load prepared dataset (check current dir and relative paths)
    if not os.path.exists(input_csv):
        for candidate in ["EngineFaultDB_3Class_Prepared.csv",
                          "../data/processed/EngineFaultDB_3Class_Prepared.csv",
                          "data/processed/EngineFaultDB_3Class_Prepared.csv"]:
            if os.path.exists(candidate):
                input_csv = candidate
                break
        else:
            raise FileNotFoundError(f"Prepared dataset '{input_csv}' not found.")

    print(f"[1/5] Loading prepared dataset: {input_csv} ...")
    df = pd.read_csv(input_csv)
    print(f"      Total records: {len(df):,d} | Columns: {len(df.columns)}")

    # 2. Construct Validation_Group_ID
    print("[2/5] Constructing Validation_Group_ID (binding 14 twin pairs) ...")
    seg_to_group = {}
    
    # Class 0: Segments 0 to 15 remain individual groups 0 to 15 (16 groups)
    for s in range(16):
        seg_to_group[s] = s
        
    # Class 1: Segments 16 to 26 remain individual groups 16 to 26 (11 groups)
    for s in range(16, 27):
        seg_to_group[s] = s
        
    # Class 2: Segment 27 remains an individual group 27 (1 group)
    seg_to_group[27] = 27
    
    # Class 2: Segments 28-41 paired with Segments 42-55 respectively (14 groups: 28 to 41)
    for k in range(14):
        s2 = 28 + k
        s3 = 42 + k
        gid = 28 + k
        seg_to_group[s2] = gid
        seg_to_group[s3] = gid

    validation_group_id = df['Block_ID_Inferred'].map(seg_to_group)
    unique_groups = validation_group_id.nunique()
    print(f"      Total unique validation groups created: {unique_groups} (IDs 0 to {validation_group_id.max()})")
    assert unique_groups == 42, f"Expected 42 groups, got {unique_groups}"

    # 3. Outer 5-Fold Partition
    print("[3/5] Assigning groups to Outer 5-Fold Partition ...")
    outer_folds = {
        1: [0, 1, 2, 17, 19, 28, 29, 30],
        2: [3, 4, 5, 18, 20, 31, 32, 33],
        3: [6, 7, 8, 21, 22, 34, 35, 36],
        4: [9, 10, 11, 23, 24, 37, 38, 39],
        5: [12, 13, 14, 15, 16, 25, 26, 27, 40, 41]
    }

    # Verify all 42 groups assigned exactly once
    assigned_groups = []
    for f, grps in outer_folds.items():
        assigned_groups.extend(grps)
    assert sorted(assigned_groups) == list(range(42)), "Groups assignment mismatch!"
    assert len(set(assigned_groups)) == 42, "Duplicate group assignments in outer folds!"

    group_to_outer = {}
    for fold_num, grps in outer_folds.items():
        for g in grps:
            group_to_outer[g] = fold_num

    outer_fold = validation_group_id.map(group_to_outer)

    # Dataset partition designation
    partition = outer_fold.apply(lambda x: 'Holdout_Test' if x == 1 else 'Development')

    # 4. Inner 4-Fold Cross-Validation on Development Data
    print("[4/5] Mapping development data to Inner 4-Fold Cross-Validation ...")
    outer_to_inner = {1: -1, 2: 1, 3: 2, 4: 3, 5: 4}
    inner_fold = outer_fold.map(outer_to_inner)

    # 5. Build and save manifest
    print(f"[5/5] Generating validation split manifest: {output_manifest_csv} ...")
    manifest = pd.DataFrame({
        'Record_ID': np.arange(len(df)),
        'Block_ID_Inferred': df['Block_ID_Inferred'],
        'Validation_Group_ID': validation_group_id,
        'Fault_Original': df['Fault_Original'],
        'Engine_Condition': df['Engine_Condition'],
        'Partition': partition,
        'Outer_Fold': outer_fold,
        'Inner_Fold': inner_fold
    })

    manifest.to_csv(output_manifest_csv, index=False)
    print(f"      Successfully saved record-level manifest: {len(manifest):,d} rows.")

    # Also build segment summary manifest
    seg_manifest_csv = output_manifest_csv.replace(".csv", "_segments.csv")
    seg_records = []
    for seg_id in range(56):
        seg_sub = manifest[manifest['Block_ID_Inferred'] == seg_id]
        seg_records.append({
            'Block_ID_Inferred': seg_id,
            'Validation_Group_ID': seg_sub['Validation_Group_ID'].iloc[0],
            'Fault_Original': seg_sub['Fault_Original'].iloc[0],
            'Engine_Condition': seg_sub['Engine_Condition'].iloc[0],
            'Partition': seg_sub['Partition'].iloc[0],
            'Outer_Fold': seg_sub['Outer_Fold'].iloc[0],
            'Inner_Fold': seg_sub['Inner_Fold'].iloc[0],
            'Start_Row': seg_sub['Record_ID'].min(),
            'End_Row': seg_sub['Record_ID'].max(),
            'Row_Count': len(seg_sub)
        })
    seg_df = pd.DataFrame(seg_records)
    seg_df.to_csv(seg_manifest_csv, index=False)
    print(f"      Successfully saved segment-level manifest: {len(seg_df)} segments to {seg_manifest_csv}.")

    # Verification and reporting
    print("\n" + "=" * 75)
    print("OUTER 5-FOLD PARTITION SUMMARY")
    print("=" * 75)
    for f in range(1, 6):
        sub = manifest[manifest['Outer_Fold'] == f]
        c0 = (sub['Engine_Condition'] == 0).sum()
        c1 = (sub['Engine_Condition'] == 1).sum()
        c2 = (sub['Engine_Condition'] == 2).sum()
        tot = len(sub)
        grps = sorted(sub['Validation_Group_ID'].unique().tolist())
        part_name = sub['Partition'].iloc[0]
        print(f"Outer Fold {f} [{part_name:12s}]: {len(grps):2d} groups | Rows: {tot:5d} ({tot/len(df)*100:5.2f}%)")
        print(f"   Group IDs: {grps}")
        print(f"   Class 0 (Healthy):          {c0:5d} ({c0/tot*100:5.2f}%)")
        print(f"   Class 1 (Rich Mixture):      {c1:5d} ({c1/tot*100:5.2f}%)")
        print(f"   Class 2 (Combined Lean/Low): {c2:5d} ({c2/tot*100:5.2f}%)\n")

    print("=" * 75)
    print("INNER 4-FOLD CROSS-VALIDATION SUMMARY (DEVELOPMENT DATA)")
    print("=" * 75)
    dev_sub = manifest[manifest['Partition'] == 'Development']
    for inner_f in range(1, 5):
        val_sub = dev_sub[dev_sub['Inner_Fold'] == inner_f]
        tr_sub = dev_sub[dev_sub['Inner_Fold'] != inner_f]
        
        val_c0 = (val_sub['Engine_Condition'] == 0).sum()
        val_c1 = (val_sub['Engine_Condition'] == 1).sum()
        val_c2 = (val_sub['Engine_Condition'] == 2).sum()
        val_tot = len(val_sub)
        
        val_grps = set(val_sub['Validation_Group_ID'])
        tr_grps = set(tr_sub['Validation_Group_ID'])
        leak = val_grps.intersection(tr_grps)
        
        print(f"Inner Fold {inner_f}:")
        print(f"   Validation: {val_tot:5d} rows across {len(val_grps):2d} groups: {sorted(val_grps)}")
        print(f"   Training:   {len(tr_sub):5d} rows across {len(tr_grps):2d} groups")
        print(f"   Group Leakage: {len(leak)} groups")
        print(f"   Val Class 0 (Healthy):          {val_c0:5d} ({val_c0/val_tot*100:5.2f}%)")
        print(f"   Val Class 1 (Rich Mixture):      {val_c1:5d} ({val_c1/val_tot*100:5.2f}%)")
        print(f"   Val Class 2 (Combined Lean/Low): {val_c2:5d} ({val_c2/val_tot*100:5.2f}%)\n")
        assert len(leak) == 0, f"Group leakage detected in Inner Fold {inner_f}!"
        assert val_c0 > 0 and val_c1 > 0 and val_c2 > 0, f"Missing class in Inner Fold {inner_f}!"

    print("=" * 75)
    print("PROGRAMMATIC ASSERTION AUDIT")
    print("=" * 75)
    # Check 1: Record counts
    assert len(manifest) == 55998, "Row count mismatch in manifest!"
    # Check 2: Outer fold counts
    assert (manifest['Outer_Fold'] == 1).sum() == 11000, "Fold 1 count mismatch!"
    assert (manifest['Outer_Fold'] == 2).sum() == 10999, "Fold 2 count mismatch!"
    assert (manifest['Outer_Fold'] == 3).sum() == 11000, "Fold 3 count mismatch!"
    assert (manifest['Outer_Fold'] == 4).sum() == 11000, "Fold 4 count mismatch!"
    assert (manifest['Outer_Fold'] == 5).sum() == 11999, "Fold 5 count mismatch!"
    # Check 3: Outer leakage
    for f1 in range(1, 6):
        g1 = set(manifest[manifest['Outer_Fold'] == f1]['Validation_Group_ID'])
        for f2 in range(f1 + 1, 6):
            g2 = set(manifest[manifest['Outer_Fold'] == f2]['Validation_Group_ID'])
            assert len(g1.intersection(g2)) == 0, f"Leakage between outer fold {f1} and {f2}!"
    # Check 4: Similar segment pair integrity
    for k in range(14):
        s2 = 28 + k
        s3 = 42 + k
        g2 = manifest[manifest['Block_ID_Inferred'] == s2]['Validation_Group_ID'].iloc[0]
        g3 = manifest[manifest['Block_ID_Inferred'] == s3]['Validation_Group_ID'].iloc[0]
        f2 = manifest[manifest['Block_ID_Inferred'] == s2]['Outer_Fold'].iloc[0]
        f3 = manifest[manifest['Block_ID_Inferred'] == s3]['Outer_Fold'].iloc[0]
        assert g2 == g3, f"Pair ({s2}, {s3}) has different Group IDs: {g2} vs {g3}"
        assert f2 == f3, f"Pair ({s2}, {s3}) has different Outer Folds: {f2} vs {f3}"
    print("  [PASSED] All 55,998 records assigned exactly once.")
    print("  [PASSED] Exactly 42 unique validation groups verified.")
    print("  [PASSED] Zero group leakage across all outer and inner fold boundaries.")
    print("  [PASSED] All 14 twin segment pairs strictly bound into identical validation groups and folds.")
    print("  [PASSED] Fold 1 locked holdout test set (11,000 rows, 19.64%) verified.")
    print("  [PASSED] All 4 inner cross-validation folds verified with full 3-class representation.")
    print("=" * 75)
    return manifest


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, "EngineFaultDB_3Class_Prepared.csv")
    output_path = os.path.join(base_dir, "validation_split_manifest.csv")
    build_validation_splits(input_path, output_path)
