const XLSX = require('xlsx');
const path = require('path');

const LOOKUP_FILE = 'scientific name lookup.xlsx';
const workbook = XLSX.readFile(path.resolve(__dirname, '..', LOOKUP_FILE));
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Read as array of arrays
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log("Total rows:", rows.length);
console.log("First 3 rows:", JSON.stringify(rows.slice(0, 3), null, 2));

// Find column indices
const headerRowIndex = rows.findIndex(row =>
    row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('common name'))
);

if (headerRowIndex === -1) {
    console.log("Could not find header row with 'Common Name'");
} else {
    console.log(`Header row found at index ${headerRowIndex}:`, rows[headerRowIndex]);
    const headerRow = rows[headerRowIndex];
    const commonIdx = headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('common name'));
    const sciIdx = headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('scientific name'));

    console.log(`Common Name Index: ${commonIdx}, Scientific Name Index: ${sciIdx}`);

    if (commonIdx !== -1) {
        // Search for Cape
        console.log("\nSearching for 'Cape':");
        rows.slice(headerRowIndex + 1).forEach(row => {
            const val = row[commonIdx];
            if (val && typeof val === 'string' && val.toLowerCase().includes('cape')) {
                console.log(`  Found: "${val}" -> "${row[sciIdx]}"`);
            }
        });
    }
}
