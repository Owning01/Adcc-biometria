const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const BASE_URL = 'http://localhost:3000/api-adcc/api';

async function testVariation(method, url, data = null, extraHeaders = {}) {
    try {
        console.log(`Testing ${method} ${url} with headers ${JSON.stringify(extraHeaders)}...`);
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders
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

    console.log("--- Starting Advanced API Discovery ---");

    // Variation 7: POST /jugadores with X-HTTP-Method-Override: PUT
    await testVariation('POST', '/jugadores', { id: playerId, face_api: faceApi }, { 'X-HTTP-Method-Override': 'PUT' });

    // Variation 8: POST /jugadores/{id} with X-HTTP-Method-Override: PUT
    await testVariation('POST', `/jugadores/${playerId}`, { face_api: faceApi }, { 'X-HTTP-Method-Override': 'PUT' });

    // Variation 9: POST /jugadores with _method in body
    await testVariation('POST', '/jugadores', { id: playerId, face_api: faceApi, _method: 'PUT' });

    // Variation 10: POST /jugadores/1322/biometria
    await testVariation('POST', `/jugadores/${playerId}/biometria`, { face_api: faceApi });

    // Variation 11: POST /biometria
    await testVariation('POST', '/biometria', { id: playerId, face_api: faceApi });

    console.log("--- End of Advanced Tests ---");
}

runTests();
