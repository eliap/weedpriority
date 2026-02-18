import * as XLSX from 'xlsx';
const { readFile, utils } = XLSX;

// Read the workbook
const wb = readFile('../Weed prioritization worksheet_FINAL for sharing_protected.xlsx');

const sheets = {};
// Define sheets we are interested in based on user prompt
const targetSheets = [
    'FILL IN group consensus values',
    'FILL IN Prelim list',
    'EXTENT AND HABITAT SCORE KEY'
];

wb.SheetNames.forEach(sheetName => {
    if (targetSheets.includes(sheetName)) {
        const ws = wb.Sheets[sheetName];
        // Convert to JSON (array of arrays for structure)
        const jsonData = utils.sheet_to_json(ws, { header: 1 });
        sheets[sheetName] = jsonData.slice(0, 15); // Get first 15 rows to understand structure
    }
});

console.log(JSON.stringify(sheets, null, 2));
