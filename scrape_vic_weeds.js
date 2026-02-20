import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILES_PATH = path.resolve(__dirname, 'src/data/weeds_victoria.json');

const LISTING_URL = 'https://weeds.org.au/weeds-profiles/?region=vic';
const BASE_PROFILE_URL = 'https://weeds.org.au/profiles/';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
}

// Extract text content from a section following a specific header
function getSectionText(doc, headerText) {
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5'));
    const header = headings.find(h => h.textContent.toLowerCase().includes(headerText.toLowerCase()));
    if (!header) return '';

    let content = [];
    let next = header.nextElementSibling;
    // Stop at next header of same level or higher (e.g. H2 stops at H2 or H1)
    const headerLevel = parseInt(header.tagName.substring(1));

    while (next) {
        if (['H1', 'H2', 'H3', 'H4', 'H5'].includes(next.tagName)) {
            const nextLevel = parseInt(next.tagName.substring(1));
            if (nextLevel <= headerLevel) break;
            // Also stop if it's a known major section even if nested? 
            // For now, standard structure seems to be H2/H3 for main sections.
        }

        // Skip empty elements or "back to top" links
        const text = next.textContent.trim();
        if (text && !text.toLowerCase().includes('back to top')) {
            content.push(text);
        }
        next = next.nextElementSibling;
    }
    return content.join('\n\n').trim();
}

function getQuickFacts(doc) {
    const headings = doc.querySelectorAll('h2, h3, h4, h5');
    let quickFactsSection = null;
    for (const h of headings) {
        if (h.textContent.trim().toLowerCase().includes('quick facts')) {
            quickFactsSection = h;
            break;
        }
    }

    if (quickFactsSection) {
        let next = quickFactsSection.nextElementSibling;
        for (let i = 0; i < 5 && next; i++) {
            if (next.tagName === 'UL') {
                return Array.from(next.querySelectorAll('li')).map(li => li.textContent.trim());
            }
            const nestedUl = next.querySelector('ul');
            if (nestedUl) {
                return Array.from(nestedUl.querySelectorAll('li')).map(li => li.textContent.trim());
            }
            if (['H1', 'H2', 'H3', 'H4'].includes(next.tagName)) break;
            next = next.nextElementSibling;
        }
    }
    return [];
}

function getImages(doc) {
    const images = Array.from(doc.querySelectorAll('.gallery-item img, .wp-block-image img, figure img, .entry-content img'))
        .map(img => img.src)
        .filter(src => !src.includes('nav_') && !src.includes('logo') && !src.includes('icon') && !src.includes('weeds-logo'));
    return [...new Set(images)];
}

async function scrapeProfile(slug) {
    const url = `${BASE_PROFILE_URL}${slug}/`;
    console.log(`Scraping ${slug}...`);
    try {
        const res = await axios.get(url, { headers, timeout: 15000 });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        const profile = {
            id: slug,
            url: url,
            name: cleanText(doc.querySelector('h1')?.textContent),
            scientificName: cleanText(doc.querySelector('.scientific-name')?.textContent || doc.querySelector('i')?.textContent),

            // Core Fields
            quickFacts: getQuickFacts(doc),
            description: getSectionText(doc, 'description') || getSectionText(doc, 'about'),
            leaves: getSectionText(doc, 'leaves'),
            flowers: getSectionText(doc, 'flowers'),
            fruit: getSectionText(doc, 'fruit') || getSectionText(doc, 'seeds'),
            reproduction: getSectionText(doc, 'reproduction'),

            // Distribution & Habitat
            habitat: getSectionText(doc, 'habitat') || getSectionText(doc, 'where does it grow'),
            distribution: getSectionText(doc, 'distribution'),

            // Impact & Control
            impact: getSectionText(doc, 'impact') || getSectionText(doc, 'environmental impact'),
            // Prioritize specific management headers
            controlMethods: getSectionText(doc, 'Best practice management')
                || getSectionText(doc, 'Control methods')
                || getSectionText(doc, 'management'),

            // Meta
            origin: getSectionText(doc, 'origin') || getSectionText(doc, 'where does it originate'),
            growthForm: getSectionText(doc, 'growth form'),
            similarSpecies: getSectionText(doc, 'similar species') || getSectionText(doc, 'look-alikes'),

            // Images
            images: getImages(doc)
        };

        return profile;

    } catch (e) {
        console.error(`  Error scraping ${slug}: ${e.message}`);
        if (e.response && e.response.status === 404) return { id: slug, error: '404 Not Found' };
        return null;
    }
}

async function main() {
    console.log('Starting Victorian Weeds Scraper (v2)...');

    // 1. Get the list of slugs
    console.log(`Fetching listing from ${LISTING_URL} to get slugs...`);
    let slugs = [];
    try {
        const res = await axios.get(LISTING_URL, { headers, timeout: 30000 });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        const listItems = Array.from(doc.querySelectorAll('li[data-title]'));
        slugs = [...new Set(listItems.map(li => li.getAttribute('data-title')))];
        console.log(`Found ${slugs.length} unique slugs.`);
    } catch (e) {
        console.error('Failed to fetch listing page extract slugs:', e.message);
        // Fallback or exit
        process.exit(1);
    }

    if (slugs.length === 0) {
        console.error("No slugs found!");
        process.exit(1);
    }

    // 2. Start fresh by backing up old file if exists
    // We want a full fresh scrape as per user request
    let weedsData = {};
    if (fs.existsSync(PROFILES_PATH)) {
        const backupPath = PROFILES_PATH.replace('.json', '_backup.json');
        console.log(`Backing up existing data to ${backupPath}`);
        fs.copyFileSync(PROFILES_PATH, backupPath);
        // weedsData = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')); // Don't load existing, allow overwrite/refresh
    }

    // 3. Scrape loop
    let count = 0;
    for (const slug of slugs) {
        if (weedsData[slug] && !weedsData[slug].error && weedsData[slug].controlMethods && weedsData[slug].controlMethods !== "NO") {
            // If we were resuming, we would check validity here. 
            // But let's just re-do all to be safe for now, or just check if it exists in backup?
            // Given 400 items, let's just do it. It takes ~5-10 mins.
        }

        const data = await scrapeProfile(slug);
        if (data) {
            weedsData[slug] = data;
            count++;

            if (count % 5 === 0) {
                fs.writeFileSync(PROFILES_PATH, JSON.stringify(weedsData, null, 2));
                console.log(`  Saved batch. Total: ${Object.keys(weedsData).length}`);
            }
            // Be nice
            await delay(500 + Math.random() * 500);
        }
    }

    fs.writeFileSync(PROFILES_PATH, JSON.stringify(weedsData, null, 2));
    console.log('Done! Saved to', PROFILES_PATH);
}

main();
