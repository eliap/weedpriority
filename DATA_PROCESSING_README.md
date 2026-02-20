# Weed Data Processing Scripts

This folder contains scripts to extract, transform, and export weed prioritization data from Landcare group Excel worksheets.

## Key Scripts

### 1. `process_all_groups.cjs`
**Purpose**: Processes standard "Weed prioritization worksheet" Excel files.
**Supported Groups**:
- Jallukar
- Crowlands/Warrak (Includes special column mapping)
- Elmhurst
- Stawell
- Laharum

**Usage**:
```bash
node process_all_groups.cjs
```
**Output**: Generates a `.csv` file for each group in the parent directory (e.g., `Jallukar Landcare Group.csv`).

### 2. `process_halls_gap.cjs`
**Purpose**: Processes the specific Halls Gap Google Sheet export (`Weed prioritization worksheet_HallsGap.xlsx`).
**Features**:
- Extracts "Set your values" responses.
- extracts specific "Extent score Grahams ATM" and "Habitat score Grahams ATM" columns.
- Scales Extent scores by dividing by 25.
- Scales Habitat scores by dividing by 50.
- Maps control scores from the project table.

**Usage**:
```bash
node process_halls_gap.cjs
```
**Output**: Generates `Halls_Gap_Landcare_Group.csv` in the parent directory.

## Dependencies
- `xlsx`: For reading Excel files.
- `fs`: For file system operations.
- `Difficulty of control table_Project Platypus scores.xlsx`: Must be present in the parent directory for control score lookups.

## Notes for Future Work
- If new group files are added, add their filenames to the `filesToProcess` array in `process_all_groups.cjs`.
- If a new file has a different structure (like Halls Gap), consider creating a specific script or adapting the column mapping logic in `process_all_groups.cjs`.
