import { fetchADCCMatches, fetchADCCMatchDetail } from './adccService';
import { saveMatchWithId, saveTournamentWithId, getTournament } from './matchesService';
import { saveTeam, getTeam } from './teamsService';
import { compressAndUploadLogo } from './imageStorageService';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

/** Fecha mínima: 2026-03-01 */
const MIN_DATE = '2026-03-01';

function isMatchInScope(match: any): boolean {
    const dateStr = match.dia?.split(' ')[0] || '';
    // Strict requirement: 2026 AND from March onwards
    return dateStr.startsWith('2026-') && dateStr >= MIN_DATE;
}

/**
 * Sincronización manual de partidos desde la API de ADCC.
 * Pagina TODAS las páginas, filtra solo partidos con fecha >= 2026-03-01.
 * Llama a onProgress con mensajes de estado en tiempo real.
 */
export const syncMatchDayData = async (options: {
    onProgress?: (msg: string) => void;
    userRole?: string;
} = {}) => {
    const { onProgress, userRole } = options;
    const isPublic = userRole === 'usuario';

    const log = (msg: string) => {
        if (!isPublic) console.log(`[Sync] ${msg}`);
        if (onProgress) onProgress(msg);
    };

    /**
     * Helper to retry on 429 (Rate Limit)
     */
    const withRetry = async <T>(fn: () => Promise<T>, description: string): Promise<T> => {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                return await fn();
            } catch (error: any) {
                const isRateLimit = error?.message?.includes('429') || error?.message?.includes('Too Many Attempts');

                if (isRateLimit && attempts < maxAttempts - 1) {
                    attempts++;
                    log(`⏳ Error 429 (Límite de peticiones) en ${description}.`);
                    log(`   Esperando 15 segundos antes de reintentar (Intento ${attempts}/${maxAttempts})...`);
                    await new Promise(r => setTimeout(r, 15000));
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Excedido número de reintentos para ${description}`);
    };

    log('🚀 Iniciando sincronización ADCC...');

    try {
        // ── Paso 1: Recolectar todos los partidos de todas las páginas ──────────
        let allMatches: any[] = [];
        let page = 1;
        let lastPage = 1;

        do {
            log(`📄 Obteniendo página ${page}${lastPage > 1 ? ` de ${lastPage}` : ''}...`);
            const res = await withRetry(() => fetchADCCMatches(page), `Página ${page}`);
            const pageMatches = res.data || [];
            lastPage = res.last_page || 1;
            allMatches = allMatches.concat(pageMatches);
            page++;
            // Pequeña pausa entre páginas
            await new Promise(r => setTimeout(r, 200));
        } while (page <= lastPage);

        log(`📋 Total de partidos en API: ${allMatches.length}`);

        // ── Paso 2: Filtrar por fecha ──────────────────────────────────────────
        const scopedMatches = allMatches.filter(isMatchInScope);
        log(`✅ Partidos en rango (>= ${MIN_DATE}): ${scopedMatches.length}`);

        if (scopedMatches.length === 0) {
            log('⚠️ No hay partidos dentro del rango de fechas. Sync completada.');
            return true;
        }

        // ── HELPERS PARA PROCESAMIENTO ───────────────────────────────────────
        /** Equipos */
        const processTeam = async (name: string, escudo: string, slug: string, category: string) => {
            if (slug === 'FL') return;
            const teamId = name.toLowerCase().replace(/\s+/g, '-');
            const team = await getTeam(teamId);
            let logoUrl = team?.logoUrl;

            if (!logoUrl && escudo && !isPublic) {
                try { logoUrl = await compressAndUploadLogo(escudo, teamId); } catch (_) { }
            }

            await saveTeam({
                id: teamId,
                name,
                adccLogoUrl: escudo,
                logoUrl: logoUrl || undefined,
                category: category,
            });
        };

        /** Jugadores / biometría */
        const processPlayers = async (players: any[], teamName: string, category: string) => {
            const playersToProcess = players.filter(p => p.face_api);
            if (playersToProcess.length === 0) return;

            await Promise.all(playersToProcess.map(async (p) => {
                const playerId = String(p.jleid || p.id || p.dni);
                const userRef = doc(db, 'users', playerId);

                const payload: any = {
                    id: playerId,
                    jleid: p.jleid,
                    dni: String(p.dni),
                    nombre: p.nombre,
                    apellido: p.apellido,
                    name: `${p.nombre} ${p.apellido}`,
                    photo: p.imagen || p.foto || p.imagen_url || '',
                    face_api: p.face_api,
                    updatedAt: new Date().toISOString(),
                    registered: true,
                    status: 'habilitado',
                    team: teamName,
                    category: category,
                    categories: arrayUnion(category),
                };

                await setDoc(userRef, payload, { merge: true });
            }));
        };

        // ── Paso 3: Procesar partidos en paralelo controlado ──────────────────
        let processed = 0;
        let errors = 0;

        // Procesamos en grupos de 3 para no saturar la API ni Firestore simultáneamente
        const BATCH_SIZE = 3;
        for (let i = 0; i < scopedMatches.length; i += BATCH_SIZE) {
            const batch = scopedMatches.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (match) => {
                const currentIdx = i + batch.indexOf(match) + 1;
                const label = `${match.local_nombre} vs ${match.visitante_nombre}`;
                log(`⚽ [${currentIdx}/${scopedMatches.length}] ${label}`);

                try {
                    // 3a. Detalle del partido (planteles) y Procesar Equipos en paralelo
                    const [detail] = await Promise.all([
                        withRetry(() => fetchADCCMatchDetail(match.id), `Detalle Partido ${match.id}`),
                        (async () => {
                            if (match.local_slug !== 'FL') await processTeam(match.local_nombre, match.local_escudo, match.local_slug, match.categoria);
                            if (match.visitante_slug !== 'FL') await processTeam(match.visitante_nombre, match.visitante_escudo, match.visitante_slug, match.categoria);
                        })()
                    ]);

                    // 3b. Torneo
                    const tournamentCat = match.categoria || 'General';
                    const leagueName = match.liga || 'General';
                    const tournamentId = `${leagueName}-${tournamentCat}`.toLowerCase().replace(/\s+/g, '-');

                    // Guardar/actualizar torneo
                    await saveTournamentWithId(tournamentId, {
                        id: tournamentId,
                        name: `${leagueName} - ${tournamentCat}`,
                        league: leagueName,
                        category: tournamentCat,
                    });

                    // 3c. Procesar Jugadores de ambos equipos en paralelo
                    await Promise.all([
                        processPlayers(detail.equipo_local || [], match.local_nombre, tournamentCat),
                        processPlayers(detail.equipo_visitante || [], match.visitante_nombre, tournamentCat)
                    ]);

                    // 3d. Guardar partido en Firestore
                    const customMatchId = `adcc_${match.id}`;
                    const matchToSave = {
                        realId: match.id,
                        partido_id: match.id,
                        tournamentId,
                        tournamentName: `${leagueName} - ${tournamentCat}`,
                        liga: leagueName,
                        category: tournamentCat,
                        teamA: { name: match.local_nombre, logo: match.local_escudo },
                        teamB: { name: match.visitante_nombre, logo: match.visitante_escudo },
                        date: match.dia?.split(' ')[0] || '',
                        time: match.dia?.split(' ')[1]?.substring(0, 5) || '00:00',
                        status: match.estado_partido === 'Finalizado'
                            ? 'finished'
                            : match.estado_partido === 'En juego'
                                ? 'live'
                                : 'scheduled',
                        score: { a: match.res_local ?? 0, b: match.res_visitante ?? 0 },
                        playersA: (detail.equipo_local || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: p.imagen || p.foto || p.imagen_url || '',
                            status: 'suplente',
                        })),
                        playersB: (detail.equipo_visitante || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: p.imagen || p.foto || p.imagen_url || '',
                            status: 'suplente',
                        })),
                    };

                    await saveMatchWithId(customMatchId, matchToSave);
                    processed++;
                } catch (err) {
                    errors++;
                    log(`   ❌ Error en partido ${match.id}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }));

            // Pequeña pausa entre batches para dar respiro
            await new Promise(r => setTimeout(r, 100));
        }

        log(`\n🏁 Sincronización completada.`);
        log(`   ✅ Procesados: ${processed - errors} | ❌ Errores: ${errors}`);

        // Limpiar cache offline
        localStorage.removeItem('matchday_users_cache');
        localStorage.removeItem('users_cache');

        return true;
    } catch (error) {
        log(`💥 Error crítico: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
};

/**
 * @deprecated Mantiene compatibilidad con llamadas anteriores.
 */
export const syncADCCData = async (options: { userRole?: string } = {}) => {
    return await syncMatchDayData({ userRole: options.userRole });
};
