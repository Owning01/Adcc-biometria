
const TEST_TOKEN = 'Bearer 9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';

async function testApi() {
    console.log("🚀 Iniciando prueba de API ADCC...");

    // Payload de ejemplo (mínimo requerido basado en la lógica de MatchDetail)
    const payload = {
        partido_id: 1234, // ID de prueba
        res_local: 2,
        res_local_p: 0,
        res_visitante: 1,
        res_visitante_p: 0,
        arbitro1: "Test Arbitro 1",
        arbitro2: "Test Arbitro 2",
        arbitro3: "",
        informearbitro: "Prueba de conexión desde script de test.",
        equipo_local: [
            { jleid: 123, gf: 2, gc: 0, amarilla: 1, dobleamarilla: 0, roja: 0, jugo: 1 }
        ],
        equipo_visitante: [
            { jleid: 456, gf: 1, gc: 0, amarilla: 0, dobleamarilla: 0, roja: 1, jugo: 1 }
        ]
    };

    try {
        // Usamos la URL directa ya que el test corre fuera del navegador (no necesita proxy CORS)
        const response = await fetch('https://adccanning.com.ar/api/cargaPlanillaPartido', {
            method: 'POST',
            headers: {
                'Authorization': TEST_TOKEN,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log("Status:", response.status);
        const data = await response.text();
        console.log("Resultado:", data);

        if (response.ok) {
            console.log("✅ API respondió correctamente.");
        } else {
            console.log("❌ API devolvió un error.");
        }
    } catch (error) {
        console.error("💥 Error de conexión:", error.message);
    }
}

testApi();
