const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const targetFiles = [
    'Weed prioritization worksheet_CrowlandsWarrak.xlsx',
    'Weed prioritization worksheet_Laharum 110225.xlsx', // Inferred from search results, checking actual name
    'Weed prioritization worksheet_Elmhurst 2024_CURRENT.xlsx',
    'Weed prioritization worksheet_Stawell 2024_CURRENT.xlsx',
    'Weed prioritization worksheet_Jallukar 2024.xlsx'
];

// Helper to find actual filename if slightly different
const findFile = (partial) => {
    const files = fs.readdirSync('..');
    return files.find(f => f.includes(partial) && f.endsWith('.xlsx') && !f.includes('~$'));
};

const getControlScores = () => {
    const wbControl = XLSX.readFile('../Difficulty of control table_Project Platypus scores.xlsx');
    const sheet = wbControl.Sheets[wbControl.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1, raw: false, blankrows: false });

    const scores = {};
    data.forEach(row => {
        const sciName = row[0];
        if (!sciName) return;
        let score = null;
        if (row[2]) score = 1; else if (row[3]) score = 2; else if (row[4]) score = 3; else if (row[5]) score = 4;
        if (score) scores[sciName.trim().toLowerCase()] = score;
    });
    return scores;
};

const aliases = {
    "gazania rigens + splendens": "gazania spp.",
    "gazania linearis": "gazania spp.",
    "moraea flaccida": "moraea flaccida"
};

const logStream = fs.createWriteStream('group_data_output.txt', { flags: 'w' });

const log = (msg) => {
    console.log(msg);
    logStream.write(msg + '\n');
};

