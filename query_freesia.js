
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('weeds.db');

db.all("SELECT * FROM assessments WHERE weed_id = (SELECT id FROM weeds WHERE common_name LIKE '%Freesia%')", (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
});

db.close();
