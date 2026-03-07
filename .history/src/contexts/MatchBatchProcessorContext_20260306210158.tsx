// ============================================
// 1. IMPORTS & DEPENDENCIES
// ============================================
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { playerRegistrationService, RegistrationResult, PlayerData } from '../services/playerRegistrationService';
import { fetchADCCMatches, fetchADCCMatchDetail, ADCCMatch, ADCCPlayer } from '../services/adccService';
import { loadModelsLocal } from '../services/faceServiceLocal';

interface Progress {
    processed: number;
    total: number;
    success: number;
    failed: number;
}

interface MatchBatchProcessorContextType {
    matches: ADCCMatch[];
    selectedMatchId: number | null;
    matchPlayers: ADCCPlayer[];
    status: 'idle' | 'loading_matches' | 'loading_players' | 'ready' | 'processing' | 'paused' | 'finished' | 'error';
    progress: Progress;
    logs: string[];
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

// ============================================
// 3. COMPONENT DEFINITION
// ============================================
export const MatchBatchProcessorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ============================================
    // 4. STATE & REFS
    // ============================================
    const [matches, setMatches] = useState<ADCCMatch[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<ADCCPlayer[]>([]);
    const [status, setStatus] = useState<MatchBatchProcessorContextType['status']>('idle');
    const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [currentPlayer, setCurrentPlayer] = useState<ADCCPlayer | null>(null);
    const [currentStep, setCurrentStep] = useState('');

    const isPausedRef = useRef(false);
    const isProcessingRef = useRef(false);

    const log = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 100));
    }, []);

    // ============================================
    // 6. HANDLERS & LOGIC
    // ============================================
    const loadMatches = async (page: number = 1) => {
        try {
            setStatus('loading_matches');
            log(`Iniciando carga de partidos (página ${page})...`);
            const response = await fetchADCCMatches(page);
            setMatches(response.data);
            setStatus('idle');
            log(`Se cargaron ${response.data.length} partidos.`);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'Error cargando partidos');
            log(`❌ Error: ${err.message}`);
        }
    };

};

const selectMatch = async (matchId: number) => {
    // Obsolete individually processing, replaced by startMassProcessing
};

const processPlayer = async (player: ADCCPlayer): Promise<boolean> => {
    setCurrentPlayer(player);
    setCurrentStep('Validando datos...');

    try {
        const fotoUrl = player.foto || player.imagen || player.imagen_url;
        if (!fotoUrl) {
            log(`⚠️ ${player.nombre} ${player.apellido}: No tiene foto.`);
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
            forceUpdate: true
        });

        if (result.success) {
            log(`✅ ${player.nombre} registrado con éxito.`);
            return true;
        } else {
            log(`❌ ${player.nombre}: ${result.error || 'Error desconocido'}`);
            return false;
        }
    } catch (err: any) {
    } catch (err: any) {
        log(`❌ Error procesando ${player.nombre}: ${err.message}`);
        return false;
    }
};

const startMassProcessing = async () => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    isPausedRef.current = false;
    setStatus('processing');
    log('🚀 Iniciando procesamiento masivo automático de TODOS los partidos...');

    try {
        await loadModelsLocal();

        let matchesToProcess = matches;

        // 1. Fetch matches if not already loaded or if resuming from empty
        if (matchesToProcess.length === 0) {
            log('Obteniendo lista de partidos...');
            const response = await fetchADCCMatches(1);
            matchesToProcess = response.data;
            setMatches(matchesToProcess);
            log(`Se encontraron ${matchesToProcess.length} partidos.`);
        }

        // 2. Loop through all matches
        for (let m = 0; m < matchesToProcess.length; m++) {
            if (isPausedRef.current) {
                log('⏸️ Procesamiento pausado.');
                setStatus('paused');
                isProcessingRef.current = false;
                return;
            }

            const match = matchesToProcess[m];

            // Skip matches we already fully processed if resuming? Actually, better to just process and it will update.
            setSelectedMatchId(match.id);
            log(`[Partido ${m + 1}/${matchesToProcess.length}] ID: ${match.id} - ${match.local_nombre} vs ${match.visitante_nombre}`);

            let players: ADCCPlayer[] = [];

            try {
                const detail = await fetchADCCMatchDetail(match.id);
                const allPlayers = [
                    ...detail.equipo_local.map(p => ({ ...p, equipo: detail.partido.local_nombre, categoria: detail.partido.categoria })),
                    ...detail.equipo_visitante.map(p => ({ ...p, equipo: detail.partido.visitante_nombre, categoria: detail.partido.categoria }))
                ];

                players = allPlayers.filter(p => p.face_api !== null && p.face_api !== undefined);

                if (allPlayers.length > players.length) {
                    log(`⚠️ ${allPlayers.length - players.length} jugadores ignorados (sin datos biométricos).`);
                }
            } catch (err: any) {
                log(`❌ Error al obtener detalle del partido ${match.id}: ${err.message}`);
                continue; // Skip to next match
            }

            if (players.length === 0) {
                log(`>> Partido sin jugadores aptos para procesar. Saltando...`);
                continue; // Skip to next match
            }

            log(`>> Procesando ${players.length} jugadores...`);
            setMatchPlayers(players);
            setProgress({ processed: 0, total: players.length, success: 0, failed: 0 });

            // 3. Process each player in the current match
            for (let p = 0; p < players.length; p++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.');
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

            log(`✅ Partido ${match.id} completado.`);
        }

        setStatus('finished');
        log('🏁 Procesamiento masivo de todos los partidos finalizado.');
    } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message);
        log(`❌ Error fatal en masivo: ${err.message}`);
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
