/**
 * @file Partidos.jsx
 * @description Vista principal del listado de partidos.
 * Permite visualizar partidos en vivo, programados y finalizados.
 * Incluye funcionalidad para eliminar partidos (protegida con código).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Calendar, Clock, Activity, Trash2, Square, ScanFace, Search, LogIn, RefreshCw, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Filter, AlertCircle, Play } from 'lucide-react';
import { m } from 'framer-motion';
import { useMatchBatchProcessor } from '../contexts/MatchBatchProcessorContext';


import { subscribeToMatches, deleteMatch, getMatches } from '../services/matchesService';
import { syncMatchDayData } from '../services/syncService';
import { subscribeToTeams, Team } from '../services/teamsService';
import { getAdccImageUrl } from '../utils/imageUtils';

const MatchCard = React.memo(({ match, teamsMetadata, userRole, navigate, formatMatchTime, getStatusColor, getStatusLabel, handleDelete }: any) => {
    const teamALogo = teamsMetadata.find((t: any) => t.name === match.teamA?.name)?.logoUrl || getAdccImageUrl(match.teamA?.logo);
    const teamBLogo = teamsMetadata.find((t: any) => t.name === match.teamB?.name)?.logoUrl || getAdccImageUrl(match.teamB?.logo);

    return (
        <m.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel"
            style={{ padding: '25px', cursor: 'pointer', transition: 'transform 0.2s ease', marginBottom: '15px' }}
            onClick={() => navigate(`/partido/${match.id}`)}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.transform = 'scale(1.005)'}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.transform = 'scale(1)'}
        >
            <div className="match-card-header">
                <div className="match-meta-group">
                    {(userRole === 'admin' || userRole === 'dev' || userRole === 'referee') && (
                        <span className="match-id-badge" style={{ background: 'rgba(0, 135, 81, 0.2)', color: 'var(--primary)' }}>
                            #{match.id.slice(-6).toUpperCase()}
                        </span>
                    )}
                    {(match.tournamentName || match.liga) && (
                        <span className="flex-center" style={{ gap: '5px', color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                            🏆 {match.tournamentName || match.liga}
                        </span>
                    )}
                    <span className="flex-center" style={{ gap: '5px' }}><Calendar size={14} /> {match.date}</span>
                    <span className="flex-center" style={{ gap: '5px' }}><Clock size={14} /> {match.time} HS</span>
                </div>
                <div className="match-status-group">
                    <div style={{
                        color: getStatusColor(match.status),
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        {match.status === 'live' ? (
                            <div className="flex-center" style={{ gap: '8px' }}>
                                <Activity size={14} className="animate-pulse" />
                                <span className="match-time-live">{formatMatchTime(match)}</span>
                            </div>
                        ) : (
                            <div className="flex-center" style={{ gap: '8px' }}>
                                {getStatusLabel(match.status)}
                                {(match.status === 'halftime' || match.status === 'finished') && (
                                    <span style={{ fontSize: '0.95rem', opacity: 0.6 }}>({formatMatchTime(match)})</span>
                                )}
                            </div>
                        )}
                    </div>
                    {(userRole === 'admin' || userRole === 'dev') && (
                        <button
                            onClick={(e) => handleDelete(e, match.id)}
                            className="btn-delete-small"
                            title="Eliminar Partido"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="match-card-grid" style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="match-card-team" style={{ minWidth: 0 }}>
                    <div className="team-logo-container">
                        {teamALogo ? <img src={teamALogo} alt={`Logo de ${match.teamA?.name}`} loading="lazy" /> : <Shield size={20} opacity={0.2} aria-hidden="true" />}
                    </div>
                    <span className="team-name-small" style={{ fontSize: '0.9rem' }}>{match.teamA?.name || 'Equipo A'}</span>
                </div>

                <div className="match-card-score" style={{ fontSize: '1.4rem' }}>
                    {match.score?.a ?? 0} - {match.score?.b ?? 0}
                </div>

                <div className="match-card-team" style={{ minWidth: 0 }}>
                    <div className="team-logo-container">
                        {teamBLogo ? <img src={teamBLogo} alt={`Logo de ${match.teamB?.name}`} loading="lazy" /> : <Shield size={20} opacity={0.2} aria-hidden="true" />}
                    </div>
                    <span className="team-name-small" style={{ fontSize: '0.9rem' }}>{match.teamB?.name || 'Equipo B'}</span>
                </div>
            </div>

            {/* Resumen de Eventos (Flashscore style) */}
            <div className="events-grid">
                {/* Local Events */}
                <div className="flex-center-end" style={{ gap: '4px', paddingRight: '10px' }}>
                    {(match.events || []).filter((e: any) => (e.teamSide === 'A' || e.team === match.teamA?.name) && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                        <div key={e.id || e.eventId} className="event-item">
                            <span>{e.player || e.playerName}</span>
                            {e.type === 'goal' && <Activity size={9} className="text-highlight" />}
                            {e.type === 'yellow_card' && <Square size={9} fill="#fbbf24" color="#fbbf24" />}
                            {e.type === 'red_card' && <Square size={9} fill="#ef4444" color="#ef4444" />}
                            <span style={{ fontWeight: 'bold' }}>{e.time || e.minute}'</span>
                        </div>
                    ))}
                </div>
                <div />
                {/* Visitor Events */}
                <div className="flex-center-start" style={{ gap: '4px', paddingLeft: '10px' }}>
                    {(match.events || []).filter((e: any) => (e.teamSide === 'B' || e.team === match.teamB?.name) && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                        <div key={e.id || e.eventId} className="event-item">
                            <span style={{ fontWeight: 'bold' }}>{e.time || e.minute}'</span>
                            {e.type === 'goal' && <Activity size={9} className="text-highlight" />}
                            {e.type === 'yellow_card' && <Square size={9} fill="#fbbf24" color="#fbbf24" />}
                            {e.type === 'red_card' && <Square size={9} fill="#ef4444" color="#ef4444" />}
                            <span>{e.player || e.playerName}</span>
                        </div>
                    ))}
                </div>
            </div>
        </m.div>
    );
});

