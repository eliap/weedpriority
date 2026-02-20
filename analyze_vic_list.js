import axios from 'axios';
import { JSDOM } from 'jsdom';

const URL = 'https://weeds.org.au/weeds-profiles/?region=vic';

async function analyzeListing() {
    console.log(`Fetching ${URL}...`);
    try {
        const res = await axios.get(URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        // 1. Find Weed Links
        // Look for common patterns: <a> tags inside specific containers
        const links = Array.from(doc.querySelectorAll('a'));
        console.log(`Total links found: ${links.length}`);

        // Filter for potential profile links
        const profileLinks = links.filter(a => a.href.includes('/profiles/') || a.href.includes('/weeds-profiles/'));
        console.log(`Potential profile links: ${profileLinks.length}`);

        if (profileLinks.length > 0) {
            console.log('Sample links:');
            profileLinks.slice(0, 5).forEach(a => console.log(` - [${a.textContent.trim()}] ${a.href}`));
        }

        // 2. Check for Pagination
        const paginations = doc.querySelectorAll('.pagination, .page-numbers, .nav-links');
        if (paginations.length > 0) {
            console.log('Pagination found!');
            console.log(paginations[0].outerHTML.substring(0, 500));
        } else {
            console.log('No obvious pagination found.');
        }

        // 3. Check for Load More button
        const buttons = Array.from(doc.querySelectorAll('button, a.btn, a.button'));
        const loadMore = buttons.filter(b => b.textContent.toLowerCase().includes('load') || b.textContent.toLowerCase().includes('more'));
        if (loadMore.length > 0) {
            console.log('Potential Load More buttons:');
            loadMore.forEach(b => console.log(` - [${b.tagName}] ${b.textContent.trim()} (Classes: ${b.className})`));
        }

        // 4. Check specific container count
        const gridItems = doc.querySelectorAll('.weed-grid-item, .post-item, .card');
        console.log(`Grid items found: ${gridItems.length}`);

        // 5. Look for counts in text
        const bodyText = doc.body.textContent;
        const countMatch = bodyText.match(/(\d+)\s+results/i);
        if (countMatch) console.log(`Found result count text: ${countMatch[0]}`);

        // Dump HTML to file for manual inspection
        const fs = await import('fs');
        fs.writeFileSync('vic_weeds_dump.html', res.data);
        console.log('Dumped HTML to vic_weeds_dump.html');

    } catch (e) {
        console.error('Error fetching page:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
        }
    }
}

analyzeListing();
