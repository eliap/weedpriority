import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'all group app inputs.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    console.log("Sheet Names:", workbook.SheetNames);

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON to see structure
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`\n--- First 10 rows of sheet: ${firstSheetName} ---`);
    console.log(jsonData.slice(0, 10));

} catch (error) {
    console.error("Error reading file:", error.message);
}
