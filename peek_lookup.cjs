const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'scientific name lookup.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    console.log("Sheet Names:", workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- First 10 rows of sheet: ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(jsonData.slice(0, 10));
    });

} catch (error) {
    console.error("Error reading file:", error.message);
}
