const XLSX = require('xlsx');

// Read the workbook
const wb = XLSX.readFile('../Weed prioritization worksheet_Jallukar 2024.xlsx');

const sheets = {};
// Define sheets we are interested in based on user prompt
const targetSheets = [
    'FILL IN Group consensus values',
    'EXTENT AND HABITAT SCORE KEY'
];

wb.SheetNames.forEach(sheetName => {
    if (targetSheets.includes(sheetName)) {
        const ws = wb.Sheets[sheetName];
        // Convert to JSON (array of arrays for structure)
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        sheets[sheetName] = jsonData; // Get ALL rows
    }
});

console.log(JSON.stringify(sheets, null, 2));
