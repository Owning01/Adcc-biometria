import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function test() {
    try {
        const res = await fetch('https://adccanning.com.ar/api/partidos?page=1', {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const data = await res.json();

        if (data.data && data.data.length > 0) {
            const partidoId = data.data[0].id;
            const detailRes = await fetch(`https://adccanning.com.ar/api/partido/${partidoId}`, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
            });
            const detail = await detailRes.json();

            console.log("Local team sample player keys:", Object.keys(detail.equipo_local[0]));
            console.log("Local team sample player:", detail.equipo_local[0]);
        }
    } catch (err) {
        console.error(err);
    }
}
test();
