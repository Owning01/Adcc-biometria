import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function searchForComplexCategories() {
    try {
        const res = await fetch('https://adccanning.com.ar/api/partidos?page=1', {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const matches = data.data || [];

        for (const m of matches) {
            // Check for fields that might contain category info
            const keys = Object.keys(m);
            const catFields = keys.filter(k => k.toLowerCase().includes('cat'));

            // If there's more than one cat field, or if categoria looks complex
            if (catFields.length > 1 || (m.categoria && m.categoria.includes('v'))) {
                console.log(`Match ${m.id} has fields:`, catFields.map(f => `${f}=${m[f]}`));
            }
        }
        console.log("Search finished.");
    } catch (err) {
        console.error(err);
    }
}
searchForComplexCategories();
