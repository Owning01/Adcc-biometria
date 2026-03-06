const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const BASE_URL = 'http://localhost:3000/api-adcc/api';

async function testVariation(method, url, data = null) {
    try {
        console.log(`Testing ${method} ${url}...`);
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${BASE_URL}${url}`, options);
        const responseText = await response.text();

        if (response.ok) {
            console.log(`✅ Success (${response.status}): ${responseText.substring(0, 100)}`);
            return true;
        } else {
            console.log(`❌ Failed (${response.status}): ${responseText.substring(0, 100)}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    const playerId = 1322;
    const faceApi = "test_descriptor_skip_me";

    console.log("--- Starting API Discovery ---");

    // Variation 1: POST /jugadores
    await testVariation('POST', '/jugadores', { id: playerId, face_api: faceApi });

    // Variation 2: PUT /jugadores/{id}
    await testVariation('PUT', `/jugadores/${playerId}`, { face_api: faceApi });

    // Variation 3: PATCH /jugadores/{id}
    await testVariation('PATCH', `/jugadores/${playerId}`, { face_api: faceApi });

    // Variation 4: POST /jugadores/{id}
    await testVariation('POST', `/jugadores/${playerId}`, { face_api: faceApi });

    // Variation 5: POST /registroBiometrico (Old one)
    await testVariation('POST', '/registroBiometrico', { idjugador: playerId, face_api: faceApi });

    // Variation 6: POST /jugadores con x-www-form-urlencoded
    console.log("Testing POST /jugadores (form-urlencoded)...");
    try {
        const res = await fetch(`${BASE_URL}/jugadores`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `id=${playerId}&face_api=${faceApi}`
        });
        console.log(`${res.ok ? '✅' : '❌'} Result: ${res.status}`);
    } catch (e) { console.log("Error: " + e.message); }

    console.log("--- End of Tests ---");
}

runTests();
