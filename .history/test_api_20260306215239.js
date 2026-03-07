
const API_BASE = 'https://adccanning.com.ar/api';
// Use the token string derived from hex dump exactly
const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';

async function test() {
    console.log("Testing direct POST submission...");
    const payload = {
        partido_id: 999999, // Dummy ID
        res_local: 0,
        res_local_p: 0,
        res_visitante: 0,
        res_visitante_p: 0,
        arbitro1: "Test",
        arbitro2: "",
        arbitro3: "",
        informearbitro: "Prueba tecnica de token",
        equipo_local: [],
        equipo_visitante: []
    };

    try {
        const response = await fetch(`${API_BASE}/cargaPlanillaPartido`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        console.log("HTTP Status:", status);
        const data = await response.json();
        console.log("API Result:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
