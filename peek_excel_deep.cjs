const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'all group app inputs.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'halls gap'; // Focus on one sheet
    console.log(`\n--- First 50 rows of sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Print rows with content, skip empty ones if any, but show enough to see if there's data at the bottom
    console.log(jsonData.slice(0, 50));

} catch (error) {
    console.error("Error reading file:", error.message);
}
