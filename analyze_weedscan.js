import axios from 'axios';
import { JSDOM } from 'jsdom';

const URL = 'https://weedscan.org.au/Weeds';

async function analyze() {
    console.log(`Fetching ${URL}...`);
    try {
        const res = await axios.get(URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        // Check for client-side frameworks
        const scripts = Array.from(doc.querySelectorAll('script')).map(s => s.src);
        console.log('Scripts found:', scripts.filter(s => s));

        // Check for list items
        const links = Array.from(doc.querySelectorAll('a'));
        const profileLinks = links.filter(a => a.href && a.href.includes('/Weeds/View/'));

        console.log(`Total links: ${links.length}`);
        console.log(`Profile links found (static): ${profileLinks.length}`);

        if (profileLinks.length > 0) {
            console.log('Sample link:', profileLinks[0].href);
        } else {
            console.log('No profile links found. Likely an SPA loading data via API.');
            // Dump HTML to file for manual inspection
            const fs = await import('fs');
            fs.writeFileSync('weedscan_dump.html', res.data);
            console.log('Dumped HTML to weedscan_dump.html');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

analyze();
