
const vicWeeds = require('./src/data/weeds_victoria.json');
const weedProfiles = require('./src/data/weedProfiles.json');
const governmentDataRaw = require('./src/data/realGovernmentData.json');
const scrapedData = require('./src/data/weed_assessments.json');

const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// 1. Create a lookup map for Victorian weeds (Mocking BrochureExport logic)
const vicWeedsMap = {};
Object.values(vicWeeds).forEach(weed => {
    if (weed.name) vicWeedsMap[normalize(weed.name)] = weed;
    if (weed.id) vicWeedsMap[normalize(weed.id)] = weed;

    // Map by Aliases
    if (weed.name) {
        const aliases = weed.name.split(/,|;|\/|\(|\)/).map(s => s.trim());
        aliases.forEach(alias => {
            if (alias.length > 2) vicWeedsMap[normalize(alias)] = weed;
        });
    }
});
console.log(`[DEBUG] vicWeedsMap size: ${Object.keys(vicWeedsMap).length}`);
console.log(`[DEBUG] Has 'cootamundrawattle'? ${!!vicWeedsMap['cootamundrawattle']}`);
if (vicWeedsMap['cootamundrawattle']) {
    console.log(`[DEBUG] cootamundrawattle entry:`, JSON.stringify(vicWeedsMap['cootamundrawattle'], null, 2));
}
console.log(`[DEBUG] Has 'africanboxthorn'? ${!!vicWeedsMap['africanboxthorn']}`);

// 1.5 Create a secondary lookup map for weedProfiles (fallback)
const profileWeedsMap = {};
Object.keys(weedProfiles).forEach(key => {
    const profile = weedProfiles[key];
    const normKey = normalize(key);
    profileWeedsMap[normKey] = { ...profile, name: key };

    // Map by Aliases (stripping parens etc)
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        profileWeedsMap[normalize(simpleName)] = { ...profile, name: key };
    }
});

// 2. Merge scraped data into government data (Mocking BrochureExport logic)
const governmentData = { ...governmentDataRaw };
Object.keys(scrapedData).forEach(key => {
    const govItem = governmentData[key] || {};
    const assessmentItem = scrapedData[key];

    // Layer 1 & 2: Name-based lookup via vicWeedsMap
    let vicItem = vicWeedsMap[normalize(key)] || vicWeedsMap[normalize(assessmentItem.name)];

    // Layer 3: Use profileUrl slug
    if (!vicItem) {
        const profile = weedProfiles[key];
        if (profile?.profileUrl) {
            const slug = profile.profileUrl.replace(/\/$/, '').split('/').pop();
            if (slug && vicWeeds[slug]) {
                vicItem = vicWeeds[slug];
            }
        }
    }

    // Layer 4: Fallback to direct weedProfiles data
    if (!vicItem) {
        const profileMatch = profileWeedsMap[normalize(key)];
        if (profileMatch) {
            vicItem = {
                name: profileMatch.name,
                scientificName: profileMatch.scientificName,
                url: profileMatch.profileUrl,
                description: "Description not available in primary database.",
                controlMethods: profileMatch.controlMethods || "Control methods not available.",
            };
        }
    }

    vicItem = vicItem || {};

    governmentData[key] = {
        ...govItem,
        ...assessmentItem,
        description: vicItem.description || assessmentItem.description || govItem.description ||
            (assessmentItem.comments ? `Assessors notes: ${assessmentItem.comments}` : null) ||
            (assessmentItem.invasiveness ? Object.values(assessmentItem.invasiveness).map(v => v.comments).join('. ') : ''),
        // Capture scientific name for photo fetching test
        scientificName: vicItem.scientificName || assessmentItem.scientificName || govItem.scientificName
    };
});

// Mock govDataKeyMap
const govDataKeyMap = {};
Object.keys(governmentData).forEach(key => {
    govDataKeyMap[normalize(key)] = key;
    const simpleName = key.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (simpleName && simpleName !== key) {
        const simpleNorm = normalize(simpleName);
        if (!govDataKeyMap[simpleNorm]) {
            govDataKeyMap[simpleNorm] = key;
        }
    }
});

// Test Cases
const testCases = [
    "Gazania",
    "Cootamundra wattle",
    "African boxthorn" // Control
];

console.log("\n--- Testing Matches & Photo Targets (Simulating scoredWeeds) ---");
testCases.forEach(test => {
    const normKey = normalize(test);

    // 1. Try governmentData lookup
    let govWeedData = null;
    let matchedKey = govDataKeyMap[normKey] || governmentData[test]; // Direct or map
    if (matchedKey) {
        govWeedData = governmentData[matchedKey];
    }

    // 2. Extract/Fallback scientificName
    let scientificName = govWeedData ? govWeedData.scientificName : null;
    let source = "governmentData";

    if (!scientificName) {
        const vicMatch = vicWeedsMap[normKey];
        if (vicMatch) {
            scientificName = vicMatch.scientificName;
            source = "vicWeedsMap (Fallback)";

            // Mirror fallback logic from BrochureExport.jsx
            if (!scientificName && vicMatch.quickFacts && vicMatch.quickFacts.length > 0) {
                const firstFact = vicMatch.quickFacts[0];
                const match = firstFact.match(/\((.*?)\)/);
                if (match && match[1]) {
                    scientificName = match[1];
                    source = "vicWeedsMap (Extracted from QuickFacts)";
                }
            }
        } else {
            source = "NONE";
        }
    }

    if (scientificName) {
        console.log(`[PASS] Resolved '${test}' -> '${scientificName}' (Source: ${source})`);
        if (govWeedData) {
            console.log(`       Description length: ${govWeedData.description ? govWeedData.description.length : 0}`);
        }
    } else {
        console.log(`[FAIL] Could not resolve scientificName for '${test}'`);
    }
});
