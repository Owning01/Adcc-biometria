import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.VITE_ADCC_TOKEN;

async function testApi() {
    // Test torneos page 1
    try {
        const res = await fetch('https://adccanning.com.ar/api/partidos?page=1', {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json'
            }
        });

        const data = await res.json();
        console.log("Matches data structure:");
        console.log(`Total records: ${data.total}, Last page: ${data.last_page}`);
        if (data.data && data.data.length > 0) {
            console.log("Sample match ID:", data.data[0].id);

            // Fetch detail
            const resDetail = await fetch(`https://adccanning.com.ar/api/partido/${data.data[0].id}`, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            const detail = await resDetail.json();
            console.log("Match detail structure:");
            console.log(Object.keys(detail));
            console.log("Local team sample player:", detail.equipo_local ? detail.equipo_local[0] : 'no players');
        }
    } catch (e) {
        console.error(e);
    }
}

testApi();
