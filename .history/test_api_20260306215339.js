
const API_BASE = 'https://adccanning.com.ar/api';
const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';

async function test() {
    const id = 1000;
    console.log(`Fetching detail for match ${id}...`);
    try {
        const response = await fetch(`${API_BASE}/partido/${id}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
        });
        const data = await response.json();

        const payload = {
            partido_id: id,
            res_local: 1,
            res_local_p: 0,
            res_visitante: 1,
            res_visitante_p: 0,
            arbitro1: "Test Arbitro 1",
            arbitro2: "Test Arbitro 2",
            arbitro3: "",
            informearbitro: "Prueba de envio tecnico completa",
            equipo_local: [
                {
                    jleid: data.equipo_local[0].jleid,
                    camiseta: 1,
                    gf: 1,
                    gc: 0,
                    amarilla: 0,
                    dobleamarilla: 0,
                    roja: 0,
                    jugo: 1
                }
            ],
            equipo_visitante: [
                {
                    jleid: data.equipo_visitante[0].jleid,
                    camiseta: 1,
                    gf: 1,
                    gc: 0,
                    amarilla: 1,
                    dobleamarilla: 0,
                    roja: 0,
                    jugo: 1
                }
            ]
        };

        console.log("Submitting test report for match", id);
        const submitRes = await fetch(`${API_BASE}/cargaPlanillaPartido`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await submitRes.json();
        console.log("Submission Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
