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
    playerTeamMap: Record<number, { team: string; category: string }>;
    isMappingLoaded: boolean;
    loadTeamMapping: () => Promise<void>;
    downloadImages: () => Promise<void>;
}

const BatchProcessorContext = createContext<BatchProcessorContextType | undefined>(undefined);

export const BatchProcessorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    const [playerTeamMap, setPlayerTeamMap] = useState<Record<number, { team: string; category: string }>>({});
    const [isMappingLoaded, setIsMappingLoaded] = useState(false);

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

            // Normalización CRÍTICA: Asegurar que nombre y apellido existan siempre
            const nombre = p.nombre || p.nombre_jugador || '';
            const apellido = p.apellido || p.apellido_jugador || '';

            return {
                ...p,
                nombre,
                apellido,
                processed_foto: foto
            };
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

const loadTeamMapping = async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const fetchWithRetry = async (url: string, options: any, retries = 3, backoff = 1000): Promise<Response> => {
        try {
            const res = await fetch(url, options);
            if (res.status === 429 && retries > 0) {
                log(`⚠️ API saturada (429). Reintentando en ${backoff}ms...`);
                await delay(backoff);
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            return res;
        } catch (err) {
            if (retries > 0) {
                await delay(backoff);
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw err;
        }
    };

    try {
        setStatus('loading_list');
        setErrorMsg('');
        log('Iniciando carga de mapeo de equipos y categorías desde /api-adcc/api/partidos...');

        // Solo mapearemos jugadores que están actualmente cargados en el lote
        const validPlayerIds = new Set(players.map(p => Number(p.id)));
        log(`Buscando coincidencias para ${validPlayerIds.size} jugadores en el sistema...`);

        // Loguear una muestra de IDs cargados para cotejar con la consola
        const sampleIds = Array.from(validPlayerIds).slice(0, 5);
        console.log('[MAPPING] Muestra de IDs cargados en memoria:', sampleIds);

        const newMap: Record<number, { team: string; category: string }> = {};

        // Fetch all match pages
        let currentPageUrl: string | null = '/api-adcc/api/partidos?page=1';
        let pageCount = 0;
        const matchesToFetch: number[] = [];

        while (currentPageUrl) {
            pageCount++;
            const actualUrl: string = currentPageUrl.startsWith('http')
                ? currentPageUrl.replace('https://adccanning.com.ar', '/api-adcc')
                : currentPageUrl;

            const res = await fetchWithRetry(actualUrl, {
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_ADCC_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data: any = await res.json();

            // Intentar encontrar la lista de partidos en varias propiedades comunes
            const list = Array.isArray(data) ? data : (data.partidos || data.data || data.matches || []);

            if (list.length === 0 && pageCount === 1) {
                log('⚠️ No se encontraron partidos en la primera página de la API.');
            }

            for (const match of list) {
                if (match && match.id) {
                    matchesToFetch.push(match.id);
                }
            }

            currentPageUrl = data.next_page_url || (data.current_page < data.last_page ? `/api-adcc/api/partidos?page=${data.current_page + 1}` : null);
            if (pageCount >= 15) break; // Aumentar un poco el límite
        }

        log(`Mapeando jugadores de ${matchesToFetch.length} partidos. Esto puede tomar unos momentos...`);

        let fetchedCount = 0;
        // Fetch match details in chunks to avoid overwhelming the server
        const chunkSize = 5;
        for (let i = 0; i < matchesToFetch.length; i += chunkSize) {
            const chunk = matchesToFetch.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (matchId) => {
                try {
                    const detailRes = await fetchWithRetry(`/api-adcc/api/partido/${matchId}`, {
                        headers: {
                            'Authorization': `Bearer ${import.meta.env.VITE_ADCC_TOKEN}`,
                            'Accept': 'application/json'
                        }
                    });
                    if (!detailRes.ok) return;
                    const detail = await detailRes.json();

                    const partido = detail.partido || {};
                    const localName = partido.local_nombre || '';
                    const visitName = partido.visitante_nombre || '';
                    const categoria = partido.categoria || '';

                    const procPlayer = (p: any, tName: string) => {
                        const pid = p.jugador_id || p.id;
                        const numPid = Number(pid);

                        if (pid && validPlayerIds.has(numPid)) {
                            if (!newMap[numPid]) {
                                console.log(`[MAPPING] MATCH: ${pid} -> ${tName} (${categoria})`);
                            }
                            newMap[numPid] = { team: tName, category: categoria };
                        } else if (pid && Math.random() < 0.05) {
                            // Loguear el 5% de los fallos para ver los IDs que vienen
                            console.log(`[MAPPING] No match for pid ${pid} (type: ${typeof pid}). validPlayerIds has ${validPlayerIds.size} entries.`);
                        }
                    };

                    if (Array.isArray(detail.equipo_local)) {
                        detail.equipo_local.forEach((p: any) => procPlayer(p, localName));
                    }
                    if (Array.isArray(detail.equipo_visitante)) {
                        detail.equipo_visitante.forEach((p: any) => procPlayer(p, visitName));
                    }
                } catch (e) {
                    // ignore single match errors
                }
            }));
            fetchedCount += chunk.length;
            if (fetchedCount % 10 === 0) {
                log(`Procesados detalles de ${fetchedCount}/${matchesToFetch.length} partidos...`);
            }
            // Pausa obligatoria entre chunks para no saturar
            await delay(800);
        }

        setPlayerTeamMap(newMap);
        setIsMappingLoaded(true);
        setStatus('ready');
        log(`✅ Mapeo de equipos finalizado con éxito. ${Object.keys(newMap).length} jugadores mapeados.`);
    } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Error cargando mapeo de partidos');
        log(`❌ Error al mapear equipos: ${err.message}`);
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

            const playerId = player.id;
            const mapping = playerId ? playerTeamMap[Number(playerId)] : null;

            const result: RegistrationResult = await playerRegistrationService.registerPlayer({
                id: player.id || player.jleid,
                dni: player.dni,
                nombre: player.nombre,
                apellido: player.apellido,
                foto: player.processed_foto,
                team: mapping?.team || player.team || 'null',
                category: mapping?.category || player.category || 'null'
            }, { syncWithApi: false, forceUpdate: true });

            if (result.success) {
                currentProgress.success++;
                setCurrentStep('Completado');

                // Registrar el éxito en la nueva sección persistente (Firestore)
                await playerRegistrationService.logSuccessfulRegistration({
                    id: player.id || player.jleid,
                    nombre: player.nombre,
                    apellido: player.apellido,
                    team: mapping?.team || player.team || 'null',
                    category: mapping?.category || player.category || 'null'
                });

                if (result.alreadyRegistered && !true) { // logical skip since we force update now
                    log(`ℹ️ YA EXISTE: ${player.nombre} ${player.apellido} (Saltado extraction)`);
                    logVerify(`✨ ALREADY IN FIREBASE: ${player.nombre} ${player.apellido}`);
                } else {
                    const isUpdate = result.alreadyRegistered;
                    log(`✅ ${isUpdate ? 'ACTUALIZADO' : 'OK'}: ${player.nombre} ${player.apellido}`);
                    logVerify(`✨ DESCRIPTOR ${isUpdate ? 'UPDATED' : 'OK'}: ${player.nombre} ${player.apellido} - Len: ${result.descriptor?.length}`);
                }

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
            const res = await registerPlayerBiometrics(p.id, p.face_api);
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
    isProcessingRef.current = false;
    setIsMappingLoaded(false);
    setPlayerTeamMap({});
};

const clearLogs = () => {
    setLogs([]);
    setVerificationLogs([]);
};

const downloadImages = async () => {
    if (players.length === 0) {
        log('⚠️ No hay jugadores cargados para descargar.');
        return;
    }

    log(`Iniciando descarga de ${players.length} imágenes...`);
    let downloaded = 0;

    for (const player of players) {
        const fotoUrl = player.processed_foto;
        if (!fotoUrl) continue;

        try {
            // Usar fetch para obtener el blob y forzar descarga con nombre limpio
            const response = await fetch(fotoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${player.nombre}_${player.apellido}_${player.id}.jpg`
                .replace(/[^a-z0-9.]/gi, '_');
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Limpieza
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

            downloaded++;

            // Pausa cada 5 descargas para evitar bloqueos del navegador
            if (downloaded % 5 === 0) {
                await new Promise(r => setTimeout(r, 600));
                log(`Descargadas ${downloaded}/${players.length} imágenes...`);
            }
        } catch (err) {
            console.error(`Error descargando imagen de ${player.id}:`, err);
        }
    }
    log(`✅ Proceso de descarga finalizado. ${downloaded} imágenes procesadas.`);
};

return (
    <BatchProcessorContext.Provider value={{
        players, status, progress, logs, verificationLogs, errorMsg, getUrl,
        currentPlayer, currentStep,
        setGetUrl, handleLoadList, startProcessing, pauseProcessing,
        resetProcessor, clearLogs, syncAllPlayers,
        playerTeamMap, isMappingLoaded, loadTeamMapping, downloadImages
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
