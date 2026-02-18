
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'weeds.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.get("SELECT COUNT(*) as count FROM weeds", (err, row) => {
        if (err) console.error(err);
        else console.log(`Total Weeds in DB: ${row.count}`);
    });

    db.get("SELECT COUNT(*) as count FROM assessments", (err, row) => {
        if (err) console.error(err);
        else console.log(`Total Assessments in DB: ${row.count}`);
    });

    db.get("SELECT COUNT(DISTINCT weed_id) as count FROM assessments", (err, row) => {
        if (err) console.error(err);
        else console.log(`Weeds with at least one assessment: ${row.count}`);
    });
});

db.close();
