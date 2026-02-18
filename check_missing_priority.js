
import sqlite3 from 'sqlite3';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_PATH = path.resolve(__dirname, '../weeds to scrape.xlsx');
const DB_PATH = 'weeds.db';

const db = new sqlite3.Database(DB_PATH);

function getPriorityWeeds() {
    try {
        if (!fs.existsSync(EXCEL_PATH)) {
            console.log("Priority Excel file not found at " + EXCEL_PATH);
            return [];
        }
        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        return data.map(row => row[0]).filter(n => n && typeof n === 'string').map(n => n.trim());
    } catch (e) {
        console.error("Error reading priority Excel:", e);
        return [];
    }
}

function getScrapedWeeds() {
    return new Promise((resolve, reject) => {
        db.all("SELECT DISTINCT w.common_name FROM weeds w JOIN assessments a ON w.id = a.weed_id", (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.common_name));
        });
    });
}

async function main() {
    const priorityList = getPriorityWeeds();
    const scrapedList = await getScrapedWeeds();

    console.log(`Total Priority Weeds: ${priorityList.length}`);
    console.log(`Total Scraped Weeds: ${scrapedList.length}`);

    const missing = priorityList.filter(p => {
        // Fuzzy check: is this priority weed name inside any scraped weed name?
        // or is any scraped weed name inside this priority weed name?
        const pLower = p.toLowerCase();
        return !scrapedList.some(s => {
            const sLower = s.toLowerCase();
            return sLower.includes(pLower) || pLower.includes(sLower);
        });
    });

    console.log(`\n--- Missing Priority Weeds (${missing.length}) ---`);
    console.log(missing.join('\n'));

    // Also list matching ones to be sure
    const found = priorityList.length - missing.length;
    console.log(`\n(Found ${found} already scraped)`);
}

main();
