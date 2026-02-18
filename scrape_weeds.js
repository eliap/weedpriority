
import sqlite3 from 'sqlite3';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import fs from 'fs';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_PATH = path.resolve(__dirname, '../weeds to scrape.xlsx');

const DB_PATH = 'weeds.db';
const BASE_URL = 'https://web.archive.org/web/20250524230056/https://vro.agriculture.vic.gov.au/DPI/Vro/vrosite.nsf/pages/lwm_invasive-plants_common-name';
const ORIGIN = 'https://web.archive.org';

// Initialize Database
const db = new sqlite3.Database(DB_PATH);

function initDB() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS weeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                common_name TEXT,
                url TEXT UNIQUE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                weed_id INTEGER,
                type TEXT,
                question TEXT,
                comments TEXT,
                rating TEXT,
                confidence TEXT,
                FOREIGN KEY(weed_id) REFERENCES weeds(id)
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function insertWeed(name, url) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR IGNORE INTO weeds (common_name, url) VALUES (?, ?)`, [name, url], function (err) {
            if (err) reject(err);
            else {
                // If it was ignored, we need to get the ID.
                if (this.changes === 0) {
                    db.get(`SELECT id FROM weeds WHERE url = ?`, [url], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.id);
                    });
                } else {
                    resolve(this.lastID);
                }
            }
        });
    });
}

function insertAssessment(weedId, type, question, comments, rating, confidence) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO assessments (weed_id, type, question, comments, rating, confidence) VALUES (?, ?, ?, ?, ?, ?)`,
            [weedId, type, question, comments, rating, confidence], (err) => {
                if (err) reject(err);
                else resolve();
            });
    });
}

const MAX_RETRIES = 3;

async function fetchPage(url, retryCount = 0) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            timeout: 60000 // 60 second timeout
        });
        return response.data;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(3, retryCount) * 5000; // 5s, 15s, 45s
            console.log(`  Retry ${retryCount + 1}/${MAX_RETRIES} for ${url} (waiting ${delay / 1000}s)`);
            await new Promise(r => setTimeout(r, delay));
            return fetchPage(url, retryCount + 1);
        }
        console.error(`  Failed after ${MAX_RETRIES} retries: ${url}: ${error.message}`);
        return null;
    }
}

function getPriorityWeeds() {
    try {
        if (!fs.existsSync(EXCEL_PATH)) {
            console.log("Priority Excel file not found at " + EXCEL_PATH);
            return [];
        }
        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        // Assume column 0 is common name. Filter out empty or non-string values.
        const names = data.map(row => row[0]).filter(n => n && typeof n === 'string').map(n => n.trim().toLowerCase());
        console.log(`Loaded ${names.length} priority weeds from Excel.`);
        return names;
    } catch (e) {
        console.error("Error reading priority Excel:", e);
        return [];
    }
}

async function parseMainPage() {
    console.log(`Fetching main page: ${BASE_URL}`);
    const html = await fetchPage(BASE_URL);
    if (!html) return [];

    const dom = new JSDOM(html, { url: BASE_URL });
    const document = dom.window.document;
    const links = document.querySelectorAll('a');
    const weeds = [];

    links.forEach((link, index) => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();

        if (href && (href.toLowerCase().includes('weed') || text.toLowerCase().includes('weed')) && !text.includes('Page top')) {
            let fullUrl;
            try {
                fullUrl = new URL(href, BASE_URL).href;
            } catch (e) {
                console.log(`Error resolving URL: ${href}`);
                return;
            }

            // Check if it's a valid weed link (contains 'weeds' and belongs to the domain/path we expect)
            if (!fullUrl.includes('vro.agriculture.vic.gov.au')) return;

            // console.log(`Found weed: ${text} -> ${fullUrl}`);
            weeds.push({ name: text, url: fullUrl });
        }
    });

    // Remove duplicates based on URL
    const uniqueWeeds = [];
    const seenUrls = new Set();
    for (const weed of weeds) {
        if (!seenUrls.has(weed.url)) {
            seenUrls.add(weed.url);
            uniqueWeeds.push(weed);
        }
    }

    // Prioritize weeds
    const priorityWeeds = getPriorityWeeds();
    if (priorityWeeds.length > 0) {
        console.log("Sorting weeds to prioritize matches...");
        uniqueWeeds.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            // Fuzzy match: check if the priority name is part of the weed name or vice versa
            const aIsPriority = priorityWeeds.some(p => aName.includes(p) || p.includes(aName));
            const bIsPriority = priorityWeeds.some(p => bName.includes(p) || p.includes(bName));

            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;
            return 0;
        });

        const count = uniqueWeeds.filter(w => priorityWeeds.some(p => w.name.toLowerCase().includes(p) || p.includes(w.name.toLowerCase()))).length;
        console.log(`Found ${count} priority weeds matching in the list. They will be scraped first.`);
    }

    console.log(`Found ${uniqueWeeds.length} potential weed links.`);
    return uniqueWeeds;
}

