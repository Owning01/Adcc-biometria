
const API_BASE = 'https://adccanning.com.ar/api';
const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d d1e0f7a6b5c4d3e2f1'.replace(/\s+/g, '');

async function test() {
    console.log("Fetching matches...");
    try {
        const response = await fetch(`${API_BASE}/partidos?page=1`, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        console.log("Response structure keys:", Object.keys(data));

        // Handle different response structures
        const matches = data.data || data;
        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            console.error("No matches found in response:", data);
            return;
        }

        const match = matches[0];
        console.log("Using Match ID:", match.id);

        const payload = {
            partido_id: match.id,
            res_local: 0,
            res_local_p: 0,
            res_visitante: 0,
            res_visitante_p: 0,
            arbitro1: "Arbitro Test",
            arbitro2: "",
            arbitro3: "",
            informearbitro: "Prueba de envio desde sistema biometrico",
            equipo_local: [],
            equipo_visitante: []
        };

        console.log("Submitting report...");
        const submitResponse = await fetch(`${API_BASE}/cargaPlanillaPartido`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await submitResponse.json();
        console.log("API Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
