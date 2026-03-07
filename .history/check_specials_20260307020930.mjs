import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function checkSpecials(ids) {
    for (const id of ids) {
        console.log(`\n=== Match ${id} ===`);
        try {
            const res = await fetch(`https://adccanning.com.ar/api/partido/${id}`, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
            });
            const detail = await res.json();
            console.log("Partido keys:", Object.keys(detail.partido));
            console.log("Categoria:", detail.partido.categoria);
            // Check for any field containing 'cat' case insensitive
            for (const key of Object.keys(detail.partido)) {
                if (key.toLowerCase().includes('cat')) {
                    console.log(`Found cat field: ${key} = ${detail.partido[key]}`);
                }
            }
        } catch (err) {
            console.log(`Error ${id}: ${err.message}`);
        }
    }
}
checkSpecials([35631, 35624, 35617, 35610]);
