/**
 * download_matches.mjs
 * Descarga partidos de la API de ADCC y guarda el resultado en data/matches_export.json
 * 
 * Uso: node scripts/download_matches.mjs
 * 
 * Filtros:
 *   - Fecha >= 2026-02-01
 *   - IDs prioritarios siempre incluidos: 35631, 35624, 35617, 35610
 */
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env') });
const TOKEN = process.env.VITE_ADCC_TOKEN;

if (!TOKEN) {
    console.error('❌ VITE_ADCC_TOKEN no encontrado en .env');
    process.exit(1);
}

const API_BASE = 'https://adccanning.com.ar/api';
const MIN_DATE = '2026-02-01';
const PRIORITY_IDS = [35631, 35624, 35617, 35610];

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, description, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
            });

            if (res.status === 429) {
                const wait = 15000;
                console.log(`   ⏳ [429] Rate limit en ${description}. Esperando ${wait / 1000}s (intento ${attempt}/${maxRetries})...`);
                await sleep(wait);
                continue;
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            return await res.json();
        } catch (err) {
            if (attempt === maxRetries) throw err;
            console.log(`   ⚠️ Error en ${description}: ${err.message}. Reintentando...`);
            await sleep(3000);
        }
    }
}

const normalizeImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    return `https://adccanning.com.ar/img/foto/${cleanUrl}`;
};

function isMatchInScope(match) {
    if (!match.dia) return true;
    const dateStr = match.dia.split(' ')[0] || '';
    return dateStr >= '2026-01-01'; // Broad filter to catch potential matches
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀 Descarga de partidos ADCC');
    console.log(`   Filtro: fecha >= ${MIN_DATE}`);
    console.log(`   IDs prioritarios: ${PRIORITY_IDS.join(', ')}\n`);

    // Paso 1: Obtener TODOS los partidos paginando
    let allMatches = [];
    let page = 1;
    let lastPage = 1;

    do {
        console.log(`📄 Obteniendo página ${page}${lastPage > 1 ? ` de ${lastPage}` : ''}...`);
        const res = await fetchWithRetry(`${API_BASE}/partidos?page=${page}`, `Página ${page}`);
        const pageMatches = res.data || [];
        lastPage = res.last_page || 1;
        allMatches = allMatches.concat(pageMatches);
        page++;
        await sleep(300);
    } while (page <= lastPage);

    console.log(`\n📋 Total de partidos en API: ${allMatches.length}`);

    // Paso 2: Filtrar por fecha + incluir IDs prioritarios
    const prioritySet = new Set(PRIORITY_IDS);
    const scopedMatches = allMatches.filter(m => isMatchInScope(m) || prioritySet.has(m.id));

    console.log(`✅ Partidos en scope (fecha >= ${MIN_DATE} + prioritarios): ${scopedMatches.length}`);

    // Verificar que los prioritarios están presentes
    const foundPriority = PRIORITY_IDS.filter(id => scopedMatches.some(m => m.id === id));
    const missingPriority = PRIORITY_IDS.filter(id => !scopedMatches.some(m => m.id === id));

    if (foundPriority.length > 0) {
        console.log(`   ✅ IDs prioritarios encontrados: ${foundPriority.join(', ')}`);
    }
    if (missingPriority.length > 0) {
        console.log(`   ⚠️ IDs prioritarios NO encontrados en la API: ${missingPriority.join(', ')}`);
    }

    // Paso 3: Obtener detalle de cada partido y filtrar por fecha REAL
    const details = {};
    const finalScopedMatches = [];
    const BATCH_SIZE = 3;

    console.log(`\n🔍 Verificando detalles para ${scopedMatches.length} candidatos...`);

    for (let i = 0; i < scopedMatches.length; i += BATCH_SIZE) {
        const batch = scopedMatches.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (match) => {
            const idx = scopedMatches.indexOf(match) + 1;

            try {
                const detail = await fetchWithRetry(
                    `${API_BASE}/partido/${match.id}`,
                    `Detalle ${match.id}`
                );

                const realDate = detail.partido?.dia?.split(' ')[0] || match.dia?.split(' ')[0] || '';
                const isPriority = prioritySet.has(match.id);

                if (realDate >= MIN_DATE || isPriority) {
                    // Normalizar fotos de jugadores en el detalle
                    if (detail.equipo_local) {
                        detail.equipo_local.forEach(p => {
                            p.foto_norm = normalizeImageUrl(p.imagen || p.foto || p.imagen_url);
                        });
                    }
                    if (detail.equipo_visitante) {
                        detail.equipo_visitante.forEach(p => {
                            p.foto_norm = normalizeImageUrl(p.imagen || p.foto || p.imagen_url);
                        });
                    }

                    details[match.id] = detail;
                    finalScopedMatches.push(match);

                    const label = `${match.local_nombre} vs ${match.visitante_nombre}`;
                    console.log(`⚽ [${idx}/${scopedMatches.length}] ID ${match.id}: ${label} (Fecha: ${realDate}) ✅`);
                }
            } catch (err) {
                console.log(`   ❌ Error en partido ${match.id}: ${err.message}`);
            }
        }));

        await sleep(500);
    }

    // Paso 4: Guardar resultado
    const output = {
        exportedAt: new Date().toISOString(),
        minDate: MIN_DATE,
        priorityIds: PRIORITY_IDS,
        totalInApi: allMatches.length,
        totalInScope: finalScopedMatches.length,
        totalWithDetails: Object.keys(details).length,
        matches: finalScopedMatches,
        details
    };

    const dataDir = join(ROOT, 'data');
    try { mkdirSync(dataDir, { recursive: true }); } catch (_) { }

    const outputPath = join(dataDir, 'matches_export.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n🏁 Exportación completada.`);
    console.log(`   📁 Archivo: ${outputPath}`);
    console.log(`   📊 Partidos: ${finalScopedMatches.length} | Con detalle: ${Object.keys(details).length}`);
}

main().catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
});
