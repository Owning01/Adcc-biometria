import React, { useState, useRef } from 'react';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon, Users, Zap } from 'lucide-react';
import { loadModelsLocal } from '../../services/faceServiceLocal';
import { playerRegistrationService, RegistrationResult } from '../../services/playerRegistrationService';

export default function BatchPhotoProcessor() {
    const [getUrl, setGetUrl] = useState('/api-adcc/api/jugadores');
    const [players, setPlayers] = useState<any[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading_list' | 'ready' | 'processing' | 'paused' | 'finished' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState({ processed: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    const [currentProcessing, setCurrentProcessing] = useState<{
        player: any | null,
        status: string,
        step: string,
        fotoValida: boolean | null,
        descriptorExtraido: boolean | null,
        postEnviado: boolean | null
    }>({
        player: null,
        status: '',
        step: '',
        fotoValida: null,
        descriptorExtraido: null,
        postEnviado: null
    });

    const isPausedRef = useRef(false);
    const stopRef = useRef(false);

    const log = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 100));
    };

    const handleLoadList = async () => {
        try {
            setStatus('loading_list');
            setErrorMsg('');
            let allPlayers: any[] = [];
            let currentPageUrl: string | null = getUrl;
            let pageCount = 0;

            log('Iniciando carga de lista (paginada)...');

            while (currentPageUrl) {
                pageCount++;
                const actualUrl = currentPageUrl.startsWith('http')
                    ? currentPageUrl.replace('https://adccanning.com.ar', '/api-adcc')
                    : currentPageUrl;

                const res = await fetch(actualUrl, {
                    headers: {
                        'Authorization': `Bearer ${import.meta.env.VITE_ADCC_TOKEN}`,
                        'Accept': 'application/json'
                    }
                });

                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} en página ${pageCount}`);
                const data = await res.json();

                const list = Array.isArray(data) ? data : (data.players || data.data || []);
                allPlayers = [...allPlayers, ...list];

                log(`Página ${pageCount} cargada: +${list.length} jugadores.`);

                // Soportar formato de paginación de Laravel/ADCC
                currentPageUrl = data.next_page_url || null;

                // Seguridad para no entrar en loop infinito si algo falla en la API
                if (pageCount > 100) break;
            }

            // Normalización de fotos (asegurar URL completa si es relativa)
            const normalized = allPlayers.map(p => {
                let foto = p.foto || p.imagen || '';
                if (foto && !foto.startsWith('http')) {
                    foto = `https://adccanning.com.ar/jugadores/${foto}`;
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

    const processBatch = async () => {
        setStatus('processing');
        isPausedRef.current = false;
        stopRef.current = false;

        try {
            await loadModelsLocal();
            log("Modelos de Face API cargados.");
        } catch (e) {
            log("❌ Error cargando modelos");
            setStatus('error');
            return;
        }

        for (let i = progress.processed; i < players.length; i++) {
            if (isPausedRef.current || stopRef.current) {
                if (isPausedRef.current) setStatus('paused');
                if (stopRef.current) setStatus('ready');
                return;
            }

            const player = players[i];
            setCurrentProcessing({
                player,
                status: 'Procesando...',
                step: 'Iniciando',
                fotoValida: null,
                descriptorExtraido: null,
                postEnviado: null
            });

            try {
                log(`Procesando [${i + 1}/${players.length}]: ${player.nombre} ${player.apellido}...`);

                const result: RegistrationResult = await playerRegistrationService.registerPlayer({
                    jleid: player.jleid || player.id,
                    dni: player.dni,
                    nombre: player.nombre,
                    apellido: player.apellido,
                    foto: player.processed_foto
                });

                if (result.success) {
                    setCurrentProcessing(prev => ({
                        ...prev,
                        status: 'Completado',
                        step: 'API Sync',
                        fotoValida: true,
                        descriptorExtraido: true,
                        postEnviado: true
                    }));
                    setProgress(p => ({ ...p, processed: i + 1, success: p.success + 1 }));
                    log(`✅ OK: ${player.nombre}`);
                } else {
                    setCurrentProcessing(prev => ({
                        ...prev,
                        status: 'Error',
                        step: result.step,
                        fotoValida: result.step !== 'photo_download',
                        descriptorExtraido: result.step === 'api_sync',
                        postEnviado: false
                    }));
                    setProgress(p => ({ ...p, processed: i + 1, failed: p.failed + 1 }));
                    log(`❌ Falló ${player.nombre}: ${result.error}`);
                }

            } catch (err: any) {
                setProgress(p => ({ ...p, processed: i + 1, failed: p.failed + 1 }));
                log(`❌ Error crítico ${player.nombre}: ${err.message}`);
            }

            // Pequeña pausa para no saturar el main thread (opcional)
            await new Promise(r => setTimeout(r, 100));
        }

        setStatus('finished');
        log("Procesamiento masivo finalizado.");
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Zap size={32} style={{ color: 'var(--accent-color)' }} />
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Procesador Masivo de Fotos</h1>
            </div>

            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}>
                {/* Configuración */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.8 }}>API de Jugadores (GET)</label>
                        <input
                            type="text"
                            value={getUrl}
                            onChange={e => setGetUrl(e.target.value)}
                            disabled={status === 'processing'}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--input-bg)',
                                color: 'var(--text-color)',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                        <button
                            onClick={handleLoadList}
                            disabled={status === 'loading_list' || status === 'processing'}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                background: 'var(--accent-gradient)',
                                color: 'white',
                                border: 'none',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <RefreshCw size={18} className={status === 'loading_list' ? 'spin' : ''} />
                            Cargar Jugadores
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                {players.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                            <span>Progreso General</span>
                            <span>{progress.processed} de {progress.total}</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(progress.processed / progress.total) * 100}%`,
                                height: '100%',
                                background: 'var(--accent-gradient)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                            <ProgressStat label="Pendientes" value={progress.total - progress.processed} color="var(--text-muted)" />
                            <ProgressStat label="Exitosos" value={progress.success} color="var(--success-color)" />
                            <ProgressStat label="Fallidos" value={progress.failed} color="var(--danger-color)" />
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    {status === 'ready' || status === 'paused' || status === 'finished' ? (
                        <button onClick={processBatch} style={btnStyle('var(--success-color)')}>
                            <Play size={20} /> Iniciar / Continuar
                        </button>
                    ) : (
                        <button onClick={() => isPausedRef.current = true} style={btnStyle('var(--warning-color)')} disabled={status !== 'processing'}>
                            <Pause size={20} /> Pausar
                        </button>
                    )}
                    <button onClick={() => stopRef.current = true} style={btnStyle('var(--danger-color)')} disabled={status === 'idle' || status === 'loading_list'}>
                        Detener
                    </button>
                </div>

                {/* Current Player View */}
                {currentProcessing.player && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr',
                        gap: '24px',
                        padding: '20px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '24px'
                    }}>
                        <div style={{ width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                            <img
                                src={currentProcessing.player.foto || currentProcessing.player.imagen}
                                alt="Player"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{currentProcessing.player.nombre} {currentProcessing.player.apellido}</div>
                            <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Estado: <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{currentProcessing.status}</span></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '4px' }}>
                                <StatusBadge label="Foto" success={currentProcessing.fotoValida} />
                                <StatusBadge label="Rostro" success={currentProcessing.descriptorExtraido} />
                                <StatusBadge label="API" success={currentProcessing.postEnviado} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Logs */}
                <div style={{
                    height: '200px',
                    background: '#09090b',
                    borderRadius: '8px',
                    padding: '16px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                }}>
                    {logs.map((log, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', opacity: idx === 0 ? 1 : 0.6 }}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Esperando inicio...</div>}
                </div>
            </div>
        </div>
    );
}

function ProgressStat({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
        </div>
    );
}

function StatusBadge({ label, success }: { label: string, success: boolean | null }) {
    let bg = 'rgba(255,255,255,0.05)';
    let color = 'rgba(255,255,255,0.3)';
    let icon = <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />;

    if (success === true) {
        bg = 'rgba(34, 197, 94, 0.1)';
        color = '#22c55e';
        icon = <CheckCircle size={14} />;
    } else if (success === false) {
        bg = 'rgba(239, 68, 68, 0.1)';
        color = '#ef4444';
        icon = <AlertCircle size={14} />;
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderRadius: '6px',
            background: bg,
            color: color,
            fontSize: '0.75rem',
            fontWeight: 700,
            border: `1px solid ${success === null ? 'transparent' : color}33`
        }}>
            <span>{label}</span>
            {icon}
        </div>
    );
}

const btnStyle = (color: string) => ({
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: color,
    border: `1px solid ${color}44`,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
});
