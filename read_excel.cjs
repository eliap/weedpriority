const XLSX = require('xlsx');
const wb = XLSX.readFile('../Weed prioritization worksheet_FINAL for sharing_unprotected.xlsx');

const sheets = {};
const targetSheets = [
    'EXTENT AND HABITAT SCORE KEY'
];

wb.SheetNames.forEach(sheetName => {
    if (targetSheets.includes(sheetName)) {
        const ws = wb.Sheets[sheetName];
        console.log(`Sheet: ${sheetName}`);
        console.log(ws['!ref']); // Log the range
        // Get first few cells to see what's there
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
            const row = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (ws[cell_ref]) row.push(ws[cell_ref].v);
            }
            console.log(row);
        }
    }
});

console.log(JSON.stringify(sheets, null, 2));
