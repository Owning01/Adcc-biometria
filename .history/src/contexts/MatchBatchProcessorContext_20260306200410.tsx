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

    loadMatches: (page?: number) => Promise<void>;
    selectMatch: (matchId: number) => Promise<void>;
    startProcessing: () => Promise<void>;
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

    const selectMatch = async (matchId: number) => {
        try {
            setSelectedMatchId(matchId);
            setStatus('loading_players');
            log(`Obteniendo detalles del partido ${matchId}...`);
            const detail = await fetchADCCMatchDetail(matchId);

            // Combinar planteles y añadir info de equipo/categoría
            const players = [
                ...detail.equipo_local.map(p => ({ ...p, equipo: detail.partido.local_nombre, categoria: detail.partido.categoria })),
                ...detail.equipo_visitante.map(p => ({ ...p, equipo: detail.partido.visitante_nombre, categoria: detail.partido.categoria }))
            ];

            setMatchPlayers(players);
            setProgress({ processed: 0, total: players.length, success: 0, failed: 0 });
            setStatus('ready');
            log(`Detalle cargado: ${players.length} jugadores encontrados.`);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'Error cargando detalles del partido');
            log(`❌ Error detallado: ${err.message}`);
        }
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
            log(`❌ Error procesando ${player.nombre}: ${err.message}`);
            return false;
        }
    };

    const startProcessing = async () => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        isPausedRef.current = false;
        setStatus('processing');
        log('🚀 Iniciando procesamiento masivo...');

        try {
            await loadModelsLocal();

            // Iniciar desde donde quedó (en caso de pausa)
            const startIndex = progress.processed;
            const remainingPlayers = matchPlayers.slice(startIndex);

            for (let i = 0; i < remainingPlayers.length; i++) {
                if (isPausedRef.current) {
                    log('⏸️ Procesamiento pausado.');
                    setStatus('paused');
                    isProcessingRef.current = false;
                    return;
                }

                const player = remainingPlayers[i];
                const success = await processPlayer(player);

                setProgress(prev => ({
                    ...prev,
                    processed: prev.processed + 1,
                    success: success ? prev.success + 1 : prev.success,
                    failed: success ? prev.failed : prev.failed + 1
                }));
            }

            setStatus('finished');
            log('🏁 Procesamiento finalizado.');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
            log(`❌ Error fatal en lote: ${err.message}`);
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
            selectMatch,
            startProcessing,
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
