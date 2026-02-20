
import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEED_ASSESSMENTS_PATH = path.resolve(__dirname, 'src/data/weed_assessments.json');
const WEED_PROFILES_PATH = path.resolve(__dirname, 'src/data/weedProfiles.json');
const BASE_URL = 'https://weeds.org.au';

// Load data
const weedAssessments = JSON.parse(fs.readFileSync(WEED_ASSESSMENTS_PATH, 'utf-8'));
let weedProfiles = {};
if (fs.existsSync(WEED_PROFILES_PATH)) {
    weedProfiles = JSON.parse(fs.readFileSync(WEED_PROFILES_PATH, 'utf-8'));
}

// Helper delay
const delay = ms => new Promise(res => setTimeout(res, ms));

async function searchWeed(query) {
    try {
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        console.log(`Searching: ${searchUrl}`);
        const res = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        // Find results.
        const results = [];

        // Method 1: Article tags (blog style)
        const articles = doc.querySelectorAll('article');
        for (const article of articles) {
            const titleLink = article.querySelector('h2 a, h3 a');
            if (titleLink) {
                results.push({
                    title: titleLink.textContent.trim(),
                    link: titleLink.href,
                    snippet: article.textContent.trim()
                });
            }
        }

        // Method 2: .block-profiles (weed profiles style)
        const profileBlocks = doc.querySelectorAll('.block-profiles');
        for (const block of profileBlocks) {
            const titleLink = block.querySelector('.top-title a');
            const content = block.querySelector('.contents');
            if (titleLink) {
                results.push({
                    title: titleLink.textContent.trim(),
                    link: titleLink.href,
                    snippet: content ? content.textContent.trim() : ''
                });
            }
        }

        console.log(`  Found ${results.length} results. Checking for match with "${query}"...`);

        for (const res of results) {
            const { title, link, snippet } = res;
            // Check match in title OR snippet
            if (title.toLowerCase().includes(query.toLowerCase()) ||
                query.toLowerCase().includes(title.toLowerCase()) ||
                snippet.toLowerCase().includes(query.toLowerCase())) {
                console.log(`  Match found: ${title} (${link})`);
                return link;
            }
        }
        return null;
    } catch (e) {
        console.error(`Search error for ${query}:`, e.message);
        return null;
    }
}

async function scrapeProfile(url) {
    try {
        console.log(`  Scraping profile: ${url}`);
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        const profile = {
            profileUrl: url,
            quickFacts: [],
            flowerColour: '',
            growthForm: '',
            size: '',
            origin: '',
            controlMethods: '',
            bestControlSeason: ''
        };

        // Scientific Name
        const h1 = doc.querySelector('h1');
        if (h1) {
            profile.commonNames = h1.textContent.split(',').map(s => s.trim());
        }

        // Helper to get text following a header
        const getSectionText = (headerText) => {
            const h5s = Array.from(doc.querySelectorAll('h5'));
            const header = h5s.find(h => h.textContent.trim().toLowerCase().includes(headerText.toLowerCase()));
            if (!header) return '';

            let content = [];
            let next = header.nextElementSibling;
            while (next && !['H1', 'H2', 'H3', 'H4', 'H5'].includes(next.tagName)) {
                const text = next.textContent.trim();
                if (text) content.push(text);
                next = next.nextElementSibling;
            }
            return content.join('\n\n');
        };

        // Scientific Name (Robust check)
        const sciNameHeader = getSectionText('Main scientific name');
        if (sciNameHeader) {
            profile.scientificName = sciNameHeader.split('\n')[0].trim();
        } else {
            // Fallback: previous logic
            const italics = doc.querySelectorAll('em, i');
            for (let i = 0; i < Math.min(italics.length, 5); i++) {
                const text = italics[i].textContent.trim();
                if (text.split(' ').length >= 2) {
                    profile.scientificName = text;
                    break;
                }
            }
        }

        // Quick Facts
        const headings = doc.querySelectorAll('h2, h3, h4');
        let quickFactsSection = null;
        for (const h of headings) {
            if (h.textContent.trim().toLowerCase().includes('quick facts')) {
                quickFactsSection = h;
                break;
            }
        }

        if (quickFactsSection) {
            console.log(`  Found Quick Facts section: ${quickFactsSection.tagName}`);
            let next = quickFactsSection.nextElementSibling;
            // Iterate a bit to find the list
            for (let i = 0; i < 5 && next; i++) {
                console.log(`    Sibling ${i}: ${next.tagName}`);
                if (next.tagName === 'UL') {
                    profile.quickFacts = Array.from(next.querySelectorAll('li')).map(li => li.textContent.trim());
                    console.log(`    -> Found direct UL with ${profile.quickFacts.length} items`);
                    break;
                }
                // Check if UL is nested inside this element (e.g. DIV > DIV > UL)
                const nestedUl = next.querySelector('ul');
                if (nestedUl) {
                    profile.quickFacts = Array.from(nestedUl.querySelectorAll('li')).map(li => li.textContent.trim());
                    console.log(`    -> Found nested UL with ${profile.quickFacts.length} items`);
                    break;
                }

                if (['H1', 'H2', 'H3'].includes(next.tagName)) {
                    console.log(`    -> Hit stop tag: ${next.tagName}`);
                    break;
                }
                next = next.nextElementSibling;
            }
        } else {
            console.log("  No Quick Facts section found.");
        }

        profile.growthForm = getSectionText('Growth form');
        profile.flowerColour = getSectionText('Flower colour');
        profile.origin = getSectionText('Where does it originate?');
        profile.bestControlSeason = getSectionText('When does it grow'); // Lifecycle often gives clues

        // Control Methods - "Best practice management"
        const management = getSectionText('Best practice management');
        if (management) {
            profile.controlMethods = management;
        }

        // Clean up Origin if it extracted a full sentence
        if (profile.origin && profile.origin.length > 50) {
            // Try to extract just country if possible, or keep it short
            // For now, keep full text as it's informative
        }

        // Clean up Growth Form (remove extra text if needed)
        if (profile.growthForm) {
            // "Herb" -> "Herb"
            // "Shrub / Tree" -> "Shrub / Tree"
            // clean up newlines
            profile.growthForm = profile.growthForm.replace(/\n/g, ', ');
        }

        return profile;
    } catch (e) {
        console.error(`  Profile scrape error:`, e.message);
        return null;
    }
}

