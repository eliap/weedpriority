const XLSX = require('xlsx');
const wb = XLSX.readFile('../Difficulty of control table_Project Platypus scores.xlsx');

console.log("All Sheet Names:", wb.SheetNames);

if (wb.SheetNames.length > 0) {
    const sheetName = wb.SheetNames[0];
    console.log(`\n--- Inspecting contents of: ${sheetName} ---`);
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false, blankrows: false });

    data.forEach((row, i) => {
        if (row.length > 0 && row[0] && i > 0) {
            console.log(row[0]);
        }
    });
}
