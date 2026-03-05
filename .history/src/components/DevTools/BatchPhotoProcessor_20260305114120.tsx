import React, { useState, useRef } from 'react';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { loadModelsLocal, getFaceDescriptorLocal } from '../../services/faceServiceLocal';
import { saveUser } from '../../services/db';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function BatchPhotoProcessor() {
    const [getUrl, setGetUrl] = useState('https://adccanning.com.ar/api/jugadores'); // Placeholder
    const [postUrl, setPostUrl] = useState('https://adccanning.com.ar/api/jugadores/face_api'); // Placeholder
    const [players, setPlayers] = useState<any[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading_list' | 'ready' | 'processing' | 'paused' | 'finished' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState({ processed: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    // Use refs to control the processing loop allowing it to be paused
    const isPausedRef = useRef(false);
    const stopRef = useRef(false);

    const log = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 100)); // Keep last 100 logs
    };

    const handleLoadList = async () => {
        try {
            setStatus('loading_list');
            setErrorMsg('');
            // Usually we might need a proxy or the API might allow CORS
            // We use a direct fetch here, but if it fails we might need to proxy it in vite.config.ts
            const res = await fetch(getUrl);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();

            // Assume data is an array, or data.data
            const list = Array.isArray(data) ? data : (data.data || []);

            // Filter players that need processing (no face_api yet, or we force all)
            // For now, let's load all and let the user see them
            setPlayers(list);
            setProgress({ processed: 0, total: list.length, success: 0, failed: 0 });
            setStatus('ready');
            log(`Lista cargada: ${list.length} jugadores encontrados.`);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'Error cargando la lista');
            log(`Error: ${err.message}`);
        }
    };

    // Helper to loadImage via proxy to avoid Canvas Tainted Canvas / CORS errors
    const loadImageFromUrl = async (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // Crucial for Canvas extraction
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + url));

            // Try fetching via proxy if necessary, else direct. Let's try direct first.
            img.src = url;
        });
    };

    // Helper to compress image and get Blob
    const getCompressedBlobAndCanvas = (img: HTMLImageElement): Promise<{ blob: Blob, canvas: HTMLCanvasElement }> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No 2d context');

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) reject(new Error('Canvas is empty'));
                else resolve({ blob, canvas });
            }, 'image/webp', 0.8);
        });
    };

    const processBatch = async () => {
        setStatus('processing');
        isPausedRef.current = false;
        stopRef.current = false;

        await loadModelsLocal(); // Ensure models are loaded
        log("Modelos de Face API cargados.");

        for (let i = progress.processed; i < players.length; i++) {
            if (isPausedRef.current || stopRef.current) {
                if (isPausedRef.current) setStatus('paused');
                if (stopRef.current) setStatus('ready');
                return;
            }

            const player = players[i];

            // Skip if they already have face_api defined (assuming api sends it)
            if (player.face_api && player.face_api.length > 10) {
                log(`[${i + 1}/${players.length}] Saltando ${player.nombre} (ya tiene face_api)`);
                setProgress(p => ({ ...p, processed: i + 1, success: p.success + 1 }));
                continue;
            }

            try {
                log(`[${i + 1}/${players.length}] Procesando ${player.nombre} ${player.apellido}...`);

                if (!player.foto) throw new Error("No hay URL de foto");

                // 1. Download & Draw Image
                const img = await loadImageFromUrl(player.foto);
                const { blob, canvas } = await getCompressedBlobAndCanvas(img);

                // 2. Extract Descriptor
                const descriptor = await getFaceDescriptorLocal(canvas as unknown as HTMLImageElement); // FaceAPI accepts canvas too
                if (!descriptor) throw new Error("No se detectó un rostro de frente claro.");

                // 3. Upload Compressed Image to Firebase
                const fileRef = ref(storage, `jugadores_bulk/${player.id || player.dni}_${Date.now()}.webp`);
                await uploadBytes(fileRef, blob);
                const firebaseUrl = await getDownloadURL(fileRef);

                // 4. Save to Local Firestore DB for CheckIn
                await saveUser({
                    dni: player.dni?.toString() || player.id?.toString(),
                    nombre: player.nombre,
                    apellido: player.apellido,
                    imagen: firebaseUrl,
                    descriptor: Array.from(descriptor),
                    status: 'activo',
                    liga: player.liga || '',
                    categoria: player.categoria || ''
                });

                // 5. POST back to API
                const descriptorJson = JSON.stringify(Array.from(descriptor));
                const postRes = await fetch(postUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        id: player.id,
                        face_api: descriptorJson
                    })
                });

                if (!postRes.ok) throw new Error(`POST falló: ${postRes.statusText}`);

                setProgress(p => ({ ...p, processed: i + 1, success: p.success + 1 }));
                log(`✅ Completado: ${player.nombre} ${player.apellido}`);

            } catch (err: any) {
                setProgress(p => ({ ...p, processed: i + 1, failed: p.failed + 1 }));
                log(`❌ Falló ${player.nombre}: ${err.message}`);
            }
        }

        setStatus('finished');
        log("Procesamiento Masivo Finalizado.");
    };

    const handlePause = () => {
        isPausedRef.current = true;
    };

    const handleStop = () => {
        stopRef.current = true;
    };

    return (
        <div className="glass-panel" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <ImageIcon className="text-purple-600" size={28} />
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Procesador Masivo de Fotos</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>URL GET (Listado de Jugadores)</label>
                    <input
                        className="glass-input"
                        value={getUrl}
                        onChange={e => setGetUrl(e.target.value)}
                        placeholder="https://..."
                        disabled={status === 'processing'}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>URL POST (Actualizar face_api)</label>
                    <input
                        className="glass-input"
                        value={postUrl}
                        onChange={e => setPostUrl(e.target.value)}
                        placeholder="https://..."
                        disabled={status === 'processing'}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button
                    className="glass-button"
                    onClick={handleLoadList}
                    disabled={status === 'loading_list' || status === 'processing'}
                >
                    <RefreshCw size={18} className={status === 'loading_list' ? 'spin' : ''} />
                    Cargar Lista
                </button>

                {status !== 'idle' && status !== 'loading_list' && (
                    <>
                        {status !== 'processing' ? (
                            <button className="glass-button" style={{ background: 'var(--success-color)', color: 'white' }} onClick={processBatch}>
                                <Play size={18} /> {status === 'paused' ? 'Continuar' : 'Iniciar Procesamiento'}
                            </button>
                        ) : (
                            <button className="glass-button" style={{ background: 'var(--warning-color)', color: 'white' }} onClick={handlePause}>
                                <Pause size={18} /> Pausar
                            </button>
                        )}
                    </>
                )}
            </div>

            {errorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '12px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} /> {errorMsg}
                </div>
            )}

            {players.length > 0 && (
                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ fontWeight: 600 }}>Progreso: {progress.processed} / {progress.total}</span>
                        <span style={{ color: 'var(--success-color)' }}>Éxitos: {progress.success}</span>
                        <span style={{ color: 'var(--danger-color)' }}>Errores: {progress.failed}</span>
                    </div>

                    <div style={{ height: '12px', background: 'var(--background-color)', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                        <div style={{
                            height: '100%',
                            background: 'var(--primary-color)',
                            width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--background-color)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {logs.map((L, idx) => (
                            <div key={idx} style={{ color: L.includes('❌') ? 'var(--danger-color)' : L.includes('✅') ? 'var(--success-color)' : 'var(--text-color)', marginBottom: '4px' }}>
                                {L}
                            </div>
                        ))}
                        {logs.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Esperando iniciar...</span>}
                    </div>
                </div>
            )}
        </div>
    );
}
