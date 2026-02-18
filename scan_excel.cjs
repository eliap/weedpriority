const XLSX = require('xlsx');

const wb = XLSX.readFile('../Weed prioritization worksheet_Jallukar 2024.xlsx');

const targetSheets = [
    'FILL IN group consensus values',
    'EXTENT AND HABITAT SCORE KEY'
];

targetSheets.forEach(sheetName => {
    console.log(`\n--- SHEET: ${sheetName} ---`);
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Log first 20 rows verbatim
    console.log("First 20 rows:");
    console.log(JSON.stringify(data.slice(0, 20), null, 2));

    // Find any other non-empty strings in the rest
    console.log("\nOther text found:");
    data.slice(20).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell && typeof cell === 'string' && cell.trim() !== '' && cell !== 'not ranked') {
                console.log(`Row ${rowIndex + 21}, Col ${colIndex}: ${cell}`);
            }
        });
    });
});
