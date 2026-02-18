const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../../validation inputs.xlsx');
console.log(`Reading file: ${filePath}`);

const workbook = XLSX.readFile(filePath);
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n\n--- SHEET: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    data.forEach((row, i) => {
        console.log(`Row ${i}: ${JSON.stringify(row)}`);
    });
});
