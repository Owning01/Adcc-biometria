const axios = require('axios');

const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const BASE_URL = 'http://localhost:3000/api-adcc/api';

async function testVariation(method, url, data = null) {
    try {
        console.log(`Testing ${method} ${url}...`);
        const response = await axios({
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            data
        });
        console.log(`✅ Success (${response.status})`);
        return true;
    } catch (error) {
        if (error.response) {
            console.log(`❌ Failed (${error.response.status}): ${JSON.stringify(error.response.data).substring(0, 100)}`);
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
        return false;
    }
}

async function runTests() {
    const playerId = 1322; // Use a known ID
    const faceApi = "test_descriptor";

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
}

runTests();
