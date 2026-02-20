import axios from 'axios';

const BASE_URL = 'https://weedscan.org.au';
const ENDPOINTS = [
    '/api/weeds',
    '/api/Weeds',
    '/api/weed/list',
    '/Weeds/GetAll',
    '/Weeds/GetWeeds',
    '/Weeds/Search',
    '/api/search',
    '/js/site.js' // Also fetch the JS to inspect
];

async function probe() {
    console.log('Probing WeedScan Enpoints...');
    for (const ep of ENDPOINTS) {
        const url = `${BASE_URL}${ep}`;
        try {
            const res = await axios.get(url);
            console.log(`[${res.status}] ${ep} - Type: ${res.headers['content-type']}`);
            if (ep.endsWith('.js')) {
                console.log(`  -> JS Content Preview: ${res.data.substring(0, 200)}...`);
                // Look for "api/" in JS
                const apiMatches = res.data.match(/\/api\/[a-zA-Z0-9_/]+/g);
                if (apiMatches) {
                    console.log(`  -> Found potential API calls in JS:`, [...new Set(apiMatches)]);
                }
            } else if (res.headers['content-type'].includes('json')) {
                console.log(`  -> JSON Data! Length: ${JSON.stringify(res.data).length}`);
                if (Array.isArray(res.data)) {
                    console.log(`  -> Is Array! Count: ${res.data.length}`);
                    console.log(`  -> Sample:`, res.data[0]);
                }
            }
        } catch (e) {
            console.log(`[${e.response ? e.response.status : 'ERR'}] ${ep} - ${e.message}`);
        }
    }
}

probe();
