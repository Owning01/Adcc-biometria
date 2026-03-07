import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function testSingle(id) {
    try {
        const res = await fetch(`https://adccanning.com.ar/api/partido/${id}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const detail = await res.json();
        console.log(JSON.stringify(detail.partido, null, 2));
    } catch (err) {
        console.error(err);
    }
}
testSingle(35631);
