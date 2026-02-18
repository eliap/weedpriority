const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../../Weed prioritization worksheet_FINAL for sharing_unprotected.xlsx');
console.log(`Reading file: ${filePath}`);

const workbook = XLSX.readFile(filePath);
const targetSheets = [
    'Test max ratings'
];

targetSheets.forEach(sheetName => {
    console.log(`\n\n--- SHEET: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    data.slice(0, 50).forEach((row, i) => {
        console.log(`Row ${i}: ${JSON.stringify(row)}`);
    });
});
