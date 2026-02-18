const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../weeds.db');
const outputPath = path.resolve(__dirname, '../src/data/realGovernmentData.json');

// Mapping from DB Question Text to Application ID
const QUESTION_MAPPING = {
    // Social
    "1. Restrict human access?": "social_access",
    "2. Reduce tourism?": "social_tourism",
    "3. Injurious to people?": "social_injurious",
    "4. Damage to cultural sites?": "social_cultural",

    // Environmental - Abiotic
    "5. Impact flow?": "env_flow",
    "6. Impact water quality?": "env_water",
    "7. Increase soil erosion?": "env_erosion",
    "8. Reduce biomass?": "env_biomass",
    "9. Change fire regime?": "env_fire",

    // Environmental - Community Habitat
    "10. Impact on composition \n(a) high value EVC": "hab_high",
    "(b) medium value EVC": "hab_med",
    "(c) low value EVC": "hab_low",
    "11. Impact on structure?": "hab_structure",
    "12. Effect on threatened flora?": "hab_flora",

    // Environmental - Fauna
    "13. Effect on threatened fauna?": "fauna_threatened",
    "14. Effect on non-threatened fauna?": "fauna_non_threatened",
    "15. Benefits fauna?": "fauna_no_benefit",
    "16. Injurious to fauna?": "fauna_injurious",

    // Environmental - Pest Animal
    "17. Food source to pests?": "pest_food",
    "18. Provides harbor?": "pest_harbor",

    // Agricultural
    "19. Impact yield?": "ag_yield",
    "20. Impact quality?": "ag_quality",
    "21. Affect land value?": "ag_land_value",
    "22. Change land use?": "ag_land_use",
    "23. Increase harvest costs?": "ag_harvest_costs",
    "24. Disease host/vector?": "ag_disease",

    // Invasiveness (Mapping to new IDs based on DB content)
    "Germination requirements?": "inv_germination",
    "Establishment requirements?": "inv_establishment",
    "How much disturbance is required?": "inv_disturbance",
    "Life form?": "inv_life_form",
    "Normal growth rate?": "inv_growth_rate",
    "Stress tolerance to frost, drought, w/logg, sal. etc?": "inv_stress_tolerance",
    "Reproductive system": "inv_repro_system",
    "Reproductive period?": "inv_repro_period",
    "Time to reproductive maturity?": "inv_maturity_time",
    "Number of propagules produced?": "inv_propagules_count",
    "Propagule longevity?": "inv_propagule_longevity",
    "Allelopathic properties?": "inv_allelopathic",
    "Number of mechanisms?": "inv_mechanisms_count",
    "How far do they disperse?": "inv_dispersal_distance",
    "Tolerates herb pressure?": "inv_herb_pressure"
};

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

const exportData = {};

db.serialize(() => {
    // Get all assessments joined with weed names
    const query = `
        SELECT w.common_name, a.type, a.question, a.rating, a.confidence
        FROM assessments a
        JOIN weeds w ON a.weed_id = w.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) throw err;

        rows.forEach(row => {
            const weedName = row.common_name;
            const type = row.type; // 'impact' or 'invasiveness'
            const questionText = row.question;
            const rating = row.rating;
            const confidence = row.confidence;

            // Initialize weed object
            if (!exportData[weedName]) {
                exportData[weedName] = {
                    impact: {},
                    invasiveness: {},
                    notes: "Imported from database."
                };
            }

            // Map question to ID
            const id = QUESTION_MAPPING[questionText];
            if (id) {
                // Determine target object (impact or invasiveness)
                // Note: The DB 'type' column matches our keys 'impact' and 'invasiveness'
                if (exportData[weedName][type]) {
                    exportData[weedName][type][id] = {
                        rating: rating,
                        confidence: confidence
                    };
                }
            } else {
                // Log unmapped questions just in case
                // console.warn(`Unmapped question: "${questionText}"`);
            }
        });

        // Write to file
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
        console.log(`Exported data for ${Object.keys(exportData).length} weeds to ${outputPath}`);
    });
});

db.close();
