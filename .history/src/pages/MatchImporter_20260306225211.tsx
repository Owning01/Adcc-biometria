// ============================================
// 1. IMPORTS & DEPENDENCIES
// ============================================
import React, { useEffect } from 'react';
import {
    Zap,
    RefreshCw,
    AlertCircle,
    Pause,
    Play,
    CheckCircle,
    Swords,
    Search
} from 'lucide-react';
import { useMatchBatchProcessor } from '../contexts/MatchBatchProcessorContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function MatchImporter() {
    const {
        matches,
        selectedMatchId,
        matchPlayers,
        status,
        progress,
        logs,
        currentPlayer,
        currentStep,
        loadMatches,
        startMassProcessing,
        pauseProcessing,
        clearLogs
    } = useMatchBatchProcessor();

    useEffect(() => {
        loadMatches();
    }, []);

    const currentMatch = matches.find(m => m.id === selectedMatchId);

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '16px',
                        background: 'var(--primary-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--primary)'
                    }}>
                        <Swords size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Procesador Masivo por Partidos</h1>
                        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.6 }}>Importa y sincroniza biométricamente a todos los jugadores de forma global</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => loadMatches()}
                        disabled={status === 'loading_matches' || status === 'processing'}
                        className="glass-button"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <RefreshCw size={18} className={status === 'loading_matches' ? 'spin' : ''} />
                        {status === 'loading_matches' ? 'Cargando...' : 'Actualizar Partidos'}
                    </button>
                    {(status === 'idle' || status === 'ready' || status === 'paused' || status === 'finished') && (
                        <button
                            onClick={() => startMassProcessing()}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 15px rgba(0, 135, 81, 0.3)'
                            }}
                        >
                            <Play size={18} /> {status === 'paused' ? 'Continuar' : 'Iniciar Procesamiento Global'}
                        </button>
                    )}
                    {status === 'processing' && (
                        <button
                            onClick={() => pauseProcessing()}
                            style={{
                                padding: '10px 20px',
                                background: '#fbbf24',
                                color: '#000',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Pause size={18} /> Pausar
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
                {/* Match List Viewer */}
                <div className="glass-premium" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                            Cola de Partidos ({matches.length})
                        </h3>
                    </div>

                    {matches.length === 0 && status !== 'loading_matches' && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                            <Search size={32} style={{ marginBottom: '12px', marginLeft: 'auto', marginRight: 'auto' }} />
                            <p style={{ fontSize: '0.8rem' }}>No se encontraron partidos recientes</p>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {matches.map((match: any) => (
                            <div
                                key={match.id}
                                className={`glass-panel match-select-card ${selectedMatchId === match.id ? 'active' : ''}`}
                                style={{
                                    padding: '12px',
                                    transition: 'all 0.2s ease',
                                    border: selectedMatchId === match.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                    background: selectedMatchId === match.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)'
                                }}
                            >
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.5, marginBottom: '4px' }}>ID: {match.id}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.local_nombre}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>VS</span>
                                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.visitante_nombre}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', opacity: 0.7 }}>
                                    <span>{match.liga} - {match.categoria}</span>
                                    {selectedMatchId === match.id && <Zap size={12} color="var(--primary)" className="spin" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Processing Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Current Match Info */}
                    {selectedMatchId && currentMatch ? (
                        <div className="glass-premium" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05 }}>
                                <Swords size={120} />
                            </div>

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                    Procesando Partido Actual
                                </div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '4px' }}>
                                    {currentMatch.local_nombre} vs {currentMatch.visitante_nombre}
                                </h2>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7, display: 'flex', gap: '16px' }}>
                                    <span>{currentMatch.liga} - {currentMatch.categoria}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-premium" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            {status === 'idle' ? 'Listo para iniciar. Presiona Iniciar Procesamiento Global.' : 'Aguardando el inicio...'}
                        </div>
                    )}

                    {/* Progress & Current Action */}
                    {(status === 'processing' || status === 'paused' || status === 'finished') && (
                        <div className="glass-premium" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <RefreshCw size={18} className={status === 'processing' ? 'spin' : ''} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                                        {status === 'processing' ? 'Procesando Jugadores...' : (status === 'paused' ? 'En Pausa' : 'Proceso Finalizado')}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                                    {progress.processed} / {progress.total} Jugadores en este partido
                                </div>
                            </div>

                            <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                                    style={{ height: '100%', background: 'linear-gradient(90deg, #008751, #0051a2)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                                    <CheckCircle size={14} /> {progress.success} Exitosos
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                                    <AlertCircle size={14} /> {progress.failed} Errores
                                </div>
                            </div>

                            {currentPlayer && (
                                <div style={{
                                    marginTop: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '20px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                                }}>
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        key={currentPlayer.jleid}
                                        style={{
                                            width: '120px',
                                            height: '120px',
                                            borderRadius: '24px',
                                            overflow: 'hidden',
                                            background: '#000',
                                            border: '3px solid var(--primary)',
                                            boxShadow: '0 0 25px var(--primary-glow)',
                                            flexShrink: 0
                                        }}
                                    >
                                        <img
                                            src={getAdccImageUrl(currentPlayer.foto || currentPlayer.imagen || currentPlayer.imagen_url || currentPlayer.processed_foto)}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                                            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/120?text=Error')}
                                        />
                                    </motion.div>
                                    <div style={{ flex: 1 }}>
                                        <motion.div
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            key={`name-${currentPlayer.jleid}`}
                                            style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px' }}
                                        >
                                            {currentPlayer.nombre} {currentPlayer.apellido}
                                        </motion.div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--primary)',
                                                fontWeight: 800,
                                                background: 'var(--primary-glow)',
                                                padding: '6px 14px',
                                                borderRadius: '10px',
                                                display: 'inline-block',
                                                width: 'fit-content'
                                            }}>
                                                {currentStep}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>ID Jugador: {currentPlayer.jleid}</div>
                                        </div>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', opacity: 0.8 }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Player Grid / Log */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                        {/* Players loaded for match */}
                        <div className="glass-premium" style={{ padding: '20px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '16px' }}>Jugadores del Partido ({matchPlayers.length})</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                {matchPlayers.map((p: any) => {
                                    const isProcessed = logs.some(l => l.jleid === p.jleid && l.status === 'success');
                                    const hasError = logs.some(l => l.jleid === p.jleid && l.status === 'error');

                                    return (
                                        <div key={p.jleid} className="glass-panel" style={{
                                            padding: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '14px',
                                            border: isProcessed ? '1px solid #10b981' : (hasError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)'),
                                            background: isProcessed ? 'rgba(16,185,129,0.08)' : (hasError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)'),
                                            borderRadius: '16px',
                                            transition: 'transform 0.2s ease'
                                        }}>
                                            <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                                                <img src={p.foto || p.imagen || p.imagen_url || p.processed_foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {isProcessed && (
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <CheckCircle size={22} color="white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>{p.nombre} {p.apellido}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 600 }}>{p.equipo || p.equipo_nombre}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Real-time Logs */}
                        <div className="glass-premium" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Registro de Actividad</h3>
                                <button onClick={clearLogs} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem' }}>Limpiar</button>
                            </div>
                            <div style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '12px',
                                padding: '12px',
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                overflowY: 'auto',
                                maxHeight: '400px',
                                display: 'flex',
                                flexDirection: 'column-reverse',
                                gap: '4px'
                            }}>
                                {logs.length === 0 ? (
                                    <div style={{ textAlign: 'center', opacity: 0.3, padding: '20px 0' }}>Esperando inicio...</div>
                                ) : (
                                    logs.map((log, idx) => (
                                        <div key={idx} style={{
                                            color: log.status === 'success' ? '#34d399' : (log.status === 'error' ? '#f87171' : '#fbbf24'),
                                            borderLeft: `2px solid ${log.status === 'success' ? '#34d399' : (log.status === 'error' ? '#f87171' : '#fbbf24')}`,
                                            paddingLeft: '8px'
                                        }}>
                                            <span style={{ opacity: 0.5 }}>[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span> {log.msg}
                                        </div>
                                    )).reverse()
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

