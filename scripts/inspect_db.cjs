const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../weeds.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the weeds database.');
});

db.serialize(() => {
    // 1. List Tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            throw err;
        }
        console.log('Tables:', tables);

        // 2. Inspect each table
        tables.forEach((table) => {
            const tableName = table.name;
            console.log(`\n--- Schema for table: ${tableName} ---`);

            db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
                if (err) console.error(err);
                console.log(columns.map(c => `${c.name} (${c.type})`).join(', '));
            });

            console.log(`\n--- First 3 rows for table: ${tableName} ---`);
            db.all(`SELECT * FROM ${tableName} LIMIT 3`, [], (err, rows) => {
                if (err) console.error(err);
                console.log(JSON.stringify(rows, null, 2));
            });
        });
    });
});

// Close database connection after a short delay to ensure async ops finish
setTimeout(() => {
    db.close();
}, 2000);
