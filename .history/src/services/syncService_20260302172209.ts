import { fetchADCCMatches, fetchADCCMatchDetail } from './adccService';
import { saveMatchWithId } from './matchesService';
import { saveTeam, getTeam } from './teamsService';
import { compressAndUploadLogo } from './imageStorageService';

/**
 * Sincroniza automáticamente los partidos y equipos desde la API de ADCC.
 * @param pagesToFetch - Número de páginas de partidos a consultar (default 2 para rapidez).
 */
export const syncADCCData = async (pagesToFetch: number = 2) => {
    console.log(`[Sync] Iniciando sincronización automática (${pagesToFetch} páginas)...`);

    try {
        for (let page = 1; page <= pagesToFetch; page++) {
            const matchesRes = await fetchADCCMatches(page);

            for (const match of matchesRes.data) {
                // 1. Guardar/Actualizar Equipos (Metadatos)
                const teamAId = match.local_nombre.toLowerCase().replace(/\s+/g, '-');
                const teamBId = match.visitante_nombre.toLowerCase().replace(/\s+/g, '-');

                // Procesar Team A
                let teamA = await getTeam(teamAId);
                let logoUrlA = teamA?.logoUrl;

                // Si no tiene logo local, intentar descargar y comprimir
                if (!logoUrlA && match.local_escudo) {
                    try {
                        logoUrlA = await compressAndUploadLogo(match.local_escudo, teamAId);
                    } catch (e) {
                        console.warn(`Could not sync logo for ${match.local_nombre}`, e);
                    }
                }

                await saveTeam({
                    id: teamAId,
                    name: match.local_nombre,
                    adccLogoUrl: match.local_escudo,
                    logoUrl: logoUrlA
                });

                // Procesar Team B
                let teamB = await getTeam(teamBId);
                let logoUrlB = teamB?.logoUrl;

                // Si no tiene logo local, intentar descargar y comprimir
                if (!logoUrlB && match.visitante_escudo) {
                    try {
                        logoUrlB = await compressAndUploadLogo(match.visitante_escudo, teamBId);
                    } catch (e) {
                        console.warn(`Could not sync logo for ${match.visitante_nombre}`, e);
                    }
                }

                await saveTeam({
                    id: teamBId,
                    name: match.visitante_nombre,
                    adccLogoUrl: match.visitante_escudo,
                    logoUrl: logoUrlB
                });

                // 2. Importar Detalle del Partido (Planteles)
                // Usamos un delay pequeño para no saturar la API si es necesario
                const detail = await fetchADCCMatchDetail(match.id);

                const matchToSave = {
                    realId: match.id,
                    tournamentId: 'adcc-imported',
                    teamA: { name: match.local_nombre, logo: match.local_escudo },
                    teamB: { name: match.visitante_nombre, logo: match.visitante_escudo },
                    date: match.dia.split(' ')[0],
                    time: match.dia.split(' ')[1]?.substring(0, 5) || '00:00',
                    status: match.estado_partido === 'Finalizado' ? 'finished' : 'scheduled',
                    category: match.categoria,
                    liga: match.liga,
                    score: {
                        a: match.res_local || 0,
                        b: match.res_visitante || 0
                    },
                    playersA: detail.equipo_local.map(p => ({
                        dni: String(p.dni),
                        name: `${p.nombre} ${p.apellido}`,
                        goals: 0,
                        yellowCards: 0,
                        redCard: false,
                        status: 'suplente',
                        jleid: p.jleid,
                        photo: p.imagen
                    })),
                    playersB: detail.equipo_visitante.map(p => ({
                        dni: String(p.dni),
                        name: `${p.nombre} ${p.apellido}`,
                        goals: 0,
                        yellowCards: 0,
                        redCard: false,
                        status: 'suplente',
                        jleid: p.jleid,
                        photo: p.imagen_url || p.imagen
                    }))
                };

                const customMatchId = `adcc_${match.id}`;
                await saveMatchWithId(customMatchId, matchToSave);
            }
        }
        console.log('[Sync] Sincronización finalizada con éxito.');
        return true;
    } catch (error) {
        console.error('[Sync] Error durante la sincronización:', error);
        return false;
    }
};
