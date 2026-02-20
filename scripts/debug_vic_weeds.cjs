const fs = require('fs');
const vicWeeds = require('../src/data/weeds_victoria.json');

const keys = Object.keys(vicWeeds);
const rubusKeys = keys.filter(k => k.toLowerCase().includes('rubus'));
const blackberryKeys = keys.filter(k => k.toLowerCase().includes('blackberry'));

console.log('Rubus keys:', rubusKeys);
console.log('Blackberry keys:', blackberryKeys);

if (blackberryKeys.length > 0) {
    console.log('Blackberry Data:', vicWeeds[blackberryKeys[0]]);
}
