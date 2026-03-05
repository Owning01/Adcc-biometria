import React, { useReducer, useState, useEffect, ChangeEvent } from 'react';
import { Terminal, Upload, Play, RefreshCw, ClipboardPaste, Database, Trophy } from 'lucide-react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { getFaceDescriptorLocal, loadModelsLocal } from '../services/faceServiceLocal';
import { saveUser, checkDniExists } from '../services/db';
import { getMatches, deleteMatch, saveMatch } from '../services/matchesService';
import { fetchADCCMatches, fetchADCCMatchDetail, ADCCMatch } from '../services/adccService';
import MatchManager from '../components/DevTools/MatchManager';
import ImportResultLog from '../components/DevTools/ImportResultLog';
import { Globe } from 'lucide-react';

// --- Tipos ---
interface Result {
    name: string;
    status: 'success' | 'error' | 'pending';
    message: string;
}

interface State {
    isProcessing: boolean;
    results: Result[];
    progress: number;
    matches: any[];
    adccMatches: ADCCMatch[];
    loadingADCC: boolean;
}

type Action =
    | { type: 'START_IMPORT' }
    | { type: 'ADD_RESULT', result: Result }
    | { type: 'SET_PROGRESS', progress: number }
    | { type: 'SET_RESULTS', results: Result[] }
    | { type: 'FINISH_IMPORT' }
    | { type: 'SET_MATCHES', matches: any[] }
    | { type: 'SET_ADCC_MATCHES', matches: ADCCMatch[] }
    | { type: 'SET_LOADING_ADCC', loading: boolean };

// --- Reducer ---
const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'START_IMPORT':
            return { ...state, isProcessing: true, progress: 0 };
        case 'ADD_RESULT':
            return { ...state, results: [...state.results, action.result] };
        case 'SET_PROGRESS':
            return { ...state, progress: action.progress };
        case 'SET_RESULTS':
            return { ...state, results: action.results };
        case 'FINISH_IMPORT':
            return { ...state, isProcessing: false };
        case 'SET_MATCHES':
            return { ...state, matches: action.matches };
        case 'SET_ADCC_MATCHES':
            return { ...state, adccMatches: action.matches };
        case 'SET_LOADING_ADCC':
            return { ...state, loadingADCC: action.loading };
        default:
            return state;
    }
};

