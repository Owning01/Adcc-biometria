import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { ADCCMatch, ADCCMatchDetail, ADCCPlayer, fetchADCCMatches, fetchADCCMatchDetail } from '../services/adccService';
import { loadModelsLocal } from '../services/faceServiceLocal';
import { playerRegistrationService, PlayerData, RegistrationResult } from '../services/playerRegistrationService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface Progress {
    processed: number;
    total: number;
    success: number;
    failed: number;
}

export interface LogEntry {
    msg: string;
    timestamp: number;
    status: 'info' | 'success' | 'warning' | 'error';
    jleid?: number;
}

interface MatchBatchProcessorContextType {
    matches: ADCCMatch[];
    selectedMatchId: number | null;
    matchPlayers: ADCCPlayer[];
    status: 'idle' | 'loading_matches' | 'loading_players' | 'ready' | 'processing' | 'paused' | 'finished' | 'error';
    progress: Progress;
    logs: LogEntry[];
    errorMsg: string;
    currentPlayer: ADCCPlayer | null;
    currentStep: string;
    loadMatches: () => Promise<void>;
    startMassProcessing: () => Promise<void>;
    startSpecificProcessing: (matchIds: number[]) => Promise<void>;
    startLocalProcessing: (data: { matches: ADCCMatch[], details: Record<number, ADCCMatchDetail> }) => Promise<void>;
    pauseProcessing: () => void;
    resetProcessor: () => void;
    clearLogs: () => void;
}

const MatchBatchProcessorContext = createContext<MatchBatchProcessorContextType | undefined>(undefined);

