const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.VITE_ADCC_TOKEN || '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const BASE_URL = 'https://adccanning.com.ar/api';

const VARIATIONS = [
    { url: '/jugadores', method: 'POST', body: { id: 1322, face_api: 'test' } },
    { url: '/jugadores/', method: 'POST', body: { id: 1322, face_api: 'test' } },
    { url: '/jugador', method: 'POST', body: { id: 1322, face_api: 'test' } },
    { url: '/jugadores/1322', method: 'POST', body: { face_api: 'test' } },
    { url: '/jugadores/1322', method: 'PATCH', body: { face_api: 'test' } },
    { url: '/jugador/1322', method: 'POST', body: { face_api: 'test' } },
    { url: '/biometria', method: 'POST', body: { id: 1322, face_api: 'test' } },
    { url: '/registroBiometrico', method: 'POST', body: { id: 1322, face_api: 'test' } },
];

async function testVariations() {
    for (const v of VARIATIONS) {
        console.log(`Testing ${v.method} ${v.url}...`);
        try {
            const res = await fetch(`${BASE_URL}${v.url}`, {
                method: v.method,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(v.body)
            });
            console.log(`Status: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.log(`Body: ${text.substring(0, 100)}...`);
            console.log('---');
            if (res.status === 200 || res.status === 201 || res.status === 204) {
                console.log('FOUND IT!');
                // break;
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }
}

testVariations();
