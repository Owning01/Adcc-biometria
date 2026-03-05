import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic env loader for scripts
import { config } from 'dotenv';
config();

const API_KEY = process.env.VITE_ADCC_TOKEN || '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';
const BASE_URL = 'https://adccanning.com.ar/api';
const PHOTO_DIR = path.join(__dirname, '..', 'jugadores_fotos');

// Ensure directory exists
if (!fs.existsSync(PHOTO_DIR)) {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

async function fetchAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${endpoint}`;
        const options = {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response from ${endpoint}: ${data.substring(0, 100)}`));
                }
            });
        }).on('error', reject);
    });
}

async function downloadImage(url, dni) {
    if (!url || !dni) return;
    const dest = path.join(PHOTO_DIR, `${dni}.jpg`);

    // Skip if already exists
    if (fs.existsSync(dest)) return;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Error downloading image for DNI ${dni}: Status ${res.statusCode}`);
                resolve();
                return;
            }
            const fileStream = fs.createWriteStream(dest);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Downloaded: ${dni}.jpg`);
                resolve();
            });
        }).on('error', (err) => {
            console.error(`Error downloading entry for DNI ${dni}: ${err.message}`);
            resolve();
        });
    });
}

async function main() {
    console.log('--- Iniciando descarga masiva de fotos ADCC ---');
    try {
        const matchesData = await fetchAPI('/partidos');
        const matches = matchesData.data;
        console.log(`Se encontraron ${matches.length} partidos.`);

        const playersMap = new Map();

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            process.stdout.write(`\rProcesando partido ${i + 1}/${matches.length}: ${match.local_nombre} vs ${match.visitante_nombre}...`);

            try {
                const detail = await fetchAPI(`/partido/${match.id}`);
                const players = [...detail.equipo_local, ...detail.equipo_visitante];

                players.forEach(p => {
                    const imageUrl = p.imagen_url || p.imagen;
                    if (p.dni && imageUrl && imageUrl.startsWith('http')) {
                        playersMap.set(String(p.dni), imageUrl);
                    }
                });
            } catch (err) {
                console.error(`\nError en partido ${match.id}: ${err.message}`);
            }
        }

        console.log(`\nTotal de jugadores únicos con foto encontrados: ${playersMap.size}`);

        const playerEntries = Array.from(playersMap.entries());
        for (let i = 0; i < playerEntries.length; i++) {
            const [dni, url] = playerEntries[i];
            process.stdout.write(`\rDescargando foto ${i + 1}/${playersMap.size}: ${dni}.jpg...`);
            await downloadImage(url, dni);
        }

        console.log('\n--- Proceso finalizado con éxito ---');
        console.log(`Las fotos están en: ${PHOTO_DIR}`);

    } catch (err) {
        console.error('Error fatal en el script:', err);
    }
}

main();
