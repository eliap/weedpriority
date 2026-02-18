const fs = require('fs');
const path = require('path');

// Load the real government data
const govData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/realGovernmentData.json'), 'utf8'));

// Scoring constants (must match ActionPlan.jsx exactly)
const RATING_VALUES = { "L": 1, "ML": 2, "M": 3, "MH": 4, "H": 5 };
const CONFIDENCE_VALUES = { "L": 0.2, "ML": 0.4, "M": 0.6, "MH": 0.8, "H": 1.0 };
const CONTROL_SCORES = { 1: 100, 2: 75, 3: 50, 4: 25 };

// Import category definitions
// We'll hardcode the IDs here to match the app's data files

const impactItemIds = [
    // Social
    "social_access", "social_tourism", "social_injurious", "social_cultural",
    // Environmental - Abiotic
    "env_flow", "env_water", "env_erosion", "env_biomass", "env_fire",
    // Environmental - Community Habitat
    "hab_high", "hab_med", "hab_low", "hab_structure", "hab_flora",
    // Environmental - Fauna
    "fauna_threatened", "fauna_non_threatened", "fauna_no_benefit", "fauna_injurious",
    // Pest Animal
    "pest_food", "pest_harbor",
    // Agricultural
    "ag_yield", "ag_quality", "ag_land_value", "ag_land_use", "ag_harvest_costs", "ag_disease"
];

const invasivenessItemIds = [
    "inv_germination", "inv_establishment", "inv_disturbance", "inv_life_form",
    "inv_growth_rate", "inv_stress_tolerance",
    "inv_repro_system", "inv_repro_period", "inv_maturity_time",
    "inv_propagules_count", "inv_propagule_longevity", "inv_allelopathic",
    "inv_mechanisms_count", "inv_dispersal_distance", "inv_herb_pressure"
];

// For this validation, assume ALL impact items are selected (selectedValues = all true)
const selectedValues = {};
impactItemIds.forEach(id => selectedValues[id] = true);

function calculateCategoryScore(itemIds, govReviews, selectedIds) {
    let totalScore = 0;
    let totalScoreMax = 0;
    let maxPossibleScore = 0;
    let maxPossibleScoreMax = 0;
    let details = [];

    itemIds.forEach(id => {
        if (selectedIds && !selectedIds[id]) return;

        const govItem = govReviews[id] || {};
        const finalRatingStr = govItem.rating;
        const finalConfStr = govItem.confidence;

        if (finalRatingStr) {
            const ratingVal = RATING_VALUES[finalRatingStr] || 0;
            const confVal = CONFIDENCE_VALUES[finalConfStr] || 0.5;

            const weighted = ratingVal * confVal;
            totalScore += weighted;
            totalScoreMax += ratingVal;
            maxPossibleScore += 5;
            maxPossibleScoreMax += 5;

            details.push({ id, rating: finalRatingStr, ratingVal, confidence: finalConfStr, confVal, weighted });
        }
    });

    return {
        scaled: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
        unscaled: maxPossibleScoreMax > 0 ? (totalScoreMax / maxPossibleScoreMax) * 100 : 0,
        details,
        totalScore,
        maxPossibleScore
    };
}

// Validation inputs
const testWeeds = [
    { name: "Asparagus fern", rank: 1, extent: 3, habitat: 1, controlLevel: 1 },
    { name: "Freesia", rank: 2, extent: 2, habitat: 2, controlLevel: 3 },
    { name: "Bridal creeper", rank: 3, extent: 4, habitat: 1, controlLevel: 3 }
];

// Default weights (20% each)
const weights = { extent: 20, impact: 20, invasiveness: 20, habitat: 20, control: 20 };

console.log("=== VALIDATION RESULTS ===\n");

testWeeds.forEach(weed => {
    const govWeedData = govData[weed.name] || { impact: {}, invasiveness: {} };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`WEED: ${weed.name} (Gut Feel Rank: ${weed.rank})`);
    console.log(`${'='.repeat(60)}`);

    // Impact
    const impactResult = calculateCategoryScore(impactItemIds, govWeedData.impact || {}, selectedValues);
    console.log(`\n--- IMPACT ---`);
    console.log(`  Questions with data: ${impactResult.details.length}`);
    impactResult.details.forEach(d => {
        console.log(`    ${d.id}: Rating=${d.rating}(${d.ratingVal}) x Confidence=${d.confidence}(${d.confVal}) = ${d.weighted.toFixed(2)}`);
    });
    console.log(`  Sum of weighted scores: ${impactResult.totalScore.toFixed(2)}`);
    console.log(`  Max possible (${impactResult.details.length} items x 5): ${impactResult.maxPossibleScore}`);
    console.log(`  IMPACT SCORE (scaled): ${impactResult.scaled.toFixed(2)}`);

    // Invasiveness
    const invResult = calculateCategoryScore(invasivenessItemIds, govWeedData.invasiveness || {}, null);
    console.log(`\n--- INVASIVENESS ---`);
    console.log(`  Questions with data: ${invResult.details.length}`);
    invResult.details.forEach(d => {
        console.log(`    ${d.id}: Rating=${d.rating}(${d.ratingVal}) x Confidence=${d.confidence}(${d.confVal}) = ${d.weighted.toFixed(2)}`);
    });
    console.log(`  Sum of weighted scores: ${invResult.totalScore.toFixed(2)}`);
    console.log(`  Max possible (${invResult.details.length} items x 5): ${invResult.maxPossibleScore}`);
    console.log(`  INVASIVENESS SCORE (scaled): ${invResult.scaled.toFixed(2)}`);

    // Extent
    const extentScore = weed.extent * 20;
    console.log(`\n--- EXTENT ---`);
    console.log(`  Input value: ${weed.extent}`);
    console.log(`  EXTENT SCORE: ${extentScore}`);

    // Habitat
    const habitatScore = weed.habitat === 2 ? 100 : 50;
    console.log(`\n--- HABITAT ---`);
    console.log(`  Input value: ${weed.habitat}`);
    console.log(`  HABITAT SCORE: ${habitatScore}`);

    // Control
    const controlScore = CONTROL_SCORES[weed.controlLevel] || 50;
    console.log(`\n--- CONTROL ---`);
    console.log(`  Input level: ${weed.controlLevel}`);
    console.log(`  CONTROL SCORE: ${controlScore}`);

    // Final Weighted
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const norm = totalWeight / 100;
    const finalScore = (
        (extentScore * weights.extent / 100) +
        (impactResult.scaled * weights.impact / 100) +
        (invResult.scaled * weights.invasiveness / 100) +
        (habitatScore * weights.habitat / 100) +
        (controlScore * weights.control / 100)
    ) / norm;

    console.log(`\n--- FINAL WEIGHTED SCORE ---`);
    console.log(`  Extent(${extentScore}) x ${weights.extent}% = ${(extentScore * weights.extent / 100).toFixed(2)}`);
    console.log(`  Impact(${impactResult.scaled.toFixed(1)}) x ${weights.impact}% = ${(impactResult.scaled * weights.impact / 100).toFixed(2)}`);
    console.log(`  Invasiveness(${invResult.scaled.toFixed(1)}) x ${weights.invasiveness}% = ${(invResult.scaled * weights.invasiveness / 100).toFixed(2)}`);
    console.log(`  Habitat(${habitatScore}) x ${weights.habitat}% = ${(habitatScore * weights.habitat / 100).toFixed(2)}`);
    console.log(`  Control(${controlScore}) x ${weights.control}% = ${(controlScore * weights.control / 100).toFixed(2)}`);
    console.log(`  FINAL SCORE: ${finalScore.toFixed(2)}`);
});
