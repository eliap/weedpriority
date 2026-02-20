const fs = require('fs');
const path = require('path');

const VIC_WEEDS_PATH = path.join(__dirname, '../src/data/weeds_victoria.json');
const PROFILES_PATH = path.join(__dirname, '../src/data/weedProfiles.json');
const GOV_DATA_PATH = path.join(__dirname, '../src/data/realGovernmentData.json');
const ASSESSMENTS_PATH = path.join(__dirname, '../src/data/weed_assessments.json');
const OUTPUT_PATH = path.join(__dirname, '../src/data/mergedWeeds.json');

// Normalization helper
const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/['’]/g, '')
        .replace(/\-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

function main() {
    console.log('Loading data...');
    const vicWeeds = JSON.parse(fs.readFileSync(VIC_WEEDS_PATH, 'utf8'));
    const weedProfiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
    const govData = JSON.parse(fs.readFileSync(GOV_DATA_PATH, 'utf8'));
    const assessments = JSON.parse(fs.readFileSync(ASSESSMENTS_PATH, 'utf8'));

    const mergedData = {};

    // 1. Initialize with Vic Weeds (Base Layer)
    const vicIndex = {};
    Object.keys(vicWeeds).forEach(key => {
        const item = vicWeeds[key];
        const normKey = normalize(key);

        mergedData[normKey] = { ...item, id: key, source: 'vic' };

        // Fix Field Collision: text vs score object
        if (typeof mergedData[normKey].impact === 'string') {
            mergedData[normKey].impactText = mergedData[normKey].impact;
            mergedData[normKey].impact = {};
        }
        if (typeof mergedData[normKey].invasiveness === 'string') {
            mergedData[normKey].invasivenessText = mergedData[normKey].invasiveness;
            mergedData[normKey].invasiveness = {};
        }

        vicIndex[normKey] = normKey;
        if (item.name) vicIndex[normalize(item.name)] = normKey;

        if (item.name) {
            const aliases = item.name.split(/,|;|\/|\(|\)/).map(s => s.trim());
            aliases.forEach(alias => {
                if (alias.length > 2) vicIndex[normalize(alias)] = normKey;
            });
        }
    });

    // Manual overrides for specific mismatches to link Assessments/Profiles to VicWeeds
    const manualMap = {
        'white arum lily': 'arum-lily-calla',
        'blackberry': 'blackberry-european',
        'rubus fruticosus agg': 'blackberry-european',
        'cape tulip (one leaf)': 'cape-tulip-one',
        'cape tulip (two leaf)': 'two-leaf-cape',
        'cape broom / montpellier broom (genista)': 'montpellier-broom-cape',
        'blue periwinkle': 'blue-periwinkle-vinca'
    };
    Object.keys(manualMap).forEach(k => {
        vicIndex[normalize(k)] = normalize(manualMap[k]);
    });

    // Helper to find Vic Key
    const findMergedKey = (name, profileUrl = null) => {
        if (profileUrl) {
            const slug = profileUrl.replace(/\/$/, '').split('/').pop();
            const normSlug = normalize(slug);
            if (mergedData[normSlug]) return normSlug;
        }
        const normName = normalize(name);
        if (vicIndex[normName]) return vicIndex[normName];
        return null;
    };

    // 2. Merge Government Data (Scores)
    Object.keys(govData).forEach(key => {
        const govItem = govData[key];
        let targetKey = findMergedKey(key);

        if (!targetKey) {
            targetKey = normalize(key);
            if (!mergedData[targetKey]) {
                mergedData[targetKey] = {
                    id: key,
                    name: key,
                    source: 'gov_orphan'
                };
                vicIndex[normalize(key)] = targetKey;
            }
        }

        // Merge scores
        mergedData[targetKey].impact = { ...(mergedData[targetKey].impact || {}), ...(govItem.impact || {}) };
        mergedData[targetKey].invasiveness = { ...(mergedData[targetKey].invasiveness || {}), ...(govItem.invasiveness || {}) };
        mergedData[targetKey].hasGovScore = true;
    });

    // 3. Merge Assessments
    Object.keys(assessments).forEach(key => {
        const assessmentItem = assessments[key];
        let targetKey = findMergedKey(key) || findMergedKey(assessmentItem.name || '');

        if (!targetKey) {
            targetKey = normalize(key);
            if (!mergedData[targetKey]) {
                mergedData[targetKey] = {
                    id: key,
                    name: key,
                    source: 'assessment_orphan'
                };
                vicIndex[normalize(key)] = targetKey;
            }
        }

        mergedData[targetKey].impact = { ...(mergedData[targetKey].impact || {}), ...(assessmentItem.impact || {}) };
        mergedData[targetKey].invasiveness = { ...(mergedData[targetKey].invasiveness || {}), ...(assessmentItem.invasiveness || {}) };

        if (assessmentItem.description) mergedData[targetKey].description = assessmentItem.description;
        if (!mergedData[targetKey].origin && assessmentItem.origin) mergedData[targetKey].origin = assessmentItem.origin;
    });

    // 4. Merge Profiles
    const keyMap = {
        "Asparagus fern": "asparagus fern",
        "Bridal creeper": "bridal creeper",
        "Athel pine": "athel pine",
        "Freesia": "freesia",
        "Wards weed": "wards weed",
        "Whiskey grass": "whisky grass",
        "Annual mercury": "annual mercury",
        "Black willow": "black willow",
        "Blue psoralea": "blue psoralea",
        "Keriberry": "keriberry",
        "Italian buckthorn": "italian buckthorn",
        "Sallow wattle": "sallow wattle",
        "Vasey grass": "vasey grass",
    };

    Object.keys(weedProfiles).forEach(profileName => {
        const profile = weedProfiles[profileName];
        let targetKey = null;

        if (keyMap[profileName]) {
            targetKey = normalize(keyMap[profileName]);
            if (!mergedData[targetKey]) {
                mergedData[targetKey] = {
                    id: keyMap[profileName],
                    name: profileName,
                    source: 'profile_mapped_orphan'
                };
                vicIndex[normalize(profileName)] = targetKey;
            }
        }

        if (!targetKey) targetKey = findMergedKey(profileName, profile.profileUrl);

        if (!targetKey) {
            targetKey = normalize(profileName);
            if (!mergedData[targetKey]) {
                mergedData[targetKey] = {
                    id: profileName,
                    name: profileName,
                    source: 'profile_orphan'
                };
                vicIndex[normalize(profileName)] = targetKey;
            }
        }

        const data = mergedData[targetKey];
        data.scientificName = profile.scientificName || data.scientificName;
        data.quickFacts = (profile.quickFacts && profile.quickFacts.length > 0) ? profile.quickFacts : data.quickFacts;
        data.origin = profile.origin || data.origin;
        data.growthForm = profile.growthForm || data.growthForm;
        data.controlMethods = profile.controlMethods || data.controlMethods;
        data.bestControlSeason = profile.bestControlSeason || data.bestControlSeason;
        data.flowerColour = profile.flowerColour || data.flowerColour;
        data.profileUrl = profile.profileUrl || data.profileUrl;

        // Add missing rich fields from profile
        data.flowers = profile.flowers || data.flowers;
        data.leaves = profile.leaves || data.leaves;
        data.fruit = profile.fruit || data.fruit;
        data.reproduction = profile.reproduction || data.reproduction;
        data.description = profile.description || data.description;

        data.hasProfile = true;

        if (!data.flowerColour && data.flowers) {
            const colors = ['white', 'pink', 'yellow', 'red', 'purple', 'blue', 'orange', 'cream', 'green'];
            const found = colors.filter(c => data.flowers.toLowerCase().includes(c));
            if (found.length > 0) {
                data.flowerColour = found.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
            }
        }
    });

    const outputData = {};
    Object.keys(mergedData).forEach(k => {
        outputData[k] = mergedData[k];
    });

    // Add lookup aliases from vicIndex (pointing to SAME object content)
    Object.keys(vicIndex).forEach(alias => {
        const targetKey = vicIndex[alias];
        // Only if alias is NOT already a primary key
        if (targetKey && mergedData[targetKey] && !outputData[alias]) {
            outputData[alias] = mergedData[targetKey];
        }
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`Merged data saved to ${OUTPUT_PATH}`);
    console.log(`Total entries: ${Object.keys(outputData).length}`);
}

main();
