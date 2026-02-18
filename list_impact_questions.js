
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('weeds.db');

db.all("SELECT DISTINCT question FROM assessments WHERE type = 'impact'", (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Impact Questions:");
        rows.forEach(r => console.log(`- ${r.question}`));
    }
});

db.close();
