const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'src/data/weedProfiles.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

console.log('Total keys:', Object.keys(data).length);
const bridalKeys = Object.keys(data).filter(k => k.includes('Bridal'));
console.log('Keys containing "Bridal":', bridalKeys);

if (data['Bridal Veil']) {
    console.log('Bridal Veil exists.');
    console.log('Quick Facts length:', data['Bridal Veil'].quickFacts ? data['Bridal Veil'].quickFacts.length : 'undefined');
    console.log('Quick Facts content:', JSON.stringify(data['Bridal Veil'].quickFacts, null, 2));
} else {
    console.log('Bridal Veil NOT found.');
}

// Check for duplicates (manual scan of text)
const text = fs.readFileSync(p, 'utf8');
const matches = text.match(/"Bridal Veil":\s*\{/g);
console.log('Occurrences of "Bridal Veil": { in text:', matches ? matches.length : 0);
