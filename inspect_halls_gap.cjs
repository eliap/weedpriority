const XLSX = require('xlsx');
const filename = 'Weed prioritization worksheet_HallsGap.xlsx';
console.log(`Inspecting ${filename}...`);
const wb = XLSX.readFile(`./${filename}`);

console.log("Sheet Names:", wb.SheetNames);

// User mentioned 'prioritised weed list' tab
const sheetName = 'Set your values';

if (!sheetName) {
    console.log("Could not find a sheet matching 'prioritised weed list'.");
} else {
    console.log(`Inspecting sheet: ${sheetName}`);
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });

    // Print first 20 rows to find headers
    data.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
}
