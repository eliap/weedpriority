const fs = require('fs');
const path = require('path');

const VALIDATION_PATH = path.join(__dirname, '../src/data/weeds_victoria.json');

try {
    const data = JSON.parse(fs.readFileSync(VALIDATION_PATH, 'utf8'));
    const keys = Object.keys(data);
    console.log(`Total Profiles: ${keys.length}`);

    let missingControl = 0;
    let noControl = 0;
    let missingImages = 0;
    let bridalVeil = null;

    keys.forEach(key => {
        const weed = data[key];
        if (!weed.controlMethods) missingControl++;
        if (weed.controlMethods === "NO") noControl++;
        if (!weed.images || weed.images.length === 0) missingImages++;

        if (key.includes('bridal-veil') || weed.name.toLowerCase().includes('bridal veil')) {
            bridalVeil = weed;
        }
    });

    console.log(`Missing Control Methods: ${missingControl}`);
    console.log(`"NO" Control Methods: ${noControl}`);
    console.log(`Missing Images: ${missingImages}`);

    if (bridalVeil) {
        console.log('\nBridal Veil Found:');
        console.log(`- Name: ${bridalVeil.name}`);
        console.log(`- Quick Facts: ${bridalVeil.quickFacts ? bridalVeil.quickFacts.length : 0} items`);
        console.log(`- Control Methods length: ${bridalVeil.controlMethods ? bridalVeil.controlMethods.length : 0}`);
    } else {
        console.log('\nBridal Veil NOT found.');
    }

} catch (e) {
    console.error('Validation Error:', e.message);
}
