const fs = require('fs');
const vicWeeds = require('./src/data/weeds_victoria.json');
const governmentDataRaw = require('./src/data/realGovernmentData.json');
const scrapedData = require('./src/data/weed_assessments.json');

const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// 1. Create a lookup map for Victorian weeds with ALIAS support
console.log('Building Vic Weeds Map...');
const vicWeedsMap = {};

Object.values(vicWeeds).forEach(weed => {
    if (weed.name) vicWeedsMap[normalize(weed.name)] = weed;
    if (weed.id) vicWeedsMap[normalize(weed.id)] = weed;

    // Map by Aliases
    if (weed.name) {
        // Split by comma, semicolon, slash, or parens
        const aliases = weed.name.split(/,|;|\/|\(|\)/).map(s => s.trim());
        aliases.forEach(alias => {
            if (alias.length > 2) {
                vicWeedsMap[normalize(alias)] = weed;
            }
        });
    }
});

// 2. Simulate the Merge for English Broom
const targetKey = "English broom"; // Key from weed_assessments.json (verified in debug script)
const assessmentItem = scrapedData[targetKey];
const govItem = governmentDataRaw[targetKey] || {};

console.log(`\n--- Simulating Merge for "${targetKey}" ---`);

if (!assessmentItem) {
    console.error(`CRITICAL: "${targetKey}" not found in weed_assessments.json!`);
} else {
    console.log(`Found in weed_assessments.json.`);
}

let vicItem = vicWeedsMap[normalize(targetKey)];

if (!vicItem && assessmentItem) {
    console.log(`Direct lookup failed. Trying assessment name: "${assessmentItem.name}"`);
    vicItem = vicWeedsMap[normalize(assessmentItem.name)];
}

if (vicItem) {
    console.log(`SUCCESS: Found matching Victorian item ID: "${vicItem.id}"`);
    console.log(`QuickFacts Count: ${vicItem.quickFacts ? vicItem.quickFacts.length : 0}`);
    if (vicItem.quickFacts && vicItem.quickFacts.length > 0) {
        console.log('First Fact:', vicItem.quickFacts[0]);
    } else {
        console.log('WARNING: vicItem found but QuickFacts is empty array.');
    }
} else {
    console.log(`FAILURE: Could not find Victorian item for "${targetKey}".`);
    console.log(`Normalized Key searched: "${normalize(targetKey)}"`);
    if (assessmentItem) {
        console.log(`Normalized Assessment Name searched: "${normalize(assessmentItem.name)}"`);
    }
}

// 3. Check what happens if we force it
console.log('\n--- Checking specific keys in map ---');
const specificKeys = ['englishbroom', 'broomenglishscotch'];
specificKeys.forEach(k => {
    if (vicWeedsMap[k]) {
        console.log(`Key "${k}" exists -> ID: ${vicWeedsMap[k].id}`);
    } else {
        console.log(`Key "${k}" does NOT exist.`);
    }
});