export const MatchBatchProcessorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [matches, setMatches] = useState<ADCCMatch[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<ADCCPlayer[]>([]);
    const [status, setStatus] = useState<MatchBatchProcessorContextType['status']>('idle');
    const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [currentPlayer, setCurrentPlayer] = useState<ADCCPlayer | null>(null);
    const [currentStep, setCurrentStep] = useState('');

    const isPausedRef = useRef(false);
    const isProcessingRef = useRef(false);

    const log = useCallback((msg: string, logStatus: 'info' | 'success' | 'warning' | 'error' = 'info', jleid?: number) => {
        setLogs(prev => [{ msg, timestamp: Date.now(), status: logStatus, jleid }, ...prev].slice(0, 500));
    }, []);

    const loadMatches = async () => {
        try {
            setStatus('loading_matches');
            log(`Iniciando carga de partidos...`, 'info');
            const response = await fetchADCCMatches(1);
            setMatches(response.data);
            setStatus('idle');
            log(`Se cargaron ${response.data.length} partidos.`, 'success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'Error cargando partidos');
            log(`❌ Error: ${err.message}`, 'error');
        }
    };

    const normalizeImageUrl = (url: string | null | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        // Si no empieza con http, asumimos que es una imagen en la carpeta de fotos de ADCC
        return `https://adccanning.com.ar/img/foto/${url}`;
    };

    const processPlayer = async (player: ADCCPlayer): Promise<boolean> => {
        setCurrentPlayer(player);
        setCurrentStep('Validando datos...');

        try {
            const rawFotoUrl = player.foto || player.imagen || player.imagen_url;
            const fotoUrl = normalizeImageUrl(rawFotoUrl);
            if (!fotoUrl) {
                log(`⚠️ ${player.nombre} ${player.apellido}: No tiene foto.`, 'warning', player.jleid);
                return false;
            }

            setCurrentStep('Descargando y procesando biometría...');
            const playerData: PlayerData = {
                id: player.id,
                jleid: player.jleid,
                dni: player.dni,
                nombre: player.nombre,
                apellido: player.apellido,
                foto: fotoUrl,
                team: player.equipo,
                category: player.categoria
            };

            const result: RegistrationResult = await playerRegistrationService.registerPlayer(playerData, {
                syncWithApi: false, // Por ahora local
                forceUpdate: false // Saltar si ya existe
            });

            if (result.success) {
                if (result.alreadyRegistered) {
                    log(`✅ ${player.nombre} ya cuenta con biometría, saltando...`, 'success', player.jleid);
                } else {
                    log(`✅ ${player.nombre} registrado con éxito.`, 'success', player.jleid);
                }
                return true;
            } else {
                log(`❌ ${player.nombre}: ${result.error || 'Error desconocido'}`, 'error', player.jleid);
                return false;
            }
        } catch (err: any) {
            log(`❌ Error procesando ${player.nombre}: ${err.message}`, 'error', player.jleid);
            return false;
        }
    };

    const fetchWithRetry = async <T,>(apiCall: () => Promise<T>, description: string): Promise<T> => {
        while (true) {
            try {
                return await apiCall();
            } catch (err: any) {
                if (err.message?.includes('429') || (err.response && err.response.status === 429) || err.message?.toLowerCase().includes('too many attempts')) {
                    log(`⚠️ [429] Límite de API alcanzado al ${description}. Reintentando en 10 segundos...`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }
                throw err;
            }
        }
    };

    const startMassProcessing = async () => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        isPausedRef.current = false;
        setStatus('processing');
        log('🚀 Iniciando procesamiento masivo automático de TODOS los partidos...', 'info');

        try {
            await loadModelsLocal();

            let allMatches: ADCCMatch[] = [];
            log('Obteniendo lista completa de partidos de todas las páginas...', 'info');

            let currentPage = 1;
            let lastPage = 1;

            do {
                log(`Cargando página ${currentPage}...`, 'info');
                const response = await fetchWithRetry(() => fetchADCCMatches(currentPage), `cargar página ${currentPage}`);
                allMatches = [...allMatches, ...response.data];
                lastPage = response.last_page;
                currentPage++;

                if (isPausedRef.current) break;
            } while (currentPage <= lastPage);

            if (isPausedRef.current && allMatches.length === 0) {
                isProcessingRef.current = false;
                setStatus('paused');
                return;
            }

            // Filtrar partidos del mes de marzo en adelante
            const matchesToProcess = allMatches.filter(match => {
                if (!match.dia) return false;

                const parts = match.dia.split('-');
                if (parts.length === 3) {
                    const month = parseInt(parts[1]);
                    return month >= 2;
                }

                const partsSlash = match.dia.split('/');
                if (partsSlash.length === 3) {
                    const month = parseInt(partsSlash[1]);
                    return month >= 2;
                }

                return true;
            });

            setMatches(matchesToProcess);
            log(`Se encontraron ${allMatches.length} partidos totales. ${matchesToProcess.length} partidos filtrados (Marzo en adelante).`, 'success');

            for (let m = 0; m < matchesToProcess.length; m++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.', 'warning');
                    setStatus('paused');
                    isProcessingRef.current = false;
                    return;
                }

                const match = matchesToProcess[m];

                // Verificar si el partido ya está registrado para informar, pero NO saltar
                const matchRef = doc(db, 'matches', `adcc_${match.id}`);
                const matchSnap = await getDoc(matchRef);
                const alreadyRegistered = matchSnap.exists();

                if (alreadyRegistered) {
                    log(`🔍 Partido adcc_${match.id} ya registrado. Verificando integrantes...`, 'info');
                }

                setSelectedMatchId(match.id);
                log(`[Partido ${m + 1}/${matchesToProcess.length}] ID: ${match.id} - ${match.local_nombre} vs ${match.visitante_nombre}`, 'info');

                let players: ADCCPlayer[] = [];
                let detail: any = null;

                try {
                    detail = await fetchWithRetry(() => fetchADCCMatchDetail(match.id), `obtener detalle partido ${match.id}`);
                    const allPlayers = [
                        ...detail.equipo_local.map((p: any) => ({ ...p, equipo: detail.partido.local_nombre, categoria: detail.partido.categoria })),
                        ...detail.equipo_visitante.map((p: any) => ({ ...p, equipo: detail.partido.visitante_nombre, categoria: detail.partido.categoria }))
                    ];

                    players = allPlayers.filter(p => p.face_api !== null && p.face_api !== undefined);

                    if (allPlayers.length > players.length) {
                        log(`⚠️ ${allPlayers.length - players.length} jugadores ignorados (sin datos biométricos).`, 'warning');
                    }
                } catch (err: any) {
                    log(`❌ Error al obtener detalle del partido ${match.id}: ${err.message}`, 'error');
                    continue;
                }

                if (players.length === 0 && !detail) {
                    log(`>> Partido sin datos ni jugadores. Saltando...`, 'warning');
                    continue;
                }

                if (players.length === 0) {
                    log(`>> Partido sin jugadores aptos para procesar. Guardando datos del partido...`, 'warning');
                }

                log(`>> Procesando ${players.length} jugadores...`, 'info');
                setMatchPlayers(players);
                setProgress({ processed: 0, total: players.length, success: 0, failed: 0 });

                for (let p = 0; p < players.length; p++) {
                    if (isPausedRef.current) {
                        log('⏸️ Procesamiento pausado.', 'warning');
                        setStatus('paused');
                        isProcessingRef.current = false;
                        return;
                    }

                    const player = players[p];
                    const success = await processPlayer(player);

                    setProgress(prev => ({
                        ...prev,
                        processed: prev.processed + 1,
                        success: success ? prev.success + 1 : prev.success,
                        failed: success ? prev.failed : prev.failed + 1
                    }));
                }

                // Registrar el partido con datos completos
                try {
                    const partido = detail?.partido || match;
                    const tournamentCat = partido.categoria || match.categoria || 'General';
                    const leagueName = partido.liga || match.liga || 'General';
                    const tournamentId = `${leagueName}-${tournamentCat}`.toLowerCase().replace(/\s+/g, '-');

                    await setDoc(doc(db, 'matches', `adcc_${match.id}`), {
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
                        playersA: (detail?.equipo_local || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: normalizeImageUrl(p.imagen || p.foto || p.imagen_url),
                            status: 'suplente',
                        })),
                        playersB: (detail?.equipo_visitante || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: normalizeImageUrl(p.imagen || p.foto || p.imagen_url),
                            status: 'suplente',
                        })),
                        processedAt: new Date().toISOString(),
                        source: 'mass_processor'
                    }, { merge: true });
                    log(`✅ Partido ${match.id} completado y guardado con datos completos.`, 'success');
                } catch (saveErr: any) {
                    log(`⚠️ Partido ${match.id} completado pero falló guardar registro: ${saveErr.message}`, 'warning');
                }
            }

            setStatus('finished');
            log('🏁 Procesamiento masivo finalizado.', 'success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
            log(`❌ Error fatal en masivo: ${err.message}`, 'error');
        } finally {
            isProcessingRef.current = false;
        }
    };

    const startSpecificProcessing = async (matchIds: number[]) => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        isPausedRef.current = false;
        setStatus('processing');
        log(`🚀 Iniciando procesamiento de IDs específicos: ${matchIds.join(', ')}`, 'info');

        try {
            await loadModelsLocal();

            for (let m = 0; m < matchIds.length; m++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.', 'warning');
                    setStatus('paused');
                    isProcessingRef.current = false;
                    return;
                }

                const matchId = matchIds[m];

                // Verificar si el partido ya está registrado
                const matchRef = doc(db, 'matches', `adcc_${matchId}`);
                const matchSnap = await getDoc(matchRef);
                const alreadyRegistered = matchSnap.exists();

                if (alreadyRegistered) {
                    log(`🔍 Partido adcc_${matchId} ya registrado. Verificando integrantes...`, 'info');
                }

                setSelectedMatchId(matchId);
                log(`[Partido ${m + 1}/${matchIds.length}] ID: ${matchId}`, 'info');

                let players: ADCCPlayer[] = [];
                let detail: ADCCMatchDetail | null = null;

                try {
                    detail = await fetchWithRetry(() => fetchADCCMatchDetail(matchId), `obtener detalle partido ${matchId}`);
                    const matchInfo = detail.partido;
                    const allPlayers = [
                        ...detail.equipo_local.map((p: any) => ({ ...p, equipo: matchInfo.local_nombre, categoria: matchInfo.categoria })),
                        ...detail.equipo_visitante.map((p: any) => ({ ...p, equipo: matchInfo.visitante_nombre, categoria: matchInfo.categoria }))
                    ];

                    players = allPlayers.filter(p => p.face_api !== null && p.face_api !== undefined);

                    if (allPlayers.length > players.length) {
                        log(`⚠️ ${allPlayers.length - players.length} jugadores ignorados (sin datos biométricos).`, 'warning');
                    }
                } catch (err: any) {
                    log(`❌ Error al obtener detalle del partido ${matchId}: ${err.message}`, 'error');
                    continue;
                }

                if (players.length === 0 && !detail) {
                    log(`>> Partido sin datos ni jugadores. Saltando...`, 'warning');
                    continue;
                }

                if (players.length === 0) {
                    log(`>> Partido sin jugadores aptos para biometría. Guardando datos del partido...`, 'warning');
                }

                log(`>> Procesando ${players.length} jugadores...`, 'info');
                setMatchPlayers(players);
                setProgress({ processed: 0, total: players.length, success: 0, failed: 0 });

                for (let p = 0; p < players.length; p++) {
                    if (isPausedRef.current) {
                        log('⏸️ Procesamiento pausado.', 'warning');
                        setStatus('paused');
                        isProcessingRef.current = false;
                        return;
                    }

                    const player = players[p];
                    const success = await processPlayer(player);

                    setProgress(prev => ({
                        ...prev,
                        processed: prev.processed + 1,
                        success: success ? prev.success + 1 : prev.success,
                        failed: success ? prev.failed : prev.failed + 1
                    }));
                }

                // Registrar el partido con datos COMPLETOS (reutilizando detail ya obtenido)
                try {
                    const partido = detail!.partido;
                    const tournamentCat = partido.categoria || 'General';
                    const leagueName = partido.liga || 'General';
                    const tournamentId = `${leagueName}-${tournamentCat}`.toLowerCase().replace(/\s+/g, '-');

                    await setDoc(doc(db, 'matches', `adcc_${matchId}`), {
                        realId: matchId,
                        partido_id: matchId,
                        tournamentId,
                        tournamentName: `${leagueName} - ${tournamentCat}`,
                        liga: leagueName,
                        category: tournamentCat,
                        teamA: { name: partido.local_nombre, logo: partido.local_escudo },
                        teamB: { name: partido.visitante_nombre, logo: partido.visitante_escudo },
                        date: partido.dia?.split(' ')[0] || '',
                        time: partido.dia?.split(' ')[1]?.substring(0, 5) || '00:00',
                        status: partido.estado_partido === 'Finalizado'
                            ? 'finished'
                            : partido.estado_partido === 'En juego'
                                ? 'live'
                                : 'scheduled',
                        score: { a: partido.res_local ?? 0, b: partido.res_visitante ?? 0 },
                        playersA: (detail!.equipo_local || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: normalizeImageUrl(p.imagen || p.foto || p.imagen_url),
                            status: 'suplente',
                        })),
                        playersB: (detail!.equipo_visitante || []).map((p: any) => ({
                            dni: String(p.dni),
                            name: `${p.nombre} ${p.apellido}`,
                            jleid: p.jleid,
                            number: p.camiseta ?? null,
                            photo: normalizeImageUrl(p.imagen || p.foto || p.imagen_url),
                            status: 'suplente',
                        })),
                        processedAt: new Date().toISOString(),
                        source: 'specific_processor'
                    }, { merge: true });
                    log(`✅ Partido ${matchId} completado y guardado con datos completos.`, 'success');
                } catch (saveErr: any) {
                    log(`⚠️ Partido ${matchId} completado pero falló guardar registro: ${saveErr.message}`, 'warning');
                }
            }

            setStatus('finished');
            log('🏁 Procesamiento de IDs específicos finalizado.', 'success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
            log(`❌ Error fatal en procesamiento específico: ${err.message}`, 'error');
        } finally {
            isProcessingRef.current = false;
        }
    };

    const startLocalProcessing = async (data: { matches: ADCCMatch[], details: Record<number, ADCCMatchDetail> }) => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        isPausedRef.current = false;
        setStatus('processing');
        log(`📂 Iniciando procesamiento desde archivo LOCAL (${data.matches.length} partidos)`, 'info');

        try {
            await loadModelsLocal();

            const matchesToProcess = data.matches;
            setMatches(matchesToProcess);

            for (let m = 0; m < matchesToProcess.length; m++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.', 'warning');
                    setStatus('paused');
                    isProcessingRef.current = false;
                    return;
                }

                const match = matchesToProcess[m];
                const detail = data.details[match.id];

                if (!detail) {
                    log(`⚠️ No se encontraron detalles para el partido ${match.id} en el archivo local. Saltando...`, 'warning');
                    continue;
                }

                setSelectedMatchId(match.id);
                log(`[Partido ${m + 1}/${matchesToProcess.length}] ID: ${match.id} (LOCAL)`, 'info');

                const allPlayers = [
                    ...detail.equipo_local.map(p => ({
                        ...p,
                        equipo: match.local_nombre,
                        categoria: (match as any).local_categoria || match.categoria || detail.partido.categoria
                    })),
                    ...detail.equipo_visitante.map(p => ({
                        ...p,
                        equipo: match.visitante_nombre,
                        categoria: (match as any).visitante_categoria || match.categoria || detail.partido.categoria
                    }))
                ];

                const players = allPlayers;

                log(`>> Procesando ${players.length} jugadores...`, 'info');
                setMatchPlayers(players);
                setProgress({ processed: 0, total: players.length, success: 0, failed: 0 });

                for (let p = 0; p < players.length; p++) {
                    if (isPausedRef.current) {
                        log('⏸️ Procesamiento pausado.', 'warning');
                        setStatus('paused');
                        isProcessingRef.current = false;
                        return;
                    }

                    const player = players[p];
                    const success = await processPlayer(player);

                    setProgress(prev => ({
                        ...prev,
                        processed: prev.processed + 1,
                        success: success ? prev.success + 1 : prev.success,
                        failed: success ? prev.failed : prev.failed + 1
                    }));
                }

                // Registrar el partido
                try {
                    await setDoc(doc(db, 'matches', `adcc_${match.id}`), {
                        ...match,
                        processedAt: new Date().toISOString(),
                        source: 'local_file'
                    }, { merge: true });
                    log(`✅ Partido ${match.id} procesado desde local exitosamente.`, 'success');
                } catch (saveErr: any) {
                    log(`⚠️ Error guardando registro de partido ${match.id}: ${saveErr.message}`, 'warning');
                }
            }

            setStatus('finished');
            log('🏁 Procesamiento local finalizado.', 'success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
            log(`❌ Error en procesamiento local: ${err.message}`, 'error');
        } finally {
            isProcessingRef.current = false;
        }
    };

    const pauseProcessing = () => {
        isPausedRef.current = true;
    };

    const resetProcessor = () => {
        setMatchPlayers([]);
        setSelectedMatchId(null);
        setStatus('idle');
        setProgress({ processed: 0, total: 0, success: 0, failed: 0 });
        setCurrentPlayer(null);
        setCurrentStep('');
    };

    const clearLogs = () => setLogs([]);

    return (
        <MatchBatchProcessorContext.Provider value={{
            matches,
            selectedMatchId,
            matchPlayers,
            status,
            progress,
            logs,
            errorMsg,
            currentPlayer,
            currentStep,
            loadMatches,
            startMassProcessing,
            startSpecificProcessing,
            startLocalProcessing,
            pauseProcessing,
            resetProcessor,
            clearLogs
        }}>
            {children}
        </MatchBatchProcessorContext.Provider>
    );
};

export const useMatchBatchProcessor = () => {
    const context = useContext(MatchBatchProcessorContext);
    if (context === undefined) {
        throw new Error('useMatchBatchProcessor must be used within a MatchBatchProcessorProvider');
    }
    return context;
};
