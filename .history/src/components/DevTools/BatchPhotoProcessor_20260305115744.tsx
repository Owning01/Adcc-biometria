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

    const [currentProcessing, setCurrentProcessing] = useState<{
        player: any | null,
        status: string,
        fotoValida: boolean | null,
        descriptorExtraido: boolean | null,
        postEnviado: boolean | null
    }>({
        player: null,
        status: '',
        fotoValida: null,
        descriptorExtraido: null,
        postEnviado: null
    });

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
            log(`❌ Error al cargar la lista: ${err.message}`);
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

            setCurrentProcessing({
                player,
                status: 'Iniciando...',
                fotoValida: null,
                descriptorExtraido: null,
                postEnviado: null
            });

            // Skip if they already have face_api defined (assuming api sends it)
            if (player.face_api && player.face_api.length > 10) {
                log(`[${i + 1}/${players.length}] Saltando ${player.nombre} (ya tiene face_api)`);
                setProgress(p => ({ ...p, processed: i + 1, success: p.success + 1 }));
                continue;
            }

            try {
                log(`Procesando ${player.nombre} ${player.apellido}...`);

                if (!player.foto) {
                    setCurrentProcessing(prev => ({ ...prev, status: 'Sin foto', fotoValida: false }));
                    throw new Error("No hay URL de foto");
                }

                // 1. Download & Draw Image
                setCurrentProcessing(prev => ({ ...prev, status: 'Descargando foto...' }));
                const img = await loadImageFromUrl(player.foto);
                const { blob, canvas } = await getCompressedBlobAndCanvas(img);
                setCurrentProcessing(prev => ({ ...prev, fotoValida: true }));

                // 2. Extract Descriptor
                setCurrentProcessing(prev => ({ ...prev, status: 'Extrayendo rostro...' }));
                const descriptor = await getFaceDescriptorLocal(canvas as unknown as HTMLImageElement); // FaceAPI accepts canvas too
                if (!descriptor) {
                    setCurrentProcessing(prev => ({ ...prev, status: 'Rostro no detectado', descriptorExtraido: false }));
                    throw new Error("No se detectó un rostro de frente claro.");
                }
                setCurrentProcessing(prev => ({ ...prev, descriptorExtraido: true }));

                // 3. Upload Compressed Image to Firebase
                setCurrentProcessing(prev => ({ ...prev, status: 'Subiendo a Firebase...' }));
                const fileRef = ref(storage, `jugadores_bulk/${player.id || player.dni}_${Date.now()}.webp`);
                await uploadBytes(fileRef, blob);
                const firebaseUrl = await getDownloadURL(fileRef);

                // 4. Save to Local Firestore DB for CheckIn
                setCurrentProcessing(prev => ({ ...prev, status: 'Guardando en BDD Local...' }));
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
                setCurrentProcessing(prev => ({ ...prev, status: 'Enviando POST a API...' }));
                const descriptorJson = JSON.stringify(Array.from(descriptor));
                const postRes = await fetch(postUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        id: player.id,
                        face_api: descriptorJson
                    })
                });

                if (!postRes.ok) {
                    setCurrentProcessing(prev => ({ ...prev, status: 'Error en POST', postEnviado: false }));
                    throw new Error(`POST falló: ${postRes.statusText}`);
                }
                setCurrentProcessing(prev => ({ ...prev, status: 'Completado', postEnviado: true }));

                setProgress(p => ({ ...p, processed: i + 1, success: p.success + 1 }));
                log(`✅ Completado: ${player.nombre} ${player.apellido}`);

            } catch (err: any) {
                setProgress(p => ({ ...p, processed: i + 1, failed: p.failed + 1 }));
                log(`❌ Falló ${player.nombre}: ${err.message}`);
                // Continue to next iteration automatically
            }
        }

        setStatus('finished');
        setCurrentProcessing({ player: null, status: 'Finalizado', fotoValida: null, descriptorExtraido: null, postEnviado: null });
        log("Procesamiento Masivo Finalizado.");
    };

    const handlePause = () => {
        isPausedRef.current = true;
    };

    const handleStop = () => {
        stopRef.current = true;
    };

    return (
    );
}

function StatusBadge({ label, success }: { label: string, success: boolean | null }) {
    let bg = 'var(--background-color)';
    let color = 'var(--text-muted)';
    let icon = <span style={{ fontSize: '10px', opacity: 0.5 }}>⏳</span>;

    if (success === true) {
        bg = 'rgba(16, 185, 129, 0.1)';
        color = 'var(--success-color)';
        icon = <CheckCircle size={14} />;
    } else if (success === false) {
        bg = 'rgba(239, 68, 68, 0.1)';
        color = 'var(--danger-color)';
        icon = <AlertCircle size={14} />;
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '4px', background: bg, color: color, fontSize: '0.8rem', fontWeight: 600 }}>
            <span>{label}</span>
            {icon}
        </div>
    );
}
