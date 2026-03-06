import { Zap, RefreshCw, AlertCircle, Pause, Play, CheckCircle, Database } from 'lucide-react';
import { useBatchProcessor } from '../../contexts/BatchProcessorContext';

export default function BatchPhotoProcessor() {
    const {
        getUrl, setGetUrl, players, status, progress, logs, verificationLogs, errorMsg,
        currentPlayer, currentStep,
        handleLoadList, startProcessing, pauseProcessing, resetProcessor, syncAllPlayers
    } = useBatchProcessor();

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
                    <div style={{ alignSelf: 'flex-end' }}>
                        <button
                            onClick={handleLoadList}
                            disabled={status === 'loading_list' || status === 'processing' || status === 'syncing'}
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
                            disabled={players.length === 0 || status === 'finished' || status === 'syncing' || status === 'processing'}
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
