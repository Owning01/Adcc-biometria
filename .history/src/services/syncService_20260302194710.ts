import { fetchADCCMatches, fetchADCCMatchDetail } from './adccService';
import { saveMatchWithId, saveTournamentWithId, getTournament, getMatch } from './matchesService';
import { saveTeam, getTeam } from './teamsService';
import { compressAndUploadLogo } from './imageStorageService';

/**
 * Sincroniza automáticamente los partidos y equipos desde la API de ADCC.
 * @param options - Configuración de sincronización.
 */
export const syncADCCData = async (options: { pages?: number, syncAll?: boolean, userRole?: string } = { pages: 2 }) => {
    const isPublicUser = options.userRole === 'usuario';

    if (!isPublicUser) {
        console.log(`[Sync] Iniciando sincronización...`);
    }

    const processedTournaments = new Set<string>();

    try {
        let currentPage = 1;
        let lastPage = options.syncAll ? 999 : (options.pages || 2);

        while (currentPage <= lastPage) {
            if (!isPublicUser) {
                console.group(`[Sync] Procesando página ${currentPage}...`);
            }
            const matchesRes = await fetchADCCMatches(currentPage);

            if (options.syncAll) {
                lastPage = matchesRes.last_page;
            }

            for (const match of matchesRes.data) {
                // 1. Organizar Torneo
                const tournamentName = match.liga || 'ADCC';
                const tournamentCat = match.categoria || 'General';
                const tournamentId = `${tournamentName}-${tournamentCat}`.toLowerCase().replace(/\s+/g, '-');

                if (!processedTournaments.has(tournamentId)) {
                    const existingTournament = await getTournament(tournamentId);
                    if (!existingTournament) {
                        await saveTournamentWithId(tournamentId, {
                            name: tournamentName,
                            category: tournamentCat,
                            source: 'adcc'
                        });
                    }
                    processedTournaments.add(tournamentId);
                }

                // 2. Guardar/Actualizar Equipos (Metadatos y Logos)
                const teamAId = match.local_nombre.toLowerCase().replace(/\s+/g, '-');
                const teamBId = match.visitante_nombre.toLowerCase().replace(/\s+/g, '-');

                // Procesar Team A
                let teamA = await getTeam(teamAId);
                let logoUrlA = teamA?.logoUrl;

                // Solo intentamos subir logo si no somos un usuario público (admin/dev)
                if (!logoUrlA && match.local_escudo && !isPublicUser) {
                    try {
                        logoUrlA = await compressAndUploadLogo(match.local_escudo, teamAId);
                    } catch (e) {
                        console.warn(`Could not sync logo for ${match.local_nombre}`, e);
                    }
                }

                const teamAData: any = {
                    id: teamAId,
                    name: match.local_nombre,
                    adccLogoUrl: match.local_escudo || null
                };
                if (logoUrlA) teamAData.logoUrl = logoUrlA;

                await saveTeam(teamAData);

                // Procesar Team B
                let teamB = await getTeam(teamBId);
                let logoUrlB = teamB?.logoUrl;

                if (!logoUrlB && match.visitante_escudo && !isPublicUser) {
                    try {
                        logoUrlB = await compressAndUploadLogo(match.visitante_escudo, teamBId);
                    } catch (e) {
                        console.warn(`Could not sync logo for ${match.visitante_nombre}`, e);
                    }
                }

                const teamBData: any = {
                    id: teamBId,
                    name: match.visitante_nombre,
                    adccLogoUrl: match.visitante_escudo || null
                };
                if (logoUrlB) teamBData.logoUrl = logoUrlB;

                await saveTeam(teamBData);

                // 3. Importar Detalle del Partido
                const customMatchId = `adcc_${match.id}`;
                const existingMatch = await getMatch(customMatchId);

                // Si es un partido nuevo o no tiene jugadores, pedimos detalle
                if (!existingMatch || !existingMatch.playersA || existingMatch.playersA.length === 0) {
                    try {
                        // Delay para evitar 429
                        await new Promise(r => setTimeout(r, 100));

                        const detail = await fetchADCCMatchDetail(match.id);

                        const matchToSave = {
                            realId: match.id,
                            tournamentId: tournamentId,
                            teamA: { name: match.local_nombre, logo: match.local_escudo },
                            teamB: { name: match.visitante_nombre, logo: match.visitante_escudo },
                            date: match.dia.split(' ')[0],
                            time: match.dia.split(' ')[1]?.substring(0, 5) || '00:00',
                            status: match.estado_partido === 'Finalizado' ? 'finished' : (match.estado_partido === 'En juego' ? 'live' : 'scheduled'),
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
                                photo: p.imagen_url || p.imagen
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

                        await saveMatchWithId(customMatchId, matchToSave);
                    } catch (e) {
                        if (!isPublicUser) console.error(`Failed detail for match ${match.id}`, e);
                    }
                } else {
                    // Actualizar solo score y estado
                    const updateData = {
                        status: match.estado_partido === 'Finalizado' ? 'finished' : (match.estado_partido === 'En juego' ? 'live' : 'scheduled'),
                        score: {
                            a: match.res_local || 0,
                            b: match.res_visitante || 0
                        }
                    };
                    await saveMatchWithId(customMatchId, { ...existingMatch, ...updateData });
                }
            }
            if (!isPublicUser) console.groupEnd();
            currentPage++;
            if (currentPage > lastPage) break;
        }

        if (!isPublicUser) console.log('[Sync] Sincronización finalizada con éxito.');
        return true;
    } catch (error) {
        if (!isPublicUser) console.error('[Sync] Error en sincronización:', error);
        return false;
    }
};
