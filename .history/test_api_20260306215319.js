
const API_BASE = 'https://adccanning.com.ar/api';
const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';

async function test() {
    // Try a few possible recent IDs
    const idsToTry = [1000, 1500, 2000, 2012, 500];

    for (const id of idsToTry) {
        console.log(`Fetching detail for match ${id}...`);
        try {
            const response = await fetch(`${API_BASE}/partido/${id}`, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                console.log(`SUCCESS for ID ${id}!`);
                console.log("Match:", data.partido.local_nombre, "vs", data.partido.visitante_nombre);
                console.log("Players Local:", data.equipo_local?.length || 0);

                // If we found one, let's try to submit a partial report
                if (data.equipo_local && data.equipo_local.length > 0) {
                    const payload = {
                        partido_id: id,
                        res_local: 0,
                        res_local_p: 0,
                        res_visitante: 0,
                        res_visitante_p: 0,
                        arbitro1: "Test Arbitro",
                        arbitro2: "",
                        arbitro3: "",
                        informearbitro: "Prueba de envio tecnico",
                        equipo_local: [
                            {
                                jleid: data.equipo_local[0].jleid,
                                camiseta: 10,
                                gf: 0,
                                gc: 0,
                                amarilla: 0,
                                dobleamarilla: 0,
                                roja: 0,
                                jugo: 1
                            }
                        ],
                        equipo_visitante: []
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
                    return; // Stop after first success
                }
            } else {
                console.log(`Failed for ID ${id}: HTTP`, response.status);
            }
        } catch (e) {
            console.error(`Error for ID ${id}:`, e.message);
        }
    }
}

test();
