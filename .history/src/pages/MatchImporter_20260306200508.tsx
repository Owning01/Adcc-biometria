import React, { useEffect } from 'react';
import {
    Zap,
    RefreshCw,
    AlertCircle,
    Pause,
    Play,
    CheckCircle,
    Swords,
    Users,
    ArrowRight,
    ChevronRight,
    Database,
    Search
} from 'lucide-react';
import { useMatchBatchProcessor } from '../contexts/MatchBatchProcessorContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function MatchImporter() {
    const {
        matches,
        selectedMatch,
        matchPlayers,
        status,
        progress,
        logs,
        currentPlayer,
        currentStep,
        loadMatches,
        selectMatch,
        startProcessing,
        pauseProcessing,
        resetProcessor
    } = useMatchBatchProcessor();

    useEffect(() => {
        loadMatches();
    }, []);

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
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Importador por Partidos</h1>
                        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.6 }}>Sincroniza jugadores directamente desde la API de partidos de ADCC</p>
                    </div>
                </div>

                <button
                    onClick={() => loadMatches()}
                    disabled={status === 'loading_matches' || status === 'processing'}
                    className="glass-button"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} className={status === 'loading_matches' ? 'spin' : ''} />
                    {status === 'loading_matches' ? 'Cargando...' : 'Actualizar Partidos'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
                {/* Match List Selector */}
                <div className="glass-premium" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                        Seleccionar Partido
                    </h3>

                    {matches.length === 0 && status !== 'loading_matches' && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                            <Search size={32} style={{ marginBottom: '12px' }} />
                            <p style={{ fontSize: '0.8rem' }}>No se encontraron partidos recientes</p>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {matches.map((match: any) => (
                            <div
                                key={match.id}
                                onClick={() => selectMatch(match.id)}
                                className={`glass-panel match-select-card ${selectedMatch?.id === match.id ? 'active' : ''}`}
                                style={{
                                    padding: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: selectedMatch?.id === match.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                    background: selectedMatch?.id === match.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)'
                                }}
                            >
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.5, marginBottom: '4px' }}>ID: {match.id}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.equipo1_nombre}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>VS</span>
                                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.equipo2_nombre}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', opacity: 0.7 }}>
                                    <span>{match.torneo_nombre}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Users size={12} /> {match.match_players || '?'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected Match Processing Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {selectedMatch ? (
                        <>
                            {/* Match Card Detail */}
                            <div className="glass-premium" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05 }}>
                                    <Swords size={120} />
                                </div>

                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                        Detalles del Partido Seleccionado
                                    </div>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '4px' }}>
                                        {selectedMatch.equipo1_nombre} vs {selectedMatch.equipo2_nombre}
                                    </h2>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.7, display: 'flex', gap: '16px' }}>
                                        <span>{selectedMatch.torneo_nombre}</span>
                                        <span>•</span>
                                        <span>Categoría: {matchPlayers[0]?.category || 'N/A'}</span>
                                    </div>

                                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                                        {status === 'ready' || status === 'paused' || status === 'finished' ? (
                                            <button
                                                onClick={() => startProcessing()}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: 'var(--primary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    boxShadow: '0 4px 15px rgba(0, 135, 81, 0.3)'
                                                }}
                                            >
                                                <Play size={18} /> {status === 'paused' ? 'Continuar Importación' : 'Iniciar Importación de Biometría'}
                                            </button>
                                        ) : status === 'processing' ? (
                                            <button
                                                onClick={() => pauseProcessing()}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: '#fbbf24',
                                                    color: '#000',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px'
                                                }}
                                            >
                                                <Pause size={18} /> Pausar Proceso
                                            </button>
                                        ) : null}

                                        {status === 'finished' && (
                                            <button
                                                onClick={() => resetProcessor()}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'white',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Limpiar y Reiniciar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

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
                                            {progress.processed} / {progress.total} Jugadores
                                        </div>
                                    </div>

                                    <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(progress.processed / progress.total) * 100}%` }}
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
                                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                                                <img src={currentPlayer.processed_foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{currentPlayer.nombre} {currentPlayer.apellido}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{currentStep}</div>
                                            </div>
                                            <RefreshCw size={18} className="spin" style={{ opacity: 0.5 }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Player Grid / Log */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                                {/* Players loaded for match */}
                                <div className="glass-premium" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '16px' }}>Lista de Jugadores ({matchPlayers.length})</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                        {matchPlayers.map((p: any) => {
                                            const isProcessed = logs.some(l => l.jleid === p.jleid && l.status === 'success');
                                            const hasError = logs.some(l => l.jleid === p.jleid && l.status === 'error');

                                            return (
                                                <div key={p.jleid} className="glass-panel" style={{
                                                    padding: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    border: isProcessed ? '1px solid #10b981' : (hasError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)'),
                                                    background: isProcessed ? 'rgba(16,185,129,0.05)' : (hasError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)')
                                                }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: '#000', position: 'relative' }}>
                                                        <img src={p.processed_foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        {isProcessed && (
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <CheckCircle size={16} color="white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre} {p.apellido}</div>
                                                        <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{p.equipo_nombre}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Real-time Logs */}
                                <div className="glass-premium" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '16px' }}>Actividad del Sistema</h3>
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
                        </>
                    ) : (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px',
                            textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '24px',
                            border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <Swords size={60} style={{ opacity: 0.1, marginBottom: '20px' }} />
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>No hay partido seleccionado</h2>
                            <p style={{ opacity: 0.5, maxWidth: '300px' }}>Para comenzar, selecciona un partido de la lista a la izquierda para cargar sus jugadores y biometría.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
