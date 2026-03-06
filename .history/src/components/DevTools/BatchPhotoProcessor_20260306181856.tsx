import { useState } from 'react';
import { Zap, RefreshCw, AlertCircle, Pause, Play, CheckCircle, Database, Download } from 'lucide-react';
import { useBatchProcessor } from '../../contexts/BatchProcessorContext';
import { playerRegistrationService } from '../../services/playerRegistrationService';
import { registerPlayerBiometrics } from '../../services/adccService';
import { loadModelsLocal } from '../../services/faceServiceLocal';

export default function BatchPhotoProcessor() {
    const {
        getUrl, setGetUrl, players, status, progress, logs, verificationLogs, errorMsg,
        currentPlayer, currentStep,
        handleLoadList, handleLoadListSubset, startProcessing, pauseProcessing, resetProcessor, syncAllPlayers,
        isMappingLoaded, loadTeamMapping, downloadImages
    } = useBatchProcessor();

    const [testPlayer, setTestPlayer] = useState<any | null>(null);
    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'processing' | 'done' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    const handleLoadTestPlayer = async () => {
        setTestStatus('loading');
        setTestMessage('Cargando jugador de prueba desde /api/jugador...');
        setTestPlayer(null);
        try {
            const res = await fetch('/api-adcc/api/jugador', {
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_ADCC_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            if (!res.ok) throw new Error('Error al cargar /api/jugador');
            const data = await res.json();

            let player = Array.isArray(data) ? data[0] : (data.players ? data.players[0] : data);

            let foto = player.foto || player.imagen || '';
            if (foto && !foto.startsWith('http')) {
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
            player = { ...player, processed_foto: foto };

            setTestPlayer(player);
            setTestStatus('idle');
            setTestMessage('Jugador cargado correctamente.');
        } catch (err: any) {
            setTestStatus('error');
            setTestMessage(err.message || 'Error al cargar jugador');
        }
    };

    const handleProcessTestPlayer = async () => {
        if (!testPlayer) return;
        setTestStatus('processing');
        setTestMessage('Iniciando procesamiento con IA...');
        try {
            const loadRes = await loadModelsLocal();
            if (!loadRes.success) throw new Error(loadRes.error || 'Error cargando modelos de IA');

            setTestMessage('Detectando rostro y extrayendo biometría...');
            const result = await playerRegistrationService.registerPlayer({
                id: testPlayer.jleid || testPlayer.id || testPlayer.dni || String(Date.now()),
                jleid: testPlayer.jleid || testPlayer.id || testPlayer.dni || String(Date.now()),
                dni: testPlayer.dni || '',
                nombre: testPlayer.nombre || '',
                apellido: testPlayer.apellido || '',
                foto: testPlayer.processed_foto,
                team: 'gbro',
                category: 'libre'
            }, { syncWithApi: false, forceUpdate: true });

            if (!result.success) throw new Error(result.error || 'Error en IA');

            setTestMessage('Registrando vector biométrico en Firebase...');
            const syncRes = await registerPlayerBiometrics(
                testPlayer.jleid || testPlayer.id,
                result.descriptor || ''
            );

            if (syncRes && syncRes.ok !== false) {
                setTestStatus('done');
                setTestMessage('Jugador procesado y sincronizado correctamente.');
            } else {
                throw new Error(syncRes?.error || 'Falló la sincronización con Firebase');
            }
        } catch (err: any) {
            setTestStatus('error');
            setTestMessage(err.message || 'Error en el proceso');
        }
    };

    const handleTest50 = async () => {
        await handleLoadListSubset(50);
        await loadTeamMapping();
    };

    const handleDownloadAllApi = async () => {
        await handleLoadList();
        await downloadImages();
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Zap size={32} style={{ color: 'var(--accent-color)' }} />
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Procesador Masivo de Fotos</h1>
                </div>

                {(status === 'finished' || status === 'syncing') && (
                    <button
                        onClick={syncAllPlayers}
                        disabled={status === 'syncing'}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--accent-gradient)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 15px rgba(var(--accent-rgb), 0.3)',
                            animation: status === 'syncing' ? 'none' : 'pulse 2s infinite'
                        }}
                    >
                        <Database size={18} className={status === 'syncing' ? 'spin' : ''} />
                        {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar con API ADCC'}
                    </button>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                    {players.length > 0 && (
                        <button
                            onClick={downloadImages}
                            style={{
                                padding: '10px 20px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary)',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <RefreshCw size={18} /> Descargar {players.length} Imágenes
                        </button>
                    )}

                    <button
                        onClick={handleLoadList}
                        disabled={status === 'loading_list' || status === 'processing'}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <RefreshCw size={18} className={status === 'loading_list' ? 'spin' : ''} />
                        {status === 'loading_list' ? 'Cargando...' : 'Cargar Lista de Jugadores'}
                    </button>
                </div>

            </div>

            {/* Test Individual /api/jugador */}
            <div style={{
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px dashed var(--primary)',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Play size={18} /> Prueba Individual: /api/jugador (Team: gbro, Cat: libre)
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleLoadTestPlayer}
                            disabled={testStatus === 'loading' || testStatus === 'processing'}
                            style={{
                                padding: '8px 16px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary)',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Cargar Datos
                        </button>
                        <button
                            onClick={handleProcessTestPlayer}
                            disabled={!testPlayer || testStatus === 'loading' || testStatus === 'processing'}
                            style={{
                                padding: '8px 16px',
                                background: testPlayer && testStatus !== 'processing' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: testPlayer && testStatus !== 'processing' ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Registrar Imagen
                        </button>
                    </div>
                </div>

                {testMessage && (
                    <div style={{
                        margin: '12px 0',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        background: testStatus === 'error' ? 'rgba(239,68,68,0.1)' : testStatus === 'done' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        color: testStatus === 'error' ? '#f87171' : testStatus === 'done' ? '#34d399' : 'var(--text-color)'
                    }}>
                        {testMessage}
                    </div>
                )}

                {testPlayer && (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                            <img src={testPlayer.processed_foto} alt="Test" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700 }}>{testPlayer.nombre} {testPlayer.apellido}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>ID: {testPlayer.jleid || testPlayer.id} | DNI: {testPlayer.dni}</div>
                        </div>
                    </div>
                )}
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
                            disabled={status !== 'idle' && status !== 'ready'}
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
                    <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleLoadList}
                            disabled={status === 'loading_list' || status === 'processing' || status === 'syncing'}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                background: 'var(--primary)',
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

                        <button
                            onClick={loadTeamMapping}
                            disabled={status === 'loading_list' || status === 'processing' || status === 'syncing' || isMappingLoaded}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                background: isMappingLoaded ? 'var(--success-color)' : 'var(--accent-gradient)',
                                color: 'white',
                                border: 'none',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: isMappingLoaded ? 0.8 : 1
                            }}
                        >
                            <Database size={18} />
                            {isMappingLoaded ? 'Maestro Equipos Cargado' : 'Mapear Equipos (/partidos)'}
                        </button>
                    </div>
                </div>

                {errorMsg && (
                    <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#f87171', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} />
                        {errorMsg}
                    </div>
                )}

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
                    {status === 'processing' ? (
                        <button onClick={pauseProcessing} style={btnStyle('var(--warning-color)')}>
                            <Pause size={20} /> Pausar
                        </button>
                    ) : (
                        <button
                            onClick={startProcessing}
                            style={btnStyle('var(--success-color)')}
                            disabled={players.length === 0 || status === 'finished' || status === 'syncing'}
                        >
                            <Play size={20} /> {status === 'paused' ? 'Continuar' : 'Iniciar Proceso Local'}
                        </button>
                    )}
                    <button onClick={resetProcessor} style={btnStyle('var(--danger-color)')} disabled={status === 'idle' || status === 'loading_list' || status === 'syncing'}>
                        Resetear
                    </button>
                </div>

                {/* Current Player View */}
                {currentPlayer && (
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
                                src={currentPlayer.processed_foto}
                                alt="Player"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{currentPlayer.nombre} {currentPlayer.apellido}</div>
                            <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Paso Actual: <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{currentStep}</span></div>
                        </div>
                    </div>
                )}

                {/* Consolas de Logs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Consola General */}
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={12} /> CONSOLA DE PROCESO
                        </div>
                        <div style={consoleStyle}>
                            {logs.map((msg, idx) => (
                                <div key={idx} style={{ marginBottom: '4px', opacity: idx === 0 ? 1 : 0.6 }}>
                                    {msg}
                                </div>
                            ))}
                            {logs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Esperando inicio...</div>}
                        </div>
                    </div>

                    {/* Consola de Verificación */}
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)' }}>
                            <CheckCircle size={12} /> VERIFICACIÓN DE DESCRIPTORES (IA)
                        </div>
                        <div style={{ ...consoleStyle, borderLeft: '3px solid var(--success-color)' }}>
                            {verificationLogs.map((msg, idx) => (
                                <div key={idx} style={{ marginBottom: '4px', color: msg.includes('OK') ? '#a7f3d0' : '#fecaca', opacity: idx === 0 ? 1 : 0.6 }}>
                                    {msg}
                                </div>
                            ))}
                            {verificationLogs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Sin datos de biometría...</div>}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .spin { animation: rotate 2s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
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

const consoleStyle: React.CSSProperties = {
    height: '300px',
    background: '#09090b',
    borderRadius: '12px',
    padding: '16px',
    overflowY: 'auto' as 'auto',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    border: '1px solid var(--border-color)',
    boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.3)'
};

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
