const vicWeeds = require('./src/data/weeds_victoria.json');

const entries = Object.entries(vicWeeds);
console.log(`Total entries: ${entries.length}\n`);

// Track all fields across all entries
const fieldStats = {};
const issues = [];

entries.forEach(([key, val]) => {
    // Check for non-object entries
    if (typeof val !== 'object' || val === null) {
        issues.push(`[${key}] Value is not an object: ${typeof val}`);
        return;
    }

    // Track every field
    Object.keys(val).forEach(field => {
        if (!fieldStats[field]) fieldStats[field] = { count: 0, types: new Set(), empties: 0, nulls: 0, samples: [] };
        const stat = fieldStats[field];
        stat.count++;
        const v = val[field];
        stat.types.add(v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
        if (v === null) stat.nulls++;
        if (v === '' || (Array.isArray(v) && v.length === 0)) stat.empties++;
        if (stat.samples.length < 2 && v && v !== '' && (!Array.isArray(v) || v.length > 0)) {
            stat.samples.push(typeof v === 'string' ? v.slice(0, 80) : (Array.isArray(v) ? `[${v.length} items]` : JSON.stringify(v).slice(0, 80)));
        }
    });

    // Specific checks
    if (!val.name) issues.push(`[${key}] Missing 'name'`);
    if (!val.id) issues.push(`[${key}] Missing 'id'`);
    if (val.quickFacts && !Array.isArray(val.quickFacts)) issues.push(`[${key}] quickFacts is not an array: ${typeof val.quickFacts}`);
    if (val.images && !Array.isArray(val.images)) issues.push(`[${key}] images is not an array: ${typeof val.images}`);
    if (val.quickFacts && Array.isArray(val.quickFacts)) {
        val.quickFacts.forEach((fact, i) => {
            if (typeof fact !== 'string') issues.push(`[${key}] quickFacts[${i}] is not a string: ${typeof fact}`);
        });
    }
});

// Report field stats
console.log('=== FIELD CONSISTENCY ===');
console.log(`${'Field'.padEnd(25)} ${'Count'.padEnd(8)} ${'Types'.padEnd(25)} ${'Empties'.padEnd(10)} ${'Nulls'.padEnd(8)}`);
console.log('-'.repeat(80));
Object.entries(fieldStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([field, stat]) => {
        const types = [...stat.types].join(', ');
        const pct = ((stat.count / entries.length) * 100).toFixed(0);
        console.log(`${field.padEnd(25)} ${(stat.count + ' (' + pct + '%)').padEnd(8)} ${types.padEnd(25)} ${String(stat.empties).padEnd(10)} ${stat.nulls}`);
    });

// Quick Facts coverage
const withQF = entries.filter(([, v]) => v.quickFacts && v.quickFacts.length > 0);
const withoutQF = entries.filter(([, v]) => !v.quickFacts || v.quickFacts.length === 0);
console.log(`\n=== QUICK FACTS COVERAGE ===`);
console.log(`With Quick Facts: ${withQF.length}/${entries.length} (${((withQF.length / entries.length) * 100).toFixed(1)}%)`);
console.log(`Without Quick Facts: ${withoutQF.length}`);
if (withoutQF.length <= 20) {
    console.log('Missing QF entries:', withoutQF.map(([k]) => k).join(', '));
}

// Issues
console.log(`\n=== ISSUES FOUND: ${issues.length} ===`);
issues.slice(0, 30).forEach(i => console.log(`  ⚠ ${i}`));
if (issues.length > 30) console.log(`  ... and ${issues.length - 30} more`);

// Check for duplicate names
const names = entries.map(([, v]) => v.name).filter(Boolean);
const nameCounts = {};
names.forEach(n => { nameCounts[n] = (nameCounts[n] || 0) + 1; });
const dupes = Object.entries(nameCounts).filter(([, c]) => c > 1);
if (dupes.length > 0) {
    console.log(`\n=== DUPLICATE NAMES: ${dupes.length} ===`);
    dupes.forEach(([name, count]) => console.log(`  "${name}" appears ${count} times`));
}
