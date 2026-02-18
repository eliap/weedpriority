
import xlsx from 'xlsx';
import path from 'path';

// File is in the parent directory
const filePath = "c:/Users/eliap/OneDrive/Desktop/Antigravity/Weed priority/weeds to scrape.xlsx";

const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get JSON data
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Header: 1 returns arrays of arrays

console.log("Sheet Name:", sheetName);
console.log("First 5 rows:");
console.log(data.slice(0, 5));
