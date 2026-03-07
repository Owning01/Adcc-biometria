import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function testPlayerKeys(id) {
    try {
        const res = await fetch(`https://adccanning.com.ar/api/partido/${id}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const detail = await res.json();
        if (detail.equipo_local && detail.equipo_local.length > 0) {
            console.log("Player keys:", Object.keys(detail.equipo_local[0]));
            // Also print values for a few keys that might look like category
            const p = detail.equipo_local[0];
            for (const key of Object.keys(p)) {
                if (key.toLowerCase().includes('cat') || key.toLowerCase().includes('liga') || key.toLowerCase().includes('equipo')) {
                    console.log(`${key}: ${p[key]}`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}
testPlayerKeys(35631);
