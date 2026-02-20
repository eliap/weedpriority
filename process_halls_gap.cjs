const XLSX = require('xlsx');
const fs = require('fs');

const filename = 'Weed prioritization worksheet_HallsGap.xlsx';
const controlFile = '../Difficulty of control table_Project Platypus scores.xlsx';

const getControlScores = () => {
    const wbControl = XLSX.readFile(controlFile);
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
    "moraea flaccida": "moraea flaccida",
    "freesia alba x freesia leich...": "freesia alba x freesia leich"
};

const processHallsGap = () => {
    console.log(`Processing ${filename}...`);
    const wb = XLSX.readFile(`./${filename}`);
    const controlScores = getControlScores();

    let csvContent = `Group Name,Halls Gap Landcare Group\n\n`;

    // --- Extract Values ---
    console.log("\n### 1. Values (Ticked YES)");
    csvContent += "### 1. Values (Ticked YES)\nValue Category\n";

    const valSheet = wb.Sheets['Set your values'];
    if (valSheet) {
        const data = XLSX.utils.sheet_to_json(valSheet, { header: 1, range: 0, raw: false, blankrows: false });
        data.forEach(row => {
            // Row 0 is Question, Row 1 is Answer (Y/N)
            if (row && row[0] && typeof row[0] === 'string' && row[1] === 'Y') {
                console.log(`- [x] ${row[0]}`);
                csvContent += `"${row[0]}"\n`;
            }
        });
    } else {
        console.log("Sheet 'Set your values' not found.");
    }

    csvContent += "\n";

    // --- Extract Weeds ---
    const sheetName = 'Prioritised weed list';
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
        console.error(`Sheet '${sheetName}' not found.`);
        return;
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, raw: false, blankrows: false });
    // Data starts at row 4 (0-indexed in code inspection was row 4 for data)
    // Inspection showed:
    // Row 2: Headers (Sci Name, Common Name...)
    // Row 4: First data row "Acacia baileyana"

    const weeds = [];

    data.forEach(row => {
        const sciName = row[0];
        const commonName = row[1];
        const gutFeel = row[5];
        const extentScore = row[9]; // Column 9 based on inspection (J=9)
        const habitatScore = row[14]; // Column 14 (O=14)

        if (!sciName || sciName === 'Scientific name' || sciName === 'Prioritised Weed List') return;

        // Clean text values
        let gutFeelVal = gutFeel;
        if (typeof gutFeel === 'string' && (gutFeel.includes('DIV/0') || gutFeel.trim() === '')) {
            gutFeelVal = "not ranked";
        }

        // Division with validation
        let extentVal = extentScore;
        if (extentScore !== undefined && extentScore !== null) {
            extentVal = parseFloat(extentScore) / 25;
            if (isNaN(extentVal)) extentVal = extentScore; // Keep original if NaN
        }

        let habitatVal = habitatScore;
        if (habitatScore !== undefined && habitatScore !== null) {
            habitatVal = parseFloat(habitatScore) / 50;
            if (isNaN(habitatVal)) habitatVal = habitatScore;
        }

        weeds.push({
            name: `${commonName} (${sciName})`,
            common: commonName,
            sciName: sciName,
            gutFeel: gutFeelVal,
            rawGutFeel: gutFeelVal,
            extent: extentVal,
            habitat: habitatVal
        });
    });

    // Sort by Gut Feel (Ascending)
    const ranked = weeds.filter(w => !isNaN(parseFloat(w.gutFeel)));
    const unranked = weeds.filter(w => isNaN(parseFloat(w.gutFeel)));

    ranked.sort((a, b) => parseFloat(a.gutFeel) - parseFloat(b.gutFeel));
    ranked.forEach((w, i) => w.calculatedRank = i + 1);
    unranked.forEach(w => w.calculatedRank = '-');

    const finalWeeds = [...ranked, ...unranked];

    csvContent += "### 2. Preliminary Weed List\n";
    csvContent += "Rank,Common Name,Scientific Name,Gut Feel Rank,Extent Score (Grahams ATM),Habitat Score (Grahams ATM),Control Score (1-4)\n";

    console.log("\n### Halls Gap Weed List");
    console.log("| Rank | Weed Name | Gut Feel | Extent (ATM) | Habitat (ATM) | Control |");
    console.log("| :--- | :--- | :--- | :--- | :--- | :--- |");

    finalWeeds.forEach(w => {
        let sciNameClean = w.sciName ? w.sciName.trim().toLowerCase() : "";
        if (aliases[sciNameClean]) sciNameClean = aliases[sciNameClean];
        // Handle "Freesia alba x Freesia leich..."
        if (sciNameClean.includes('freesia alba x freesia leich')) sciNameClean = "freesia alba x freesia leich";

        const controlScore = controlScores[sciNameClean] || "Not Found";

        console.log(`| ${w.calculatedRank} | **${w.name}** | ${w.rawGutFeel} | ${w.extent} | ${w.habitat} | ${controlScore} |`);

        csvContent += `${w.calculatedRank},"${w.common}","${w.sciName}",${w.rawGutFeel},${w.extent},${w.habitat},${controlScore}\n`;
    });

    fs.writeFileSync('../Halls_Gap_Landcare_Group.csv', csvContent);
    console.log("\nSaved CSV to ../Halls_Gap_Landcare_Group.csv");
};

processHallsGap();
