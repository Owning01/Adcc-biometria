import React, { useReducer, useState, useEffect, ChangeEvent } from 'react';
import { Terminal, Upload, Play, RefreshCw, ClipboardPaste, Database, Trophy } from 'lucide-react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { getFaceDescriptorLocal, loadModelsLocal } from '../services/faceServiceLocal';
import { saveUser, checkDniExists } from '../services/db';
import { getMatches, deleteMatch, saveMatch, saveMatchWithId } from '../services/matchesService';
import { fetchADCCMatches, fetchADCCMatchDetail, ADCCMatch } from '../services/adccService';
import MatchManager from '../components/DevTools/MatchManager';
import ImportResultLog from '../components/DevTools/ImportResultLog';
import BatchPhotoProcessor from '../components/DevTools/BatchPhotoProcessor';
import { Globe, UserCheck, Image as ImageIcon } from 'lucide-react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getTeams, saveTeam } from '../services/teamsService';
import { getAdccImageUrl } from '../utils/imageUtils';

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
    const [mode, setMode] = useState<'files' | 'universal' | 'matches' | 'adcc' | 'batch_photos'>('files');

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

    const loadADCCMatches = async () => {
        dispatch({ type: 'SET_LOADING_ADCC', loading: true });
        try {
            const response = await fetchADCCMatches(1); // Page 1 for now
            dispatch({ type: 'SET_ADCC_MATCHES', matches: response.data });
        } catch (error: any) {
            alert("Error al cargar partidos de ADCC: " + error.message);
        } finally {
            dispatch({ type: 'SET_LOADING_ADCC', loading: false });
        }
    };

    const handleImportFromADCC = async (adccMatch: ADCCMatch) => {
        // Verificar si ya existe
        const existing = state.matches.find(m => m.realId === adccMatch.id);
        if (existing) {
            alert("Este partido ya ha sido importado.");
            return;
        }

        if (!confirm(`¿Importar partido ${adccMatch.local_nombre} vs ${adccMatch.visitante_nombre}?`)) return;

        dispatch({ type: 'START_IMPORT' });
        try {
            // Fetch match detail for players
            const detail = await fetchADCCMatchDetail(adccMatch.id);

            const newMatch = {
                realId: adccMatch.id,
                tournamentId: 'adcc-imported', // Placeholder till we have better mapping
                teamA: {
                    name: adccMatch.local_nombre,
                    logo: adccMatch.local_escudo
                },
                teamB: {
                    name: adccMatch.visitante_nombre,
                    logo: adccMatch.visitante_escudo
                },
                date: adccMatch.dia.split(' ')[0],
                time: adccMatch.dia.split(' ')[1]?.substring(0, 5) || '00:00',
                status: 'scheduled',
                category: adccMatch.categoria,
                liga: adccMatch.liga,
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

            const customMatchId = `adcc_${adccMatch.id}`;
            await saveMatchWithId(customMatchId, newMatch);
            alert("Partido importado con éxito.");
            loadMatches();
        } catch (error) {
            alert("Error durante la importación.");
        } finally {
            dispatch({ type: 'FINISH_IMPORT' });
        }
    };

    const handleSyncAllADCCPlayers = async () => {
        dispatch({ type: 'START_IMPORT' });
        dispatch({ type: 'SET_PROGRESS', progress: 1 });

        try {
            const playersMap = new Map<string, any>();
            const pagesToFetch = 3;

            for (let page = 1; page <= pagesToFetch; page++) {
                const matchesRes = await fetchADCCMatches(page);

                for (const match of matchesRes.data) {
                    const detail = await fetchADCCMatchDetail(match.id);

                    // IMPORTAR PARTIDO
                    const matchToSave = {
                        realId: match.id,
                        tournamentId: 'adcc-imported',
                        teamA: { name: match.local_nombre, logo: match.local_escudo },
                        teamB: { name: match.visitante_nombre, logo: match.visitante_escudo },
                        date: match.dia.split(' ')[0],
                        time: match.dia.split(' ')[1]?.substring(0, 5) || '00:00',
                        status: 'scheduled',
                        category: match.categoria,
                        liga: match.liga,
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

                    // PROCESAR JUGADORES
                    const allPlayers = [...detail.equipo_local, ...detail.equipo_visitante];
                    allPlayers.forEach(p => {
                        const dni = String(p.dni);
                        if (!playersMap.has(dni)) {
                            playersMap.set(dni, {
                                name: `${p.nombre} ${p.apellido}`,
                                dni: dni,
                                team: detail.equipo_local.some(lp => lp.dni === p.dni) ? match.local_nombre : match.visitante_nombre,
                                category: match.categoria,
                                status: 'habilitado',
                                jleid: p.jleid,
                                categories: [match.categoria]
                            });
                        }
                    });
                }
                dispatch({ type: 'SET_PROGRESS', progress: (page / pagesToFetch) * 40 });
            }

            const uniquePlayers = Array.from(playersMap.values());
            const total = uniquePlayers.length;
            let importedCount = 0;

            for (let i = 0; i < total; i++) {
                const p = uniquePlayers[i];
                const exists = await checkDniExists(p.dni);

                if (!exists) {
                    await saveUser(p);
                    importedCount++;
                }

                dispatch({ type: 'SET_PROGRESS', progress: 40 + (((i + 1) / total) * 60) });
            }

            alert(`Sincronización completa. ${importedCount} jugadores nuevos importados.`);
        } catch (error) {
            console.error("Sync error:", error);
            alert("Error durante la sincronización masiva.");
        } finally {
            dispatch({ type: 'FINISH_IMPORT' });
        }
    };

    const handleSyncTeamLogos = async () => {
        dispatch({ type: 'START_IMPORT' });
        dispatch({ type: 'SET_PROGRESS', progress: 1 });

        try {
            const teams = await getTeams();
            const total = teams.length;
            let current = 0;

            for (const team of teams) {
                current++;
                dispatch({ type: 'SET_PROGRESS', progress: Math.round((current / total) * 100) });

                if (team.adccLogoUrl && !team.logoUrl) {
                    try {
                        const compressedUrl = await compressAndUploadLogo(team.adccLogoUrl, team.id);
                        await saveTeam({ ...team, logoUrl: compressedUrl });
                        dispatch({
                            type: 'ADD_RESULT',
                            result: { name: team.name, status: 'success', message: 'Logo comprimido y subido' }
                        });
                    } catch (e) {
                        console.error(`Error processing logo for ${team.name}:`, e);
                        dispatch({
                            type: 'ADD_RESULT',
                            result: { name: team.name, status: 'error', message: 'Error procesando imagen' }
                        });
                    }
                }
            }
            alert("Sincronización de logos completada.");
        } catch (error) {
            console.error("Logo sync error:", error);
            alert("Error al sincronizar logos.");
        } finally {
            dispatch({ type: 'FINISH_IMPORT' });
        }
    };

    const compressAndUploadLogo = (url: string, teamId: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const proxyUrl = getAdccImageUrl(url);

            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject("No context");

                const maxWidth = 200;
                const maxHeight = 200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(async (blob) => {
                    if (!blob) return reject("Blob error");
                    try {
                        const logoRef = ref(storage, `logos/${teamId}.webp`);
                        await uploadBytes(logoRef, blob);
                        const downloadUrl = await getDownloadURL(logoRef);
                        resolve(downloadUrl);
                    } catch (e) {
                        reject(e);
                    }
                }, "image/webp", 0.8);
            };
            img.onerror = () => reject("Load error");
            img.src = proxyUrl;
        });
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

                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                    <button
                        className={`glass-button ${mode === 'files' ? 'active' : ''}`}
                        onClick={() => setMode('files')}
                        style={{ background: mode === 'files' ? 'rgba(59, 130, 246, 0.2)' : '' }}
                    >
                        <Upload size={18} /> JSON Files
                    </button>
                    <button
                        className={`glass-button ${mode === 'universal' ? 'active' : ''}`}
                        onClick={() => setMode('universal')}
                        style={{ background: mode === 'universal' ? 'rgba(59, 130, 246, 0.2)' : '' }}
                    >
                        <ClipboardPaste size={18} /> Universal Import
                    </button>
                    <button
                        className={`glass-button ${mode === 'matches' ? 'active' : ''}`}
                        onClick={() => setMode('matches')}
                        style={{ background: mode === 'matches' ? 'rgba(16, 185, 129, 0.2)' : '' }}
                    >
                        <Trophy size={18} /> Partidos Activos
                    </button>
                    <button
                        className={`glass-button ${mode === 'adcc' ? 'active' : ''}`}
                        onClick={() => setMode('adcc')}
                        style={{ background: mode === 'adcc' ? 'rgba(245, 158, 11, 0.2)' : '' }}
                    >
                        <Globe size={18} /> ADCC API
                    </button>
                    <button
                        className={`glass-button ${mode === 'batch_photos' ? 'active' : ''}`}
                        onClick={() => setMode('batch_photos')}
                        style={{ background: mode === 'batch_photos' ? 'rgba(139, 92, 246, 0.2)' : '' }}
                    >
                        <ImageIcon size={18} /> Procesador Masivo Fotos
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
                    ) : mode === 'adcc' ? (
                        <m.div
                            key="adcc"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="p-6"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Partidos ADCC</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Listado de partidos disponibles para importar</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={handleSyncAllADCCPlayers}
                                        disabled={state.isProcessing}
                                        className="glass-button"
                                        style={{ fontSize: '0.8rem', background: 'var(--primary)', color: 'white' }}
                                    >
                                        <Database size={16} style={{ marginRight: '8px' }} />
                                        {state.isProcessing ? `Sincronizando ${Math.round(state.progress)}%` : 'Sincronizar Base de Jugadores'}
                                    </button>
                                    <button
                                        onClick={handleSyncTeamLogos}
                                        disabled={state.isProcessing}
                                        className="glass-button"
                                        style={{ fontSize: '0.8rem', background: 'var(--accent)', color: 'white' }}
                                    >
                                        <ImageIcon size={16} style={{ marginRight: '8px' }} />
                                        Sincronizar Logos
                                    </button>
                                    <button
                                        onClick={loadADCCMatches}
                                        className="glass-button button-secondary"
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        <RefreshCw size={16} style={{ marginRight: '8px' }} /> Actualizar
                                    </button>
                                </div>
                            </div>

                            {state.loadingADCC ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px', background: 'rgba(255,255,255,0.02)', borderRadius: '30px', border: '1px dashed var(--glass-border)' }}>
                                    <RefreshCw className="animate-spin" size={40} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                    <p style={{ color: 'var(--text-muted)' }}>Conectando con ADCC Canning...</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                    {state.adccMatches.map(match => (
                                        <m.div
                                            key={match.id}
                                            layout
                                            className="glass-panel"
                                            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', margin: '0 auto 10px' }}>
                                                        <img
                                                            src={getAdccImageUrl(match.local_escudo)}
                                                            alt={match.local_nombre}
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=. ' }}
                                                        />
                                                    </div>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.local_nombre}</p>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>VS</span>
                                                </div>

                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', margin: '0 auto 10px' }}>
                                                        <img
                                                            src={getAdccImageUrl(match.visitante_escudo)}
                                                            alt={match.visitante_nombre}
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Logo' }}
                                                        />
                                                    </div>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.visitante_nombre}</p>
                                                </div>
                                            </div>

                                            <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />

                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '5px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>{match.dia.split(' ')[0]}</span>
                                                    <span style={{ width: '4px', height: '4px', background: 'rgba(59,130,246,0.3)', borderRadius: '50%' }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>{match.dia.split(' ')[1]?.substring(0, 5)}</span>
                                                </div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{match.liga}</p>
                                                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{match.categoria}</p>
                                            </div>

                                            <button
                                                onClick={() => handleImportFromADCC(match)}
                                                disabled={state.isProcessing}
                                                className="glass-button"
                                                style={{ width: '100%', height: '50px', fontSize: '0.75rem' }}
                                            >
                                                {state.isProcessing ? 'PROCESANDO...' : 'IMPORTAR PARTIDO'}
                                            </button>
                                        </m.div>
                                    ))}
                                </div>
                            )}
                    )}
                        </AnimatePresence>
        </div>
        </LazyMotion >
    );
};

export default DevTools;