async function main() {
    let count = 0;
    const BATCH_SIZE = 300;

    // Target specific weeds for fix
    const weedsToScrape = ['Bridal creeper', 'Bridal Veil'];

    console.log(`Found ${weedsToScrape.length} weeds to process (forced subset).`);

    for (const name of weedsToScrape) {
        if (count >= BATCH_SIZE) break;

        console.log(`[${count + 1}/${Math.min(weedsToScrape.length, BATCH_SIZE)}] Processing ${name}...`);

        const existingProfile = weedProfiles[name];
        let profileUrl = existingProfile?.profileUrl;

        // 1. If we don't have a URL, try to find one
        if (!profileUrl) {
            // 1a. Try search by Scientific Name
            if (existingProfile && existingProfile.scientificName) {
                console.log(`  Trying scientific name: ${existingProfile.scientificName}`);
                profileUrl = await searchWeed(existingProfile.scientificName);
            }

            // 1b. Fallback to Common Name
            if (!profileUrl) {
                console.log(`  Trying common name: ${name}`);
                profileUrl = await searchWeed(name);
            }
        } else {
            console.log(`  Using existing URL: ${profileUrl}`);
        }

        if (profileUrl) {
            // 2. Scrape (even if we had data, we want to refresh it)
            const data = await scrapeProfile(profileUrl);
            if (data) {
                console.log(`  Extracted Quick Facts for ${name}: ${data.quickFacts ? data.quickFacts.length : 'MISSING'} items`);
                // Merge with existing data
                weedProfiles[name] = {
                    ...existingProfile,
                    ...data,
                    // Prefer scraped scientific name if found
                    scientificName: data.scientificName || existingProfile?.scientificName,
                    // Ensure URL is saved
                    profileUrl: profileUrl
                };

                console.log(`  Writing to file. Keys: ${Object.keys(weedProfiles).length}. Includes "${name}"? ${Object.keys(weedProfiles).includes(name)}`);
                fs.writeFileSync(WEED_PROFILES_PATH, JSON.stringify(weedProfiles, null, 2));
                console.log(`  Saved profile for ${name}`);
            }
        } else {
            console.log(`  No profile found for ${name}`);
            if (!existingProfile) {
                weedProfiles[name] = { skipped: true };
                fs.writeFileSync(WEED_PROFILES_PATH, JSON.stringify(weedProfiles, null, 2));
            }
        }

        await delay(2000);
        count++;
    }

    console.log("Done batch.");
}

main();
