const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const EXCEL_FILE = 'all group app inputs.xlsx';
const WEED_PROFILES_FILE = path.join(__dirname, 'src', 'data', 'weedProfiles.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'group outputs');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const normalize = (str) => str ? str.trim().toLowerCase() : '';

// --- 1. Load Weed Profiles: Scientific Name -> Canonical Common Name Key ---
let weedProfiles = {};
let scientificToCanonical = {};
try {
    const raw = fs.readFileSync(WEED_PROFILES_FILE, 'utf8');
    weedProfiles = JSON.parse(raw);

    Object.keys(weedProfiles).forEach(commonNameKey => {
        const profile = weedProfiles[commonNameKey];
        if (profile.scientificName) {
            scientificToCanonical[normalize(profile.scientificName)] = commonNameKey;
        }
    });
    console.log(`Loaded ${Object.keys(scientificToCanonical).length} scientific name mappings from weedProfiles.json`);
} catch (err) {
    console.error("Error loading weedProfiles.json:", err.message);
    process.exit(1);
}

// --- 2. Load Input Excel ---
let workbook;
try {
    workbook = XLSX.readFile(path.resolve(__dirname, '..', EXCEL_FILE));
} catch (err) {
    console.error("Error loading input Excel file:", err.message);
    process.exit(1);
}

// --- Constants & Helpers ---
const ALL_VALUE_IDS = [
    "social_access", "social_tourism", "social_injurious", "social_cultural",
    "env_flow", "env_water", "env_erosion", "env_biomass", "env_fire",
    "hab_high", "hab_med", "hab_low", "hab_structure", "hab_flora",
    "fauna_threatened", "fauna_non_threatened", "fauna_no_benefit", "fauna_injurious",
    "pest_food", "pest_harbor", "ag_yield", "ag_quality", "ag_land_value",
    "ag_land_use", "ag_harvest_costs", "ag_disease"
];

function mapScore(value) {
    if (value === null || value === undefined || value === '-' || String(value).trim() === '') {
        return null;
    }
    const num = Number(value);
    return isNaN(num) ? null : num;
}

function mapControlLevel(value) {
    if (value === null || value === undefined || value === '-' || String(value).trim() === '') {
        return null;
    }
    const str = String(value);
    const match = str.match(/\d/);
    if (match) {
        return Number(match[0]);
    }
    return null;
}

// --- 3. Process each sheet ---
// Skip sheets that aren't group data (e.g. "scientific name look up")
const GROUP_SHEETS = workbook.SheetNames.filter(name => name !== 'scientific name look up');

GROUP_SHEETS.forEach(sheetName => {
    console.log(`\nProcessing Group: ${sheetName}`);

    const groupName = sheetName.replace(/\b\w/g, l => l.toUpperCase());
    const selectedValues = {};
    ALL_VALUE_IDS.forEach(id => selectedValues[id] = true);

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const unmapped = [];

    const weeds = rows.map((row, index) => {
        const scientificName = row['Scientific Name'];
        const commonName = row['Common Name'];
        if (!scientificName && !commonName) return null;

        let resolvedName = commonName || scientificName; // ultimate fallback

        if (scientificName) {
            const normSci = normalize(scientificName);
            const canonicalName = scientificToCanonical[normSci];
            if (canonicalName) {
                resolvedName = canonicalName;
            } else {
                // Scientific name not found in weedProfiles - fall back to Common Name
                unmapped.push({ scientificName, commonName: commonName || '(none)' });
                resolvedName = commonName || scientificName;
            }
        }

        return {
            id: Date.now() + index,
            name: resolvedName,
            rank: mapScore(row['Rank']) || (index + 1),
            extent: mapScore(row['Extent']),
            habitat: mapScore(row['Habitat']),
            controlLevel: mapControlLevel(row['Control'])
        };
    }).filter(w => w !== null);

    if (unmapped.length > 0) {
        console.log(`  WARNING: ${unmapped.length} weed(s) could not be mapped via scientific name:`);
        unmapped.forEach(u => console.log(`    - "${u.scientificName}" (fallback: "${u.commonName}")`));
    }

    const exportData = { weeds, selectedValues, groupName };

    const fileName = `${sheetName.toLowerCase()}_progress.json`;
    const outputPath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`  Saved: ${fileName} (${weeds.length} weeds)`);
});

console.log("\nDone! All files generated in 'group outputs'.");
