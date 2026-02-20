
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'weeds.db');
const OUTPUT_PATH = path.join(__dirname, 'src', 'data', 'weed_assessments.json');

// Mapping Definitions
const INVASIVENESS_MAP = {
    'germination': 'inv_germination',
    'establishment': 'inv_establishment',
    'disturbance': 'inv_disturbance',
    'life form': 'inv_life_form',
    'allelopathic': 'inv_allelopathic',
    'herb pressure': 'inv_herb_pressure',
    'growth rate': 'inv_growth_rate',
    'stress tolerance': 'inv_stress_tolerance',
    'reproductive system': 'inv_repro_system',
    'propagules produced': 'inv_propagules_count',
    'propagule longevity': 'inv_propagule_longevity',
    'reproductive period': 'inv_repro_period',
    'reproductive maturity': 'inv_maturity_time',
    'number of mechanisms': 'inv_mechanisms_count',
    'far do they disperse': 'inv_dispersal_distance'
};

const IMPACT_MAP = {
    'restrict human access': 'social_access',
    'reduce tourism': 'social_tourism',
    'injurious to people': 'social_injurious',
    'damage to cultural': 'social_cultural',
    'impact flow': 'env_flow',
    'impact water quality': 'env_water',
    'increase soil erosion': 'env_erosion',
    'reduce biomass': 'env_biomass',
    'change fire regime': 'env_fire',
    'high value evc': 'hab_high',
    'medium value evc': 'hab_med',
    'low value evc': 'hab_low',
    'impact on structure': 'hab_structure',
    'threatened flora': 'hab_flora',
    'threatened fauna': 'fauna_threatened',
    'non-threatened fauna': 'fauna_non_threatened',
    'benefits fauna': 'fauna_no_benefit',
    'injurious to fauna': 'fauna_injurious',
    'food source to pests': 'pest_food',
    'provides harbor': 'pest_harbor',
    'impact yield': 'ag_yield',
    'impact quality': 'ag_quality',
    'affect land value': 'ag_land_value',
    'change land use': 'ag_land_use',
    'increase harvest costs': 'ag_harvest_costs',
    'disease host': 'ag_disease'
};

const db = new sqlite3.Database(DB_PATH);

db.all(`
    SELECT 
        w.common_name,
        w.url, 
        a.type, 
        a.question, 
        a.comments, 
        a.rating, 
        a.confidence 
    FROM assessments a
    JOIN weeds w ON a.weed_id = w.id
`, (err, rows) => {
    if (err) {
        console.error("Error querying database:", err);
        return;
    }

    const data = {};

    rows.forEach(row => {
        const name = row.common_name.trim(); // Normalize name
        if (!data[name]) {
            data[name] = { invasiveness: {}, impact: {}, sourceUrl: row.url };
        }

        const questionLower = row.question.toLowerCase();
        let mappedId = null;

        if (row.type === 'invasiveness') {
            for (const [key, id] of Object.entries(INVASIVENESS_MAP)) {
                if (questionLower.includes(key)) {
                    mappedId = id;
                    break;
                }
            }
        } else if (row.type === 'impact') {
            for (const [key, id] of Object.entries(IMPACT_MAP)) {
                if (questionLower.includes(key)) {
                    mappedId = id;
                    break;
                }
            }
        }

        if (mappedId) {
            data[name][row.type][mappedId] = {
                question: row.question,
                comments: row.comments,
                rating: row.rating,
                confidence: row.confidence
            };
        } else {
            // console.warn(`Could not map question: "${row.question}" for ${name}`);
        }
    });

    // Ensure output directory exists
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`Exported assessments for ${Object.keys(data).length} weeds to ${OUTPUT_PATH}`);
});

db.close();
