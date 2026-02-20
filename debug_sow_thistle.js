import axios from 'axios';
import { JSDOM } from 'jsdom';

const URL = 'https://weeds.org.au/profiles/perennial-sow-thistle/';

async function debug() {
    console.log(`Fetching ${URL}...`);
    const res = await axios.get(URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const dom = new JSDOM(res.data);
    const doc = dom.window.document;

    // Dump headers
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5'));
    console.log('Headings found:');
    headings.forEach(h => console.log(` - [${h.tagName}] ${h.textContent.trim()}`));

    // Check Control section specifically
    const controlHeader = headings.find(h => h.textContent.toLowerCase().includes('control') || h.textContent.toLowerCase().includes('management'));
    if (controlHeader) {
        console.log(`\nFound header: ${controlHeader.textContent}`);
        let next = controlHeader.nextElementSibling;
        let content = [];
        while (next && !['H1', 'H2', 'H3', 'H4', 'H5'].includes(next.tagName)) {
            console.log(`   Sibling [${next.tagName}]: ${next.textContent.trim().substring(0, 50)}...`);
            content.push(next.textContent.trim());
            next = next.nextElementSibling;
        }
        console.log('\nExtracted Content:', content.join('\n\n'));
    } else {
        console.log('\nNo Control/Management header found.');
    }
}

debug();
