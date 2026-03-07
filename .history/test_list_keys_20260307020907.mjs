import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function testListKeys() {
    try {
        const res = await fetch('https://adccanning.com.ar/api/partidos?page=1', {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            console.log("List Match keys:", Object.keys(data.data[0]));
            console.log(JSON.stringify(data.data[0], null, 2));
        }
    } catch (err) {
        console.error(err);
    }
}
testListKeys();
