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

    const processPlayer = async (player: ADCCPlayer): Promise<boolean> => {
        setCurrentPlayer(player);
        setCurrentStep('Validando datos...');

        try {
            const fotoUrl = player.foto || player.imagen || player.imagen_url;
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

    const startMassProcessing = async () => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        isPausedRef.current = false;
        setStatus('processing');
        log('🚀 Iniciando procesamiento masivo automático de TODOS los partidos...', 'info');

        try {
            await loadModelsLocal();

            let matchesToProcess = matches;

            if (matchesToProcess.length === 0) {
                log('Obteniendo lista de partidos...', 'info');
                const response = await fetchADCCMatches(1);
                matchesToProcess = response.data;
                setMatches(matchesToProcess);
                log(`Se encontraron ${matchesToProcess.length} partidos.`, 'success');
            }

            for (let m = 0; m < matchesToProcess.length; m++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.', 'warning');
                    setStatus('paused');
                    isProcessingRef.current = false;
                    return;
                }

                const match = matchesToProcess[m];

                // Verificar si el partido ya está registrado
                const matchRef = doc(db, 'matches', `adcc_${match.id}`);
                const matchSnap = await getDoc(matchRef);

                if (matchSnap.exists()) {
                    log(`⏩ Partido adcc_${match.id} ya registrado, saltando...`, 'info');
                    // Actualizar el progreso para que los contadores globales tengan sentido si se implementan luego
                    continue;
                }

                setSelectedMatchId(match.id);
                log(`[Partido ${m + 1}/${matchesToProcess.length}] ID: ${match.id} - ${match.local_nombre} vs ${match.visitante_nombre}`, 'info');

                let players: ADCCPlayer[] = [];

                try {
                    const detail = await fetchADCCMatchDetail(match.id);
                    const allPlayers = [
                        ...detail.equipo_local.map(p => ({ ...p, equipo: detail.partido.local_nombre, categoria: detail.partido.categoria })),
                        ...detail.equipo_visitante.map(p => ({ ...p, equipo: detail.partido.visitante_nombre, categoria: detail.partido.categoria }))
                    ];

                    players = allPlayers.filter(p => p.face_api !== null && p.face_api !== undefined);

                    if (allPlayers.length > players.length) {
                        log(`⚠️ ${allPlayers.length - players.length} jugadores ignorados (sin datos biométricos).`, 'warning');
                    }
                } catch (err: any) {
                    log(`❌ Error al obtener detalle del partido ${match.id}: ${err.message}`, 'error');
                    continue;
                }

                if (players.length === 0) {
                    log(`>> Partido sin jugadores aptos para procesar. Saltando...`, 'warning');
                    continue;
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

                // Registrar el partido como completado
                try {
                    await setDoc(doc(db, 'matches', `adcc_${match.id}`), {
                        id: match.id,
                        local_nombre: match.local_nombre,
                        visitante_nombre: match.visitante_nombre,
                        liga: match.liga,
                        categoria: match.categoria,
                        processedAt: new Date().toISOString(),
                        source: 'mass_processor'
                    });
                    log(`✅ Partido ${match.id} completado y guardado en registro.`, 'success');
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
