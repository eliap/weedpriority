const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('vic_weeds_dump.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Strategy 1: Look for data-title attributes in list items
const listItems = Array.from(doc.querySelectorAll('li[data-title]'));
console.log(`Found ${listItems.length} list items with data-title`);

const slugs = listItems.map(li => li.getAttribute('data-title'));
const uniqueSlugs = [...new Set(slugs)];
console.log(`Unique slugs found: ${uniqueSlugs.length}`);

if (uniqueSlugs.length > 0) {
    console.log('Sample slugs:', uniqueSlugs.slice(0, 5));
}

// Strategy 2: Look for all profile links again, maybe I missed some
const links = Array.from(doc.querySelectorAll('a[href*="/profiles/"]'));
const linkSlugs = links.map(a => {
    const parts = a.href.split('/').filter(p => p);
    return parts[parts.length - 1];
});
const uniqueLinkSlugs = [...new Set(linkSlugs)];
console.log(`Unique link slugs found: ${uniqueLinkSlugs.length}`);

// Combine
const allSlugs = [...new Set([...uniqueSlugs, ...uniqueLinkSlugs])];
console.log(`Total unique likely profiles: ${allSlugs.length}`);
allSlugs.sort();
console.log('First 5:', allSlugs.slice(0, 5));
console.log('Last 5:', allSlugs.slice(-5));
