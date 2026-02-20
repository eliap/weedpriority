const XLSX = require('xlsx');
const wb = XLSX.readFile('../Weed prioritization worksheet_Jallukar 2024.xlsx');

const inspectSheet = (sheetName) => {
    console.log(`\n--- Inspecting contents of: ${sheetName} ---`);
    if (!wb.Sheets[sheetName]) {
        console.log(`Sheet "${sheetName}" not found!`);
        return;
    }
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });

    // Print first 10 rows to see headers
    data.slice(0, 10).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
};

inspectSheet('FILL IN Group consensus values');
inspectSheet('FILL IN Prelim list');