const Partidos = ({ userRole }: { userRole: string }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const { startSpecificProcessing, status: processorStatus } = useMatchBatchProcessor();
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Sync state
    const [syncRunning, setSyncRunning] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getLocalDateStr(new Date()));
    const [selectedTournament, setSelectedTournament] = useState<string>('todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPast, setShowPast] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Efecto para suscribirse a la colección de partidos
    useEffect(() => {
        const unsubscribe = subscribeToMatches((data) => {
            console.log("[Partidos] Matches updated from Firestore:", data.length);
            const sorted = [...data].sort((a: any, b: any) => {
                const dateA = a.date || '';
                const dateB = b.date || '';
                const timeA = a.time || '23:59';
                const timeB = b.time || '23:59';
                return `${dateA}T${timeA}` > `${dateB}T${timeB}` ? 1 : -1;
            });
            setMatches(sorted);
            setLoading(false);
        });

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
        });

        const timer = setInterval(() => {
            setRefreshTrigger(prev => prev + 1);
        }, 30000);

        return () => {
            unsubscribe();
            unsubTeams();
            clearInterval(timer);
        };
    }, []);

    // Memoize the filtered lists
    const { upcomingMatches, pastMatches, tournamentOptions, filteredMatches } = React.useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        const normalizedSearch = searchTerm.toLowerCase().trim();
        const baseFiltered = matches.filter(m => {
            const matchDate = m.date || '';
            const matchTournament = m.tournamentId || '';
            const teamAName = (m.teamA?.name || '').toLowerCase();
            const teamBName = (m.teamB?.name || '').toLowerCase();

            const matchesDate = !selectedDate || matchDate === selectedDate;
            const matchesTournament = selectedTournament === 'todos' || matchTournament === selectedTournament;
            const matchesSearch = !normalizedSearch || teamAName.includes(normalizedSearch) || teamBName.includes(normalizedSearch);

            return matchesDate && matchesTournament && matchesSearch;
        });

        // Diagnóstico para Desarrollo
        if (userRole === 'dev') {
            console.log(`[Partidos] Debug Info:`, {
                total: matches.length,
                selectedDate,
                filteredCount: baseFiltered.length,
                sampleDates: matches.slice(0, 3).map(m => m.date)
            });
        }

        const isMatchPast = (m: any) => {
            if (m.status === 'live' || m.status === 'halftime') return false;
            return m.date && m.date < todayStr;
        };

        const upcoming = baseFiltered.filter(m => !isMatchPast(m));
        const past = baseFiltered.filter(m => isMatchPast(m)).reverse();

        const tournaments = Array.from(new Set(
            matches
                .filter(m => {
                    const year = m.date ? new Date(m.date).getFullYear() : null;
                    return year === 2026;
                })
                .map(m => String(m.tournamentName || m.liga || 'General').trim())
        )).sort();

        return { upcomingMatches: upcoming, pastMatches: past, tournamentOptions: tournaments, filteredMatches: baseFiltered };
    }, [matches, searchTerm, selectedTournament, selectedDate]);


    // Auto-scroll log panel to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [syncLogs]);

    const handleSync = async () => {
        if (syncRunning) return;
        setSyncRunning(true);
        setSyncLogs([]);
        setShowSyncPanel(true);
        try {
            await syncMatchDayData({
                userRole,
                onProgress: (msg: string) => setSyncLogs(prev => [...prev, msg]),
            });
        } catch (err: any) {
            setSyncLogs(prev => [...prev, `💥 Error inesperado: ${err?.message || err}`]);
        } finally {
            setSyncRunning(false);
        }
    };

    /**
     * Borrado masivo de partidos (Solo para limpieza antes de re-importar)
     */
    const handleClearMatches = async () => {
        const code = prompt("Para confirmar el BORRADO TOTAL de la base de datos de partidos, ingrese el código de seguridad (777):");
        if (code !== '777') return;

        if (!confirm("⚠️ ¿ESTÁS SEGURO? Se borrarán TODOS los partidos de Firestore. Esta acción es irreversible.")) {
            return;
        }

        setSyncRunning(true);
        setShowSyncPanel(true);
        setSyncLogs(['🗑️ Iniciando limpieza total de partidos...']);

        try {
            const allMatches = await getMatches();
            setSyncLogs(prev => [...prev, `📋 Encontrados ${allMatches.length} partidos.`]);

            let deleted = 0;
            for (const match of allMatches) {
                await deleteMatch(match.id);
                deleted++;
                if (deleted % 5 === 0) {
                    setSyncLogs(prev => [...prev, `   ✔ Borrados ${deleted}/${allMatches.length}...`]);
                }
            }

            setSyncLogs(prev => [...prev, `\n✨ Limpieza completada. Ya puedes importar los nuevos partidos.`]);
        } catch (err: any) {
            setSyncLogs(prev => [...prev, `💥 Error durante la limpieza: ${err.message}`]);
        } finally {
            setSyncRunning(false);
        }
    };

    /**
     * Calcula el tiempo transcurrido de un partido.
     * @param {Object} match - Objeto partido con liveStartTime y accumulatedSeconds.
     */
    const formatMatchTime = React.useCallback((match: any) => {
        let totalSeconds = 0;
        if (match.status === 'live' && match.liveStartTime) {
            totalSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
        } else {
            totalSeconds = (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
        }
        const min = Math.floor(totalSeconds / 60);
        const sec = totalSeconds % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }, []);

    const getStatusLabel = React.useCallback((status: string) => {
        const labels: Record<string, string> = {
            'scheduled': 'Próximamente',
            'live': 'En Vivo',
            'halftime': 'Entretiempo',
            'finished': 'Finalizado'
        };
        return labels[status] || status;
    }, []);

    const getStatusColor = React.useCallback((status: string) => {
        const colors: Record<string, string> = {
            'live': '#ef4444',
            'halftime': '#f59e0b',
            'finished': 'var(--text-muted)'
        };
        return colors[status] || 'var(--primary)';
    }, []);

    /**
     * Maneja la eliminación segura de un partido.
     */
    const handleDelete = React.useCallback(async (e: React.MouseEvent, matchId: string) => {
        e.stopPropagation();
        const code = prompt("Ingrese el código de seguridad para eliminar este partido:");
        if (code === '777') {
            if (confirm("¿Estás seguro de que deseas eliminar este partido? Esta acción no se puede deshacer.")) {
                try {
                    await deleteMatch(matchId);
                } catch (error: any) {
                    alert("Error al eliminar el partido: " + error.message);
                }
            }
        } else if (code !== null) {
            alert("Código incorrecto.");
        }
    }, []);

    const handleSpecificIds = async () => {
        const criticalIds = [35631, 35624, 35617, 35610];
        try {
            await startSpecificProcessing(criticalIds);
        } catch (error) {
            console.error("Error processing specific IDs:", error);
        }
    };

    const isProcessing = processorStatus === 'processing';

    return (
        <div style={{ padding: '20px', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
            {/* Barra Superior Móvil */}
            {userRole === 'public' && (
                <div className="show-mobile-flex" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '60px',
                    padding: '0 20px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 100,
                    backgroundColor: 'transparent',
                }}>
                    <m.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', letterSpacing: '2px'
                        }}
                    >
                        INGRESAR <LogIn size={16} />
                    </m.button>
                </div>
            )}

            <header className="list-header" style={{ borderBottom: '2px solid rgba(0, 135, 81, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-indigo-400" />
                                Partidos
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                {filteredMatches.length} partidos encontrados para esta fecha
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {(userRole === 'admin' || userRole === 'dev') && (
                                <button
                                    onClick={handleSpecificIds}
                                    disabled={isProcessing}
                                    className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20`}
                                >
                                    {isProcessing ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                    Procesar IDs Críticos
                                </button>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                                title="Recargar página"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {(userRole === 'admin' || userRole === 'dev') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handleSync} disabled={syncRunning} className="glass-button"
                                    style={{
                                        background: syncRunning ? 'rgba(0,135,81,0.08)' : 'rgba(0,135,81,0.18)',
                                        border: '1px solid var(--primary)', color: 'var(--primary)', opacity: syncRunning ? 0.7 : 1,
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600'
                                    }}>
                                    <RefreshCw size={15} style={{ animation: syncRunning ? 'spin 1s linear infinite' : 'none' }} />
                                    {syncRunning ? 'IMPORTANDO...' : 'IMPORTAR ADCC'}
                                </button>
                                <button onClick={handleClearMatches} disabled={syncRunning} className="glass-button"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)',
                                        color: '#ef4444', opacity: syncRunning ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600'
                                    }}>
                                    <Trash2 size={15} />
                                    BORRAR TODO
                                </button>
                            </div>
                            {syncLogs.length > 0 && (
                                <button onClick={() => setShowSyncPanel(p => !p)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {showSyncPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    {showSyncPanel ? 'Ocultar log' : 'Ver log'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {showSyncPanel && syncLogs.length > 0 && (
                    <div style={{
                        marginTop: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,135,81,0.25)',
                        borderRadius: '8px', padding: '12px 16px', maxHeight: '220px', overflowY: 'auto',
                        fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '1.6',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>📋 LOG DE SINCRONIZACIÓN</span>
                            <button onClick={() => setShowSyncPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
                        </div>
                        {syncLogs.map((line, i) => (
                            <div key={i} style={{ color: line.includes('❌') || line.includes('💥') ? '#ef4444' : line.includes('✅') || line.includes('✔') ? '#10b981' : 'rgba(255,255,255,0.75)' }}>
                                {line}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}

                <div className="header-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginTop: '20px' }}>
                    {(userRole === 'admin' || userRole === 'dev') && (
                        <div className="glass-panel quick-actions-panel" style={{ padding: '10px 15px' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <h4 className="panel-label text-highlight" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--primary)' }}>
                                    <ScanFace size={16} /> ACCIONES DE BIOMETRÍA
                                </h4>
                                <p className="list-subtitle" style={{ fontSize: '0.7rem' }}>Identifica jugadores en tiempo real.</p>
                            </div>
                            <div className="flex-center" style={{ gap: '10px' }}>
                                <button onClick={() => navigate('/alta')} className="glass-button" style={{ background: 'var(--primary)', color: 'white', padding: '8px 15px', fontSize: '0.7rem' }}>
                                    <Search size={14} /> CONSULTA RÁPIDA
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', flex: '1 1 auto', flexWrap: 'wrap' }}>
                        <select
                            value={selectedTournament}
                            onChange={(e) => setSelectedTournament(e.target.value)}
                            className="premium-input"
                            style={{ flex: '1 1 140px', minWidth: '140px', background: 'rgba(0, 51, 102, 0.5)', color: 'white', border: '1px solid rgba(0, 135, 81, 0.3)' }}
                        >
                            <option value="todos">🏆 Todos los Torneos</option>
                            {tournamentOptions.map(tName => (
                                <option key={tName} value={tName}>{tName}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar por equipo..."
                            className="premium-input search-input-large"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ flex: '2 1 180px', minWidth: '180px' }}
                        />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <input
                            type="date"
                            className="premium-input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0, 51, 102, 0.5)', color: 'white', border: '1px solid rgba(0, 135, 81, 0.3)' }}
                        />
                        {selectedDate && (
                            <button onClick={() => setSelectedDate('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '4px', fontSize: '0.8rem' }}>✕ Limpiar fecha</button>
                        )}
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex-center" style={{ padding: '3rem' }}>Cargando partidos...</div>
            ) : (
                <div className="match-list-container">
                    {upcomingMatches.length === 0 && pastMatches.length === 0 ? (
                        <div className="glass-panel empty-state-card">
                            <Shield size={48} style={{ opacity: 0.1, marginBottom: '1.25rem' }} />
                            <p className="list-subtitle">No se encontraron partidos con este filtro.</p>
                        </div>
                    ) : (
                        <>
                            {upcomingMatches.length > 0 && (
                                <>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={14} /> Próximos & En Vivo
                                    </h2>
                                    {upcomingMatches.map(m => (
                                        <MatchCard
                                            key={m.id}
                                            match={m}
                                            teamsMetadata={teamsMetadata}
                                            userRole={userRole}
                                            navigate={navigate}
                                            formatMatchTime={formatMatchTime}
                                            getStatusColor={getStatusColor}
                                            getStatusLabel={getStatusLabel}
                                            handleDelete={handleDelete}
                                        />
                                    ))}
                                </>
                            )}

                            {pastMatches.length > 0 && (
                                <div style={{ marginTop: '30px' }}>
                                    <button
                                        onClick={() => setShowPast(p => !p)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', padding: 0 }}
                                    >
                                        <Clock size={14} /> Ya Disputados ({pastMatches.length})
                                        <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>{showPast ? '▲' : '▼'}</span>
                                    </button>
                                    {showPast && pastMatches.map(m => (
                                        <MatchCard
                                            key={m.id}
                                            match={m}
                                            teamsMetadata={teamsMetadata}
                                            userRole={userRole}
                                            navigate={navigate}
                                            formatMatchTime={formatMatchTime}
                                            getStatusColor={getStatusColor}
                                            getStatusLabel={getStatusLabel}
                                            handleDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {userRole === 'dev' && (
                <div style={{
                    position: 'fixed',
                    bottom: '80px',
                    left: '20px',
                    background: 'rgba(0,0,0,0.8)',
                    color: '#00ff00',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.6rem',
                    zIndex: 9999,
                    border: '1px solid #00ff00',
                    maxWidth: '200px',
                    pointerEvents: 'none'
                }}>
                    <div>TOT: {matches.length}</div>
                    <div>FIL: {upcomingMatches.length + pastMatches.length}</div>
                    <div>DATE: {selectedDate}</div>
                </div>
            )}
        </div>
    );
};

// --- HELPER: LOCAL DATE STRING ---
const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default Partidos;