const processFile = (filename, controlScores) => {
    log(`\n\n############################################################`);
    log(`PROCESSING: ${filename}`);
    log(`############################################################`);

    const wb = XLSX.readFile(`../${filename}`);

    // --- Extract Group Name ---
    let groupName = filename.replace('.xlsx', '').replace('Weed prioritization worksheet_', '');
    const prelimSheet = wb.Sheets['FILL IN Prelim list'];
    if (prelimSheet) {
        const prelimData = XLSX.utils.sheet_to_json(prelimSheet, { header: 1, range: 0, raw: false, blankrows: false });
        if (prelimData.length > 0 && prelimData[0][1]) {
            // Row 0, Col 1 usually holds the group name
            groupName = prelimData[0][1];
        }
    }
    // Sanitize group name for filename
    const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

    let csvContent = `Group Name,${groupName}\n\n`;

    // --- Extract Values ---
    log("\n### 1. Values (Ticked YES)");
    csvContent += "### 1. Values (Ticked YES)\nValue Category\n";

    const valSheet = wb.Sheets['FILL IN Group consensus values'];
    if (valSheet) {
        const data = XLSX.utils.sheet_to_json(valSheet, { header: 1, range: 0, raw: false, blankrows: false });
        data.forEach(row => {
            if (row && row[0] && typeof row[0] === 'string' && row[4] === 'Y') {
                log(`- [x] ${row[0]}`);
                csvContent += `"${row[0]}"\n`;
            }
        });
    } else {
        log("Sheet 'FILL IN Group consensus values' not found.");
    }

    csvContent += "\n";

    // --- Extract Weeds ---
    const weedSheet = wb.Sheets['FILL IN Prelim list'];
    if (!weedSheet) {
        log("Sheet 'FILL IN Prelim list' not found.");
        return;
    }

    const wData = XLSX.utils.sheet_to_json(weedSheet, { header: 1, range: 0, raw: false, blankrows: false });
    const weeds = [];

    // Determine column indices based on filename or checking header row
    // Standard (Jallukar): SciName=1, Common=2, GutFeel=4, Extent=7, Habitat=10
    // Crowlands: SciName=0, Common=1, GutFeel=3, Extent=6, Habitat=9 (Based on inspection)

    let colSci = 1;
    let colCommon = 2;
    let colGut = 4;
    let colExtent = 7;
    let colHabitat = 10;

    if (filename.includes('Crowlands')) {
        colSci = 0;
        colCommon = 1;
        colGut = 3;
        colExtent = 6;
        colHabitat = 9;
    }

    for (let i = 7; i < wData.length; i++) {
        const row = wData[i];

        // Skip if row is empty or scientific name missing logic
        // Crowlands row 13 has null scientific name but "Greater mulain" common name?
        // Row 13: [null, "Greater mulain", ...]
        // So we should check if *either* SciName or CommonName exists to be safe?
        // But for matching control scores we really need SciName. 
        // Let's rely on CommonName if SciName is missing for list purposes, but scoring will fail.

        const sciName = row[colSci];
        const commonName = row[colCommon];

        if (!sciName && !commonName) continue;
        if (sciName === 'Scientific name') continue;

        const nameDisplay = sciName ? `${commonName} (${sciName})` : commonName;

        weeds.push({
            name: nameDisplay,
            common: commonName,
            sciName: sciName,
            gutFeel: row[colGut],
            rawGutFeel: row[colGut],
            extent: row[colExtent] !== undefined && row[colExtent] !== 'not ranked' ? Math.round(parseFloat(row[colExtent])) : row[colExtent],
            habitat: row[colHabitat] !== undefined && row[colHabitat] !== 'not ranked' ? Math.round(parseFloat(row[colHabitat])) : row[colHabitat]
        });
    }

    // Rank logic
    const ranked = weeds.filter(w => !isNaN(parseFloat(w.gutFeel)));
    const unranked = weeds.filter(w => isNaN(parseFloat(w.gutFeel)));

    if (filename.includes('Crowlands')) {
        log(`DEBUG: Ranking ${ranked.length} weeds for Crowlands`);
        ranked.forEach(w => log(`  - ${w.name}: gutFeel='${w.gutFeel}' parsed=${parseFloat(w.gutFeel)}`));
    }

    ranked.sort((a, b) => parseFloat(a.gutFeel) - parseFloat(b.gutFeel));

    if (filename.includes('Crowlands')) {
        log(`DEBUG: After sorting:`);
        ranked.forEach(w => log(`  - ${w.name}: ${parseFloat(w.gutFeel)}`));
    }

    ranked.forEach((w, i) => w.calculatedRank = i + 1);
    unranked.forEach(w => w.calculatedRank = '-');

    const finalWeeds = [...ranked, ...unranked];

    log("\n### 2. Preliminary Weed List (Ranked & With Control Scores)");
    log("| Rank | Weed Name | Gut Feel (Avg) | Extent (Rounded) | Habitat Value (Rounded) | Control Score (1-4) |");
    log("| :--- | :--- | :--- | :--- | :--- | :--- |");

    csvContent += "### 2. Preliminary Weed List\n";
    csvContent += "Rank,Common Name,Scientific Name,Gut Feel (Avg),Extent (Rounded),Habitat Value (Rounded),Control Score (1-4)\n";

    finalWeeds.forEach(w => {
        let sciNameClean = w.sciName ? w.sciName.trim().toLowerCase() : "";
        if (aliases[sciNameClean]) sciNameClean = aliases[sciNameClean];
        const controlScore = controlScores[sciNameClean] || "Not Found";
        log(`| ${w.calculatedRank} | **${w.name}** | ${w.rawGutFeel} | ${w.extent} | ${w.habitat} | ${controlScore} |`);

        csvContent += `${w.calculatedRank},"${w.common || ''}","${w.sciName || ''}",${w.rawGutFeel},${w.extent},${w.habitat},${controlScore}\n`;
    });

    // Write CSV file
    const csvPath = `../${safeGroupName}.csv`;
    fs.writeFileSync(csvPath, csvContent);
    console.log(`Saved CSV to: ${csvPath}`);
};

// Main Execution
const controlScores = getControlScores();
const filesToProcess = [
    'Weed prioritization worksheet_Jallukar 2024.xlsx',
    'Weed prioritization worksheet_CrowlandsWarrak.xlsx',
    'Weed prioritization worksheet_Elmhurst 2024_CURRENT.xlsx',
    'Weed prioritization worksheet_Stawell 2024_CURRENT.xlsx',
    'Weed prioritization worksheet_FINAL for sharing_protected - Laharum 110225.xlsx'
];

filesToProcess.forEach(f => {
    if (fs.existsSync(`../${f}`)) {
        processFile(f, controlScores);
    } else {
        log(`\n!!! File not found: ${f}`);
    }
});
