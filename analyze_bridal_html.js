const axios = require('axios');
const { JSDOM } = require('jsdom');

async function analyze() {
    const url = "https://weeds.org.au/profiles/bridal-creeper-veil/";
    console.log(`Fetching ${url}...`);
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        console.log("--- Analyzing Quick Facts Structure ---");

        // Find anything that looks like "Quick Facts"
        const allElements = doc.body.querySelectorAll('*');
        for (const el of allElements) {
            if (el.textContent.trim().toLowerCase() === 'quick facts' ||
                (el.tagName.match(/^H[1-6]$/) && el.textContent.trim().toLowerCase().includes('quick facts'))) {

                console.log(`\nFOUND: <${el.tagName} class="${el.className}">${el.textContent.trim()}</${el.tagName}>`);

                // Look at siblings
                let next = el.nextElementSibling;
                for (let i = 0; i < 3 && next; i++) {
                    console.log(`  + Sibling [${next.tagName}]: ${next.textContent.trim().substring(0, 100)}...`);
                    if (next.tagName === 'DIV') {
                        console.log('    -> Found DIV! Content:');
                        console.log(next.innerHTML.substring(0, 500));
                    }
                    if (next.tagName === 'UL') {
                        console.log('    -> Found UL!');
                    }
                    next = next.nextElementSibling;
                }

                // Look at parent (maybe it's nested differently)
                console.log(`  ^ Parent: <${el.parentElement.tagName} class="${el.parentElement.className}">`);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

analyze();
