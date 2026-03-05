const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.VITE_ADCC_TOKEN || '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const URL = 'https://adccanning.com.ar/api/jugadores';

async function testApi() {
    console.log('Testing API with Token:', TOKEN.substring(0, 10) + '...');
    try {
        const res = await fetch(URL, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json'
            }
        });

        console.log('Status:', res.status);
        console.log('Status Text:', res.statusText);

        if (res.ok) {
            const data = await res.json();
            console.log('Success! Received', Array.isArray(data) ? data.length : 'object', 'items.');
            if (Array.isArray(data) && data.length > 0) {
                console.log('First Item Sample:', JSON.stringify(data[0], null, 2));
            } else {
                console.log('Response body:', JSON.stringify(data, null, 2));
            }
        } else {
            const text = await res.text();
            console.log('Error Body:', text);
        }
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

testApi();
