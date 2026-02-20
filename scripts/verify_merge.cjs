const merged = require('../src/data/mergedWeeds.json');

const arum = merged['white arum lily'];
const blackberry = merged['blackberry'];

console.log('White Arum Lily:', arum ? {
    found: true,
    scientificName: arum.scientificName,
    growthForm: arum.growthForm,
    id: arum.id,
    source: arum.source
} : 'Not Found');

console.log('Blackberry:', blackberry ? {
    found: true,
    scientificName: blackberry.scientificName,
    growthForm: blackberry.growthForm,
    id: blackberry.id,
    source: blackberry.source
} : 'Not Found');
