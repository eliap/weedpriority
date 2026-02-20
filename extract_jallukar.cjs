const XLSX = require('xlsx');
const wb = XLSX.readFile('../Weed prioritization worksheet_Jallukar 2024.xlsx');

const extractValues = () => {
    const sheet = wb.Sheets['FILL IN Group consensus values'];
    if (!sheet) return [];

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });
    const yesValues = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        let question = row[0];
        let answer = row[4];

        if (question && typeof question === 'string' && (answer === 'Y' || answer === 'N')) {
            if (answer === 'Y') {
                yesValues.push(question);
            }
        }
    }
    return yesValues;
};

const extractWeeds = () => {
    const sheet = wb.Sheets['FILL IN Prelim list'];
    if (!sheet) return [];

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });
    const weeds = [];

    for (let i = 7; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[1]) continue;

        const sciName = row[1];
        const commonName = row[2];
        let gutFeelAvg = row[4];
        const extentAvg = row[7];
        const habitatAvg = row[10];

        if (sciName === 'Scientific name') continue;

        weeds.push({
            name: `${commonName} (${sciName})`,
            sciName: sciName, // Store raw scientific name
            gutFeel: gutFeelAvg,
            rawGutFeel: gutFeelAvg,
            extent: extentAvg !== undefined && extentAvg !== 'not ranked' ? Math.round(parseFloat(extentAvg)) : extentAvg,
            habitat: habitatAvg !== undefined && habitatAvg !== 'not ranked' ? Math.round(parseFloat(habitatAvg)) : habitatAvg
        });
    }
    return weeds;
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
        if (row[2]) score = 1;      // Low
        else if (row[3]) score = 2; // Medium
        else if (row[4]) score = 3; // High
        else if (row[5]) score = 4; // Very High

        if (score) {
            scores[sciName.trim().toLowerCase()] = score;
        }
    });
    return scores;
};

console.log("=== Jallukar Landcare Values (Ticked YES) ===");
const values = extractValues();
values.forEach(v => console.log(`- [x] ${v}`));

const weeds = extractWeeds();
const controlScores = getControlScores();

// Manual aliases for known mismatches
const aliases = {
    "gazania rigens + splendens": "gazania spp.",
    "gazania linearis": "gazania spp.",
    "moraea flaccida": "moraea flaccida"
};

// Split ranked and unranked
const rankedWeeds = weeds.filter(w => !isNaN(parseFloat(w.gutFeel)));
const unrankedWeeds = weeds.filter(w => isNaN(parseFloat(w.gutFeel)));

// Sort ranked based on gutFeel ascending (1 is worst/start)
rankedWeeds.sort((a, b) => parseFloat(a.gutFeel) - parseFloat(b.gutFeel));

// Assign ranks
rankedWeeds.forEach((w, index) => {
    w.calculatedRank = index + 1;
});

// Calculate rank for unranked (--)
unrankedWeeds.forEach(w => {
    w.calculatedRank = '-';
});

const finalWeeds = [...rankedWeeds, ...unrankedWeeds];

console.log("\n=== Preliminary Weed List (with Calculated Rank & Control Score) ===");
console.log("Name | Calculated Rank | Gut Feel Avg | Extent Avg | Habitat Avg | Control Score");
console.log("--- | --- | --- | --- | --- | ---");

finalWeeds.forEach(w => {
    // Use stored scientific name
    let sciNameClean = w.sciName ? w.sciName.trim().toLowerCase() : "";

    // Check aliases
    if (aliases[sciNameClean]) {
        sciNameClean = aliases[sciNameClean];
    }

    let controlScore = controlScores[sciNameClean] || "Not Found";

    // Debug if not found
    if (controlScore === "Not Found") {
        // Silencing debug for final output unless needed
        // process.stdout.write(`DEBUG: '${sciNameClean}' not found.\n`);
    }

    console.log(`${w.name} | ${w.calculatedRank} | ${w.rawGutFeel} | ${w.extent} | ${w.habitat} | ${controlScore}`);
});
