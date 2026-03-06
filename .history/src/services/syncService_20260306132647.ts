import { fetchADCCMatches, fetchADCCMatchDetail, fetchADCCTournaments, fetchADCCTournamentMatches } from './adccService';
import { saveMatchWithId, saveTournamentWithId, getTournament, getMatch } from './matchesService';
import { saveTeam, getTeam } from './teamsService';
import { compressAndUploadLogo } from './imageStorageService';

/**
 * Sincroniza automáticamente los partidos y equipos desde la API de ADCC usando la nueva estructura jerárquica.
 */
export const syncADCCData = async (options: { userRole?: string } = {}) => {
    const isPublicUser = options.userRole === 'usuario';
    if (!isPublicUser) console.log(`[Sync] Iniciando sincronización jerárquica...`);

    try {
        // 1. Obtener todas las Ligas/Torneos activos
        const leagues = await fetchADCCTournaments();
        if (!isPublicUser) console.log(`[Sync] Se encontraron ${leagues.length} ligas activas.`);

        for (const league of leagues) {
            // El objeto liga suele traer id y nombre (ej: "Lunes", "Sábado")
            const leagueId = String(league.id);
            const leagueName = league.nombre || league.name || 'Liga ADCC';

            if (!isPublicUser) console.group(`[Sync] Procesando Liga: ${leagueName} (${leagueId})`);

            // 2. Obtener partidos de esta liga específica
            const matches = await fetchADCCTournamentMatches(leagueId);
            if (!isPublicUser) console.log(`[Sync] Procesando ${matches.length} partidos...`);

            for (const match of matches) {
                // Organizar el Torneo en Firestore
                // Nota: Usamos una combinación de liga y categoría para el ID del torneo
                const tournamentCat = match.categoria || 'General';
                const tournamentId = `${leagueName}-${tournamentCat}`.toLowerCase().replace(/\s+/g, '-');

                const existingTournament = await getTournament(tournamentId);
                if (!existingTournament) {
                    await saveTournamentWithId(tournamentId, {
                        name: leagueName,
                        category: tournamentCat,
                        source: 'adcc',
                        adccId: leagueId
                    });
                }

                // 3. Procesar Equipos y Logos
                const teamAId = match.local_nombre.toLowerCase().replace(/\s+/g, '-');
                const teamBId = match.visitante_nombre.toLowerCase().replace(/\s+/g, '-');

                // Procesar Team A
                let teamA = await getTeam(teamAId);
                let logoUrlA = teamA?.logoUrl;
                if (!logoUrlA && match.local_escudo && !isPublicUser) {
                    try { logoUrlA = await compressAndUploadLogo(match.local_escudo, teamAId); } catch (e) { }
                }
                const teamAData: any = { id: teamAId, name: match.local_nombre, adccLogoUrl: match.local_escudo || null };
                if (logoUrlA) teamAData.logoUrl = logoUrlA;
                await saveTeam(teamAData);

                // Procesar Team B
                let teamB = await getTeam(teamBId);
                let logoUrlB = teamB?.logoUrl;
                if (!logoUrlB && match.visitante_escudo && !isPublicUser) {
                    try { logoUrlB = await compressAndUploadLogo(match.visitante_escudo, teamBId); } catch (e) { }
                }
                const teamBData: any = { id: teamBId, name: match.visitante_nombre, adccLogoUrl: match.visitante_escudo || null };
                if (logoUrlB) teamBData.logoUrl = logoUrlB;
                await saveTeam(teamBData);

                // 4. Importar Detalle del Partido
                const customMatchId = `adcc_${match.id}`;
                const existingMatch = await getMatch(customMatchId);

                // Si es nuevo o no tiene jugadores, pedimos detalle
                if (!existingMatch || !existingMatch.playersA || existingMatch.playersA.length === 0) {
                    try {
                        await new Promise(r => setTimeout(r, 100)); // Rate limiting
                        const detail = await fetchADCCMatchDetail(match.id);

                        const matchToSave = {
                            realId: match.id,
                            tournamentId: tournamentId,
                            teamA: { name: match.local_nombre, logo: match.local_escudo },
                            teamB: { name: match.visitante_nombre, logo: match.visitante_escudo },
                            date: match.dia?.split(' ')[0] || '2024-01-01',
                            time: match.dia?.split(' ')[1]?.substring(0, 5) || '00:00',
                            status: match.estado_partido === 'Finalizado' ? 'finished' : (match.estado_partido === 'En juego' ? 'live' : 'scheduled'),
                            category: tournamentCat,
                            liga: leagueName,
                            tournamentName: `${leagueName} - ${tournamentCat}`,
                            score: { a: match.res_local || 0, b: match.res_visitante || 0 },
                            playersA: detail.equipo_local?.map(p => ({
                                dni: String(p.dni),
                                name: `${p.nombre} ${p.apellido}`,
                                status: 'suplente',
                                jleid: p.jleid,
                                photo: p.imagen_url || p.imagen
                            })) || [],
                            playersB: detail.equipo_visitante?.map(p => ({
                                dni: String(p.dni),
                                name: `${p.nombre} ${p.apellido}`,
                                status: 'suplente',
                                jleid: p.jleid,
                                photo: p.imagen_url || p.imagen
                            })) || []
                        };
                        await saveMatchWithId(customMatchId, matchToSave);
                    } catch (e) {
                        if (!isPublicUser) console.error(`[Sync] Error en detalle partido ${match.id}:`, e);
                    }
                } else {
                    // Actualizar score, estado y asegurar campos de torneo
                    const updateData = {
                        status: match.estado_partido === 'Finalizado' ? 'finished' : (match.estado_partido === 'En juego' ? 'live' : 'scheduled'),
                        score: { a: match.res_local || 0, b: match.res_visitante || 0 },
                        category: tournamentCat,
                        liga: leagueName,
                        tournamentName: `${leagueName} - ${tournamentCat}`
                    };
                    await saveMatchWithId(customMatchId, { ...existingMatch, ...updateData });
                }
            }
            if (!isPublicUser) console.groupEnd();
            await new Promise(r => setTimeout(r, 300)); // Delay entre ligas
        }

        if (!isPublicUser) console.log('[Sync] Sincronización jerárquica finalizada.');
        return true;
    } catch (error) {
        if (!isPublicUser) console.error('[Sync] Error crítico en la sincronización:', error);
        return false;
    }
};