async function processWeedPage(weed) {
    console.log(`Processing weed: ${weed.name}`);
    const weedId = await insertWeed(weed.name, weed.url);

    // Check if we already have assessments for this weed
    const hasAssessments = await new Promise((resolve, reject) => {
        db.get(`SELECT 1 FROM assessments WHERE weed_id = ? LIMIT 1`, [weedId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });

    if (hasAssessments) {
        console.log(`  Skipping ${weed.name} (already scraped)`);
        return;
    }

    const html = await fetchPage(weed.url);
    if (!html) return;

    const dom = new JSDOM(html, { url: weed.url });
    const doc = dom.window.document;

    // Find links to Invasiveness and Impact assessments
    const links = doc.querySelectorAll('a');
    let invasivenessUrl = null;
    let impactUrl = null;

    links.forEach(link => {
        const href = link.href;
        const text = link.textContent.trim().toLowerCase();

        // Debug
        // console.log(`    Checking link: ${text} -> ${href}`);

        if (text.includes('invasive assessment') || text.includes('invasiveness assessment')) {
            invasivenessUrl = href;
        }
        if (text.includes('impact assessment')) {
            impactUrl = href;
        }
    });

    // Fallback: sometime the links are just "Invasiveness Assessment" text in a list
    if (!invasivenessUrl || !impactUrl) {
        // Try to find by partial href if text match failed (url structure usually contains 'invasive' or 'impact')
        links.forEach(link => {
            const href = link.href;
            if (!invasivenessUrl && href.includes('invasive_')) invasivenessUrl = href;
            if (!impactUrl && href.includes('impact_')) impactUrl = href;
        });
    }

    if (invasivenessUrl) {
        await processAssessmentPage(weedId, 'invasiveness', invasivenessUrl);
    } else {
        console.log(`  No Invasiveness Assessment found for ${weed.name}`);
    }

    if (impactUrl) {
        await processAssessmentPage(weedId, 'impact', impactUrl);
    } else {
        console.log(`  No Impact Assessment found for ${weed.name}`);
    }
}

async function processAssessmentPage(weedId, type, url) {
    console.log(`  Fetching ${type} assessment: ${url}`);
    const html = await fetchPage(url);
    if (!html) return;

    const dom = new JSDOM(html, { url: url });
    const doc = dom.window.document;

    // Look for any table containing "Rating" in its text (flexible detection)
    const tables = doc.querySelectorAll('table');
    let targetTable = null;

    tables.forEach(table => {
        const firstRow = table.querySelector('tr');
        if (firstRow && firstRow.textContent.includes('Rating')) {
            targetTable = table;
        }
    });

    if (!targetTable) {
        console.log(`    Could not find assessment table for ${type}`);
        return;
    }

    const rows = targetTable.querySelectorAll('tr');
    console.log(`    Found table with ${rows.length} rows`);

    // Dynamically detect column positions from the header row
    const headerRow = rows[0];
    const headerCells = headerRow.querySelectorAll('td');
    const colMap = {};
    for (let c = 0; c < headerCells.length; c++) {
        const headerText = headerCells[c].textContent.trim().toLowerCase();
        if (headerText === 'question') colMap.question = c;
        else if (headerText === 'comments') colMap.comments = c;
        else if (headerText === 'rating') colMap.rating = c;
        else if (headerText === 'confidence') colMap.confidence = c;
        else if (headerText === 'reference') colMap.reference = c;
    }

    if (colMap.rating === undefined) {
        console.log(`    Could not identify 'Rating' column in header for ${type}`);
        return;
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');

        if (cells.length === 1) {
            // Category header row (e.g. "Establishment", "Dispersal")
            continue;
        }

        if (cells.length >= 3) {
            const question = colMap.question !== undefined ? cells[colMap.question]?.textContent.trim() : '';
            const comments = colMap.comments !== undefined ? cells[colMap.comments]?.textContent.trim() : '';
            const rating = colMap.rating !== undefined ? cells[colMap.rating]?.textContent.trim() : '';
            const confidence = colMap.confidence !== undefined ? cells[colMap.confidence]?.textContent.trim() : '';

            if (question && rating) {
                await insertAssessment(weedId, type, question, comments, rating, confidence);
            }
        }
    }
    console.log(`    Saved ${type} assessment data.`);
}

async function main() {
    await initDB();

    while (true) {
        try {
            console.log("Starting scraper loop...");
            const weeds = await parseMainPage();

            // Shuffle weeds slightly to avoid hammering same ones if constantly restarting? No, priority sort handles order.
            // Just process normally.

            if (!weeds || weeds.length === 0) {
                console.log("No weeds found? Waiting 60s...");
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }

            for (const weed of weeds) {
                try {
                    await processWeedPage(weed);
                } catch (innerErr) {
                    console.error(`Error processing ${weed.name}:`, innerErr);
                    // Continue to next weed
                }
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 5000));
            }

            console.log("Finished all weeds. Waiting 1 hour before checking again...");
            await new Promise(r => setTimeout(r, 3600000));

        } catch (err) {
            console.error("Main loop error:", err);
            console.log("Restarting main loop in 60s...");
            await new Promise(r => setTimeout(r, 60000));
        }
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    // Even if main crashes, try to restart it? No, process exits.
    // The internal loop catches most things.
});
