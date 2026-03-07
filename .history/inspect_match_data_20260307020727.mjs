import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

async function inspectMatches(ids) {
    for (const id of ids) {
        console.log(`\n--- Inspecting Match ID: ${id} ---`);
        try {
            const detailRes = await fetch(`https://adccanning.com.ar/api/partido/${id}`, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
            });
            const detail = await detailRes.json();

            console.log("Match Header Data:");
            console.log(JSON.stringify(detail.partido, null, 2));

            if (detail.equipo_local && detail.equipo_local.length > 0) {
                console.log("\nLocal Team Sample Player Keys:", Object.keys(detail.equipo_local[0]));
                console.log("Local Team Sample Player Category:", detail.equipo_local[0].categoria);
                // Check if all players in local team have the same category
                const localCats = [...new Set(detail.equipo_local.map(p => p.categoria))];
                console.log("Unique Local Player Categories:", localCats);
            }

            if (detail.equipo_visitante && detail.equipo_visitante.length > 0) {
                console.log("\nVisitor Team Sample Player Category:", detail.equipo_visitante[0].categoria);
                const visitorCats = [...new Set(detail.equipo_visitante.map(p => p.categoria))];
                console.log("Unique Visitor Player Categories:", visitorCats);
            }

        } catch (err) {
            console.error(`Error inspecting match ${id}:`, err.message);
        }
    }
}

inspectMatches([35631, 35624, 35617, 35610]);
