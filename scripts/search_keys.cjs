const fs = require('fs');
const vic = require('../src/data/weeds_victoria.json');
const gov = require('../src/data/realGovernmentData.json');
const assess = require('../src/data/weed_assessments.json');

const search = (obj, term) => {
    return Object.keys(obj).filter(k => k.toLowerCase().includes(term));
};

console.log('Vic - Cape:', search(vic, 'cape'));
console.log('Vic - Tulip:', search(vic, 'tulip'));
console.log('Vic - Moraea:', search(vic, 'moraea'));

console.log('Gov - Cape:', search(gov, 'cape'));
console.log('Gov - Tulip:', search(gov, 'tulip'));
console.log('Gov - Moraea:', search(gov, 'moraea'));

console.log('Assess - Cape:', search(assess, 'cape'));
console.log('Assess - Tulip:', search(assess, 'tulip'));
console.log('Assess - Moraea:', search(assess, 'moraea'));
