import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { playerRegistrationService, RegistrationResult } from '../services/playerRegistrationService';
import { loadModelsLocal } from '../services/faceServiceLocal';
import { registerPlayerBiometrics } from '../services/adccService';

interface Progress {
    processed: number;
    total: number;
    success: number;
    failed: number;
}

interface BatchProcessorContextType {
    players: any[];
    status: 'idle' | 'loading_list' | 'ready' | 'processing' | 'paused' | 'finished' | 'error' | 'syncing';
    progress: Progress;
    logs: string[];
    verificationLogs: string[];
    errorMsg: string;
    getUrl: string;
    currentPlayer: any | null;
    currentStep: string;
    setGetUrl: (url: string) => void;
    handleLoadList: () => Promise<void>;
    startProcessing: () => void;
    pauseProcessing: () => void;
    resetProcessor: () => void;
    clearLogs: () => void;
    syncAllPlayers: () => Promise<void>;
}

const BatchProcessorContext = createContext<BatchProcessorContextType | undefined>(undefined);

export import { registerPlayerBiometrics } from '../services/adccService';

const BatchProcessorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [getUrl, setGetUrl] = useState('/api-adcc/api/jugadores');
    const [players, setPlayers] = useState<any[]>([]);
    const [status, setStatus] = useState<BatchProcessorContextType['status']>('idle');
    const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);
    const [verificationLogs, setVerificationLogs] = useState<string[]>([]);
    const [successfulPlayers, setSuccessfulPlayers] = useState<Array<{ id: number; name: string; face_api: string }>>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [currentPlayer, setCurrentPlayer] = useState<any | null>(null);
    const [currentStep, setCurrentStep] = useState('');

    const isPausedRef = useRef(false);
    const isProcessingRef = useRef(false);

    const log = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 100));
    }, []);

    const logVerify = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setVerificationLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 100));
    }, []);

    const handleLoadList = async () => {
        try {
            setStatus('loading_list');
            setErrorMsg('');
            setSuccessfulPlayers([]);
            let allPlayers: any[] = [];
            let currentPageUrl: string | null = getUrl;
            let pageCount = 0;

            log('Iniciando carga de lista (paginada)...');

            while (currentPageUrl) {
                pageCount++;
                const actualUrl: string = currentPageUrl.startsWith('http')
                    ? currentPageUrl.replace('https://adccanning.com.ar', '/api-adcc')
                    : currentPageUrl;

                const res: Response = await fetch(actualUrl, {
                    headers: {
                        'Authorization': `Bearer ${import.meta.env.VITE_ADCC_TOKEN}`,
                        'Accept': 'application/json'
                    }
                });

                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} en página ${pageCount}`);
                const data: any = await res.json();

                const list = Array.isArray(data) ? data : (data.players || data.data || []);
                allPlayers = [...allPlayers, ...list];

                log(`Página ${pageCount} cargada: +${list.length} jugadores.`);

                currentPageUrl = data.next_page_url || null;
                if (pageCount > 100) break;
            }

            const normalized = allPlayers.map(p => {
                let foto = p.foto || p.imagen || '';
                // If it's a filename or path but not a full URL, we let getAdccImageUrl handle it
                // but we can normalize the base here to be safer.
                if (foto && !foto.startsWith('http')) {
                    // Try to use the discovered working path /img/foto/
                    if (!foto.includes('/')) {
                        foto = `https://adccanning.com.ar/img/foto/${foto}`;
                    } else if (foto.includes('jugadores/')) {
                        foto = `https://adccanning.com.ar/${foto.replace('jugadores/', 'img/foto/')}`;
                    } else if (!foto.startsWith('img/')) {
                        foto = `https://adccanning.com.ar/${foto.startsWith('/') ? foto.slice(1) : foto}`;
                    } else {
                        foto = `https://adccanning.com.ar/${foto}`;
                    }
                }
                return { ...p, processed_foto: foto };
            });

            setPlayers(normalized);
            setProgress({ processed: 0, total: normalized.length, success: 0, failed: 0 });
            setStatus('ready');
            log(`Proceso de carga finalizado: ${normalized.length} jugadores listos.`);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'Error cargando la lista');
            log(`❌ Error al cargar la lista: ${err.message}`);
        }
    };

    const processBatch = useCallback(async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setStatus('processing');
        isPausedRef.current = false;
        log('▶️ Iniciando procesamiento masivo (Sin Sincronización API)...');

        // 1. Asegurar carga de Modelos IA antes de correr el bucle principal.
        setCurrentStep('Cargando modelos IA...');
        try {
            const loadRes = await loadModelsLocal();
            if (!loadRes.success) {
                setStatus('error');
                setErrorMsg(loadRes.error || 'No se pudieron inicializar modelos IA');
                isProcessingRef.current = false;
                log('❌ ' + (loadRes.error || 'Fallo al cargar modelos de IA'));
                return;
            }
        } catch (mErr) {
            setStatus('error');
            setErrorMsg('Excepción al cargar modelos IA');
            isProcessingRef.current = false;
            log('❌ Excepción cargando IA');
            return;
        }

        const playersToProcess = [...players];
        let currentProgress = { ...progress };

        for (let i = currentProgress.processed; i < playersToProcess.length; i++) {
            if (isPausedRef.current) {
                setStatus('paused');
                isProcessingRef.current = false;
                log('⏸️ Procesamiento pausado por el usuario.');
                return;
            }

            const player = playersToProcess[i];
            setCurrentPlayer(player);
            setCurrentStep('Iniciando...');
            log(`Procesando (${i + 1}/${playersToProcess.length}): ${player.nombre} ${player.apellido}...`);

            try {
                setCurrentStep('Detectando rostro...');
                const result: RegistrationResult = await playerRegistrationService.registerPlayer({
                    jleid: player.jleid || player.id,
                    dni: player.dni,
                    nombre: player.nombre,
                    apellido: player.apellido,
                    foto: player.processed_foto
                }, { syncWithApi: false }); // POST SEPARADO

                if (result.success) {
                    currentProgress.success++;
                    setCurrentStep('Completado');
                    log(`✅ OK: ${player.nombre} ${player.apellido}`);
                    logVerify(`✨ DESCRIPTOR OK: ${player.nombre} ${player.apellido} - Len: ${result.descriptor?.length}`);

                    // Guardar para sincronización API posterior
                    setSuccessfulPlayers(prev => [...prev, {
                        id: player.jleid || player.id,
                        name: `${player.nombre} ${player.apellido}`,
                        face_api: result.descriptor || ''
                    }]);
                } else {
                    currentProgress.failed++;
                    setCurrentStep(`Error: ${result.error}`);
                    log(`⚠️ FALLÓ: ${player.nombre} ${player.apellido} - ${result.error}`);
                    logVerify(`❌ EXTRACTION FAILED: ${player.nombre} ${player.apellido} - ${result.error}`);
                }
            } catch (err: any) {
                currentProgress.failed++;
                setCurrentStep('Error crítico');
                log(`❌ ERROR CRÍTICO: ${player.nombre} ${player.apellido} - ${err.message}`);
            }

            currentProgress.processed = i + 1;
            setProgress({ ...currentProgress });
        }

        setStatus('finished');
        setCurrentPlayer(null);
        setCurrentStep('');
        isProcessingRef.current = false;
        log('🏁 Procesamiento masivo finalizado. Listo para sincronizar API.');
    }, [players, progress, log, logVerify]);

    const syncAllPlayers = async () => {
        if (status !== 'finished' || successfulPlayers.length === 0) return;
        setStatus('syncing');
        log(`☁️ Iniciando Sincronización con API ADCC (POST) para ${successfulPlayers.length} jugadores...`);

        let syncedCount = 0;
        let errorCount = 0;

        for (const p of successfulPlayers) {
            try {
                const res = await import('./adccService').then(m => m.registerPlayerBiometrics(p.id, p.face_api));
                if (res && (res.ok !== false)) {
                    syncedCount++;
                    log(`☁️ API OK (${syncedCount}/${successfulPlayers.length}): ${p.name}`);
                } else {
                    errorCount++;
                    log(`☁️ ⚠️ API FALLÓ: ${p.name} - ${res?.error || 'Error desconocido'}`);
                }
            } catch (err: any) {
                errorCount++;
                log(`☁️ ❌ ERROR API: ${p.name} - ${err.message}`);
            }
        }

        log(`🏁 Sincronización masiva finalizada. Éxitos: ${syncedCount}, Fallos: ${errorCount}.`);
        setStatus('finished');
    };

    const startProcessing = () => {
        isPausedRef.current = false;
        processBatch();
    };

    const pauseProcessing = () => {
        isPausedRef.current = true;
    };

    const resetProcessor = () => {
        setPlayers([]);
        setStatus('idle');
        setProgress({ processed: 0, total: 0, success: 0, failed: 0 });
        setLogs([]);
        setVerificationLogs([]);
        setErrorMsg('');
        isPausedRef.current = false;
        isProcessingRef.current = false;
    };

    const clearLogs = () => {
        setLogs([]);
        setVerificationLogs([]);
    };

    return (
        <BatchProcessorContext.Provider value={{
            players, status, progress, logs, verificationLogs, errorMsg, getUrl,
            currentPlayer, currentStep,
            setGetUrl, handleLoadList, startProcessing, pauseProcessing,
            resetProcessor, clearLogs, syncAllPlayers
        }}>
            {children}
        </BatchProcessorContext.Provider>
    );
};

export const useBatchProcessor = () => {
    const context = useContext(BatchProcessorContext);
    if (!context) throw new Error('useBatchProcessor must be used within a BatchProcessorProvider');
    return context;
};
