import React, { useState } from 'react';
import { Terminal, Upload, FileJson, Play, CheckCircle2, AlertCircle, RefreshCw, Layers, ClipboardPaste, Database, Trash2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { processFaceImage } from '../services/faceService';
import { loadModelsLocal, getFaceDescriptorLocal } from '../services/faceServiceLocal';
import { saveUser, checkDniExists } from '../services/db';
import { getMatches, deleteMatch } from '../services/matchesService';

const DevTools = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [rawInput, setRawInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const [progress, setProgress] = useState(0);
    const [mode, setMode] = useState('files'); // 'files', 'universal', or 'matches'
    const [matches, setMatches] = useState([]);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(files);
        setResults([]);
        setProgress(0);
    };

    const parseUniversal = (text) => {
        try {
            // Intentar parsear como JSON primero
            if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                return JSON.parse(text);
            }

            // Si no es JSON, intentar como CSV/Tabulado (Excel)
            const lines = text.trim().split('\n');
            if (lines.length < 1) return [];

            const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());
            return lines.slice(1).map(line => {
                const values = line.split(/[,\t]/).map(v => v.trim());
                const obj = {};
                headers.forEach((h, i) => {
                    // Mapeo inteligente de columnas
                    if (h.includes('nom') || h.includes('jugador')) obj.name = values[i];
                    if (h.includes('dni') || h.includes('ident')) obj.dni = values[i];
                    if (h.includes('equi') || h.includes('club')) obj.team = values[i];
                    if (h.includes('cat') || h.includes('div')) obj.category = values[i];
                    if (h.includes('foto') || h.includes('img') || h.includes('photo')) obj.photo = values[i];
                });
                return obj;
            }).filter(o => o.name || o.dni); // Filtrar filas vacías

        } catch (e) {
            console.error("Error parseando:", e);
            return [];
        }
    };

    const runImport = async () => {
        setIsProcessing(true);
        const newResults = [];
        let itemsToProcess = [];

        // Asegurar que los modelos estén cargados
        const loadRes = await loadModelsLocal();
        if (!loadRes.success) {
            alert("No se pudieron cargar los modelos de IA localmente: " + loadRes.error);
            setIsProcessing(false);
            return;
        }

        if (mode === 'files') {
            if (selectedFiles.length === 0) { alert("Selecciona archivos"); setIsProcessing(false); return; }
            itemsToProcess = selectedFiles.map(f => ({ file: f }));
        } else {
            itemsToProcess = parseUniversal(rawInput);
            if (itemsToProcess.length === 0) {
                alert("No se pudieron detectar datos válidos. Verifica el formato.");
                setIsProcessing(false);
                return;
            }
        }

        const total = itemsToProcess.length;

        for (let i = 0; i < total; i++) {
            const item = itemsToProcess[i];
            const result = { name: '', status: 'pending', message: '' };

            try {
                let userData = {};
                let imgSource = '';

                if (mode === 'files') {
                    const parts = item.file.name.split('.')[0].split('-').map(p => p.trim());
                    userData = {
                        name: parts[0] || "Importado",
                        dni: parts[1] || Math.floor(Math.random() * 1000000).toString(),
                        team: "CARGA MANUAL",
                        category: "GENERAL"
                    };
                    result.name = item.file.name;
                    imgSource = await fileToBase64(item.file);
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
                    // Crear elemento imagen para face-api
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = imgSource;

                    await new Promise((res, rej) => {
                        img.onload = res;
                        img.onerror = () => rej(new Error("Error al cargar imagen"));
                        setTimeout(() => rej(new Error("Timeout (15s)")), 15000);
                    });

                    // USAR MOTOR LOCAL (Igual que en Consulta Ultra)
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
            } catch (err) {
                result.status = 'error';
                result.message = err.message;
            }

            newResults.push(result);
            setResults([...newResults]);
            setProgress(((i + 1) / total) * 100);
        }
        setIsProcessing(false);
    };

    const loadMatches = async () => {
        const data = await getMatches();
        setMatches(data);
    };

    const handleDeleteMatch = async (id) => {
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

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    return (
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
                >
                    <Upload size={18} /> Por Archivos
                </button>
                <button
                    onClick={() => setMode('universal')}
                    className={`glass-button ${mode === 'universal' ? '' : 'button-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '12px 24px' }}
                >
                    <ClipboardPaste size={18} /> Importador Inteligente
                </button>
                <button
                    onClick={() => { setMode('matches'); loadMatches(); }}
                    className={`glass-button ${mode === 'matches' ? 'button-danger' : 'button-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '12px 24px' }}
                >
                    <Trophy size={18} /> Gestionar Partidos
                </button>
            </div>

            {mode === 'matches' ? (
                <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Gestión de Partidos</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Control total sobre la base de datos de partidos</p>
                        </div>
                        <button
                            onClick={clearAllMatches}
                            className="glass-button"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >
                            <Trash2 size={16} /> Eliminar Todo
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                        {matches.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', opacity: 0.5 }}>
                                No hay partidos registrados.
                            </div>
                        ) : (
                            matches.map(m => (
                                <div key={m.id} className="glass-panel" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{m.teamA?.name} vs {m.teamB?.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.date} - {m.time} HS</div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteMatch(m.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 900 ? '1.2fr 1fr' : '1fr', gap: '30px' }}>
                    {/* Panel de Entrada */}
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
                            disabled={isProcessing || (mode === 'files' && selectedFiles.length === 0) || (mode === 'universal' && !rawInput)}
                            className="glass-button"
                            style={{ width: '100%', height: '60px' }}
                        >
                            {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                            {isProcessing ? `PROCESANDO ${Math.round(progress)}%...` : 'COMENZAR IMPORTACIÓN IA'}
                        </button>
                    </div>

                    {/* Log de Resultados */}
                    <div className="glass-panel" style={{ padding: '25px', maxHeight: '580px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>HISTORIAL DE PROCESAMIENTO</h4>
                            <span className="status-badge" style={{ fontSize: '0.65rem' }}>{results.length} ÍTEMS</span>
                        </div>

                        {results.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.15 }}>
                                <RefreshCw size={50} style={{ margin: '0 auto 15px' }} />
                                <p style={{ fontSize: '0.9rem' }}>Esperando datos para analizar...</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {results.map((r, i) => (
                                    <div key={i} style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${r.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : r.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}` }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: r.status === 'error' ? '#ef4444' : '#10b981', opacity: 0.9 }}>{r.message}</div>
                                        </div>
                                        {r.status === 'success' ? <CheckCircle2 size={18} color="#10b981" /> : r.status === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <RefreshCw size={18} className="animate-spin" opacity={0.3} />}
                                    </div>
                                )).reverse()}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevTools;
