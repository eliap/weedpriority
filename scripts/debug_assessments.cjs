const fs = require('fs');
const data = require('../src/data/weed_assessments.json');

const keys = Object.keys(data);
const arumKeys = keys.filter(k => k.toLowerCase().includes('arum'));
const blackberryKeys = keys.filter(k => k.toLowerCase().includes('rubus') || k.toLowerCase().includes('blackberry'));

console.log('Arum keys:', arumKeys);
console.log('Blackberry keys:', blackberryKeys);

if (arumKeys.length > 0) {
    console.log('Arum Data Keys:', Object.keys(data[arumKeys[0]]));
}
if (blackberryKeys.length > 0) {
    console.log('Blackberry Data Keys:', Object.keys(data[blackberryKeys[0]]));
}