const DevTools: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, {
        isProcessing: false,
        results: [],
        progress: 0,
        matches: [],
        adccMatches: [],
        loadingADCC: false
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [rawInput, setRawInput] = useState('');
    const [mode, setMode] = useState<'files' | 'universal' | 'matches' | 'adcc'>('files');

    useEffect(() => {
        if (mode === 'matches') {
            loadMatches();
        } else if (mode === 'adcc') {
            loadADCCMatches();
        }
    }, [mode]);

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setSelectedFiles(files);
        dispatch({ type: 'SET_RESULTS', results: [] });
        dispatch({ type: 'SET_PROGRESS', progress: 0 });
    };

    const parseUniversal = (text: string) => {
        try {
            if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                return JSON.parse(text);
            }

            const lines = text.trim().split('\n');
            if (lines.length < 1) return [];

            const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());
            return lines.slice(1).map(line => {
                const values = line.split(/[,\t]/).map(v => v.trim());
                const obj: any = {};
                headers.forEach((h, i) => {
                    if (h.includes('nom') || h.includes('jugador')) obj.name = values[i];
                    if (h.includes('dni') || h.includes('ident')) obj.dni = values[i];
                    if (h.includes('equi') || h.includes('club')) obj.team = values[i];
                    if (h.includes('cat') || h.includes('div')) obj.category = values[i];
                    if (h.includes('foto') || h.includes('img') || h.includes('photo')) obj.photo = values[i];
                });
                return obj;
            }).filter(o => o.name || o.dni);

        } catch (e) {
            return [];
        }
    };

    const runImport = async () => {
        dispatch({ type: 'START_IMPORT' });

        const loadRes = await loadModelsLocal();
        if (!loadRes.success) {
            alert("No se pudieron cargar los modelos de IA localmente: " + loadRes.error);
            dispatch({ type: 'FINISH_IMPORT' });
            return;
        }

        let itemsToProcess: any[] = [];
        if (mode === 'files') {
            if (selectedFiles.length === 0) { alert("Selecciona archivos"); dispatch({ type: 'FINISH_IMPORT' }); return; }
            itemsToProcess = selectedFiles.map(f => ({ file: f }));
        } else {
            itemsToProcess = parseUniversal(rawInput);
            if (itemsToProcess.length === 0) {
                alert("No se pudieron detectar datos válidos. Verifica el formato.");
                dispatch({ type: 'FINISH_IMPORT' });
                return;
            }
        }

        const total = itemsToProcess.length;

        for (let i = 0; i < total; i++) {
            const item = itemsToProcess[i];
            const result: Result = { name: '', status: 'pending', message: '' };

            try {
                let userData: any = {};
                let imgSource = '';

                if (mode === 'files') {
                    const parts = item.file.name.split('.')[0].split('-').map((p: string) => p.trim());
                    userData = {
                        name: parts[0] || "Importado",
                        dni: parts[1] || Math.floor(Math.random() * 1000000).toString(),
                        team: "CARGA MANUAL",
                        category: "GENERAL"
                    };
                    result.name = item.file.name;
                    imgSource = (await fileToBase64(item.file)) as string;
                } else {
                    userData = {
                        name: item.name || "Sin Nombre",
                        dni: String(item.dni || ""),
                        team: item.team || "ADCC",
                        category: item.category || "GENERAL",
                    };
                    result.name = userData.name;
                    imgSource = item.photo;
                }

                if (!userData.dni) throw new Error("Falta DNI");
                if (!imgSource) throw new Error("Falta Foto");

                const exists = await checkDniExists(userData.dni);
                if (exists) {
                    result.status = 'error';
                    result.message = 'Ya existe (DNI)';
                } else {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = imgSource;

                    await new Promise((res, rej) => {
                        img.onload = res;
                        img.onerror = () => rej(new Error("Error al cargar imagen"));
                        setTimeout(() => rej(new Error("Timeout (15s)")), 15000);
                    });

                    const descriptor = await getFaceDescriptorLocal(img);

                    if (descriptor) {
                        await saveUser({
                            ...userData,
                            descriptor: Array.from(descriptor),
                            photo: imgSource,
                            status: 'habilitado',
                            createdAt: new Date().toISOString()
                        });
                        result.status = 'success';
                        result.message = 'Sincronizado';
                    } else {
                        result.status = 'error';
                        result.message = 'No se detectó rostro';
                    }
                }
            } catch (err: any) {
                result.status = 'error';
                result.message = err.message;
            }

            dispatch({ type: 'ADD_RESULT', result });
            dispatch({ type: 'SET_PROGRESS', progress: ((i + 1) / total) * 100 });
        }
        dispatch({ type: 'FINISH_IMPORT' });
    };

    const loadMatches = async () => {
        const data = await getMatches();
        dispatch({ type: 'SET_MATCHES', matches: data });
    };

    const handleDeleteMatch = async (id: string) => {
        const code = prompt("Código de seguridad:");
        if (code === '777') {
            await deleteMatch(id);
            loadMatches();
        }
    };

    const clearAllMatches = async () => {
        const code = prompt("ATENCIÓN: Se eliminarán TODOS los partidos. Ingrese el código 777 para confirmar:");
        if (code === '777') {
            const matchesToClear = await getMatches();
            for (const m of matchesToClear) {
                await deleteMatch(m.id);
            }
            alert("Partidos eliminados.");
            loadMatches();
        }
    };

    const fileToBase64 = (file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    return (
        <LazyMotion features={domAnimation}>
            <div className="container animate-fade-in">
                <header style={{ marginBottom: '30px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px' }}>
                        <Terminal size={16} /> HERRAMIENTAS DE DESARROLLO • OCTAVIO
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>
                        Importación <span style={{ color: 'var(--primary)' }}>Universal</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Carga masiva desde cualquier formato</p>
                </header>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setMode('files')}
                        className={`glass-button ${mode === 'files' ? '' : 'button-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '12px 24px' }}
                        type="button"
                    >
                        <Upload size={18} /> Por Archivos
                    </button>
                    <button
                        onClick={() => setMode('universal')}
                        className={`glass-button ${mode === 'universal' ? '' : 'button-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '12px 24px' }}
                        type="button"
                    >
                        <ClipboardPaste size={18} /> Importador Inteligente
                    </button>
                    <button
                        onClick={() => setMode('matches')}
                        className={`glass-button ${mode === 'matches' ? 'button-danger' : 'button-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '12px 24px' }}
                        type="button"
                    >
                        <Trophy size={18} /> Gestionar Partidos
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'matches' ? (
                        <m.div
                            key="matches"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MatchManager
                                matches={state.matches}
                                clearAllMatches={clearAllMatches}
                                handleDeleteMatch={handleDeleteMatch}
                            />
                        </m.div>
                    ) : (
                        <m.div
                            key="import"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 900 ? '1.2fr 1fr' : '1fr', gap: '30px' }}
                        >
                            <div className="glass-panel" style={{ padding: '30px' }}>
                                {mode === 'files' ? (
                                    <>
                                        <h3 style={{ marginBottom: '15px' }}>Modo: Galería de Fotos</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                            Subí múltiples fotos. Nombre de archivo sugerido: <b>Nombre-DNI.jpg</b>
                                        </p>
                                        <input type="file" multiple accept="image/*" onChange={handleFileSelect} id="mass-f" style={{ display: 'none' }} />
                                        <label htmlFor="mass-f" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '20px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', marginBottom: '20px' }}>
                                            <Database size={40} opacity={0.1} />
                                            <span style={{ marginTop: '12px', fontSize: '0.9rem', opacity: 0.5 }}>
                                                {selectedFiles.length > 0 ? `${selectedFiles.length} fotos listas` : 'Clic para seleccionar fotos'}
                                            </span>
                                        </label>
                                    </>
                                ) : (
                                    <>
                                        <h3 style={{ marginBottom: '15px' }}>Modo: Pegar Datos (Excel/JSON/CSV)</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                            Pegá tus celdas de Excel o un archivo JSON. El sistema mapeará las columnas solo.
                                        </p>
                                        <textarea
                                            value={rawInput}
                                            onChange={(e) => setRawInput(e.target.value)}
                                            placeholder='Nombre, DNI, Equipo, FotoURL...'
                                            style={{ width: '100%', height: '240px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '13px', marginBottom: '20px', outline: 'none' }}
                                        />
                                    </>
                                )}

                                <button
                                    onClick={runImport}
                                    disabled={state.isProcessing || (mode === 'files' && selectedFiles.length === 0) || (mode === 'universal' && !rawInput)}
                                    className="glass-button"
                                    style={{ width: '100%', height: '60px' }}
                                    type="button"
                                >
                                    {state.isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                                    {state.isProcessing ? `PROCESANDO ${Math.round(state.progress)}%...` : 'COMENZAR IMPORTACIÓN IA'}
                                </button>
                            </div>

                            <ImportResultLog results={state.results} />
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        </LazyMotion>
    );
};

export default DevTools;
