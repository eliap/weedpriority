const merged = require('../src/data/mergedWeeds.json');

const keyOne = 'cape tulip (one leaf)';
const keyTwo = 'cape tulip (two leaf)';

console.log('One Leaf:', merged[keyOne] ? {
    found: true,
    scientificName: merged[keyOne].scientificName,
    id: merged[keyOne].id,
    source: merged[keyOne].source
} : 'Not Found');

console.log('Two Leaf:', merged[keyTwo] ? {
    found: true,
    scientificName: merged[keyTwo].scientificName,
    id: merged[keyTwo].id,
    source: merged[keyTwo].source
} : 'Not Found');
