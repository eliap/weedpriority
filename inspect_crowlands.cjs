const XLSX = require('xlsx');
const filename = 'Weed prioritization worksheet_CrowlandsWarrak.xlsx';
console.log(`Inspecting ${filename}...`);
const wb = XLSX.readFile(`../${filename}`);

const sheetName = 'FILL IN Prelim list';
const sheet = wb.Sheets[sheetName];

if (!sheet) {
    console.log(`Sheet '${sheetName}' not found.`);
    console.log('Available sheets:', wb.SheetNames);
} else {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });
    // Print first 20 rows to see headers and data alignment
    data.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
}
