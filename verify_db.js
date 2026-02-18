
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('weeds.db');

db.serialize(() => {
    db.get("SELECT count(*) as count FROM weeds", (err, row) => {
        if (err) console.error(err);
        else console.log(`Weeds count: ${row.count}`);
    });

    db.get("SELECT count(*) as count FROM assessments", (err, row) => {
        if (err) console.error(err);
        else console.log(`Assessments count: ${row.count}`);
    });

    db.all("SELECT DISTINCT common_name FROM weeds WHERE id IN (SELECT weed_id FROM assessments)", (err, rows) => {
        if (err) console.error(err);
        else console.log("Completed Weeds:", rows.map(r => r.common_name));
    });
});

db.close();
