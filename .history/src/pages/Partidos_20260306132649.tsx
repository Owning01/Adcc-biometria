/**
 * @file Partidos.jsx
 * @description Vista principal del listado de partidos.
 * Permite visualizar partidos en vivo, programados y finalizados.
 * Incluye funcionalidad para eliminar partidos (protegida con código).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Calendar, Clock, ChevronRight, Activity, Trash2, Square, ScanFace, Search, Plus, LogIn } from 'lucide-react';
import { m } from 'framer-motion';
import AppLogo from '../Applogo.webp';
import { subscribeToMatches, deleteMatch } from '../services/matchesService';
import { syncADCCData } from '../services/syncService';
import { subscribeToTeams, Team } from '../services/teamsService';
import { getAdccImageUrl } from '../utils/imageUtils';

const Partidos = ({ userRole }: { userRole: string }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTournament, setSelectedTournament] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Efecto para suscribirse a la colección de partidos
    useEffect(() => {
        // Disparar sincronización automática en segundo plano
        syncADCCData({ userRole }).catch(err => {
            if (userRole !== 'usuario') console.error("Auto-sync failed:", err);
        });

        const unsubscribe = subscribeToMatches((data) => {
            // Ordenar por fecha y hora ascendente
            const sorted = [...(data || [])].sort((a: any, b: any) => {
                const dateA = new Date(`${a.date} ${a.time}`).getTime();
                const dateB = new Date(`${b.date} ${b.time}`).getTime();
                return dateA - dateB;
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

    /**
     * Calcula el tiempo transcurrido de un partido.
     * @param {Object} match - Objeto partido con liveStartTime y accumulatedSeconds.
     */
    const formatMatchTime = (match: any) => {
        let totalSeconds = 0;
        if (match.status === 'live' && match.liveStartTime) {
            totalSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
        } else {
            totalSeconds = (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
        }
        const min = Math.floor(totalSeconds / 60);
        const sec = totalSeconds % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'scheduled': 'Próximamente',
            'live': 'En Vivo',
            'halftime': 'Entretiempo',
            'finished': 'Finalizado'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'live': '#ef4444',
            'halftime': '#f59e0b',
            'finished': 'var(--text-muted)'
        };
        return colors[status] || 'var(--primary)';
    };

    /**
     * Maneja la eliminación segura de un partido.
     * Requiere código '777' para confirmar.
     */
    const handleDelete = async (e: React.MouseEvent, matchId: string) => {
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
    };

    return (
        <div className="animate-fade-in">
            {/* Barra Superior Móvil (Solo visible para públicos en móviles) */}
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
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            letterSpacing: '2px'
                        }}
                    >
                        INGRESAR <LogIn size={16} />
                    </m.button>
                </div>
            )}
            <header className="list-header" style={{ borderBottom: '2px solid rgba(0, 135, 81, 0.2)' }}>
                <h1 className="list-title">Lista de <span className="text-highlight" style={{ color: 'var(--primary)' }}>Partidos</span></h1>
                <p className="list-subtitle">Sigue los resultados en tiempo real</p>
                <div className="header-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                    {(userRole === 'admin' || userRole === 'dev') && (
                        <div className="glass-panel quick-actions-panel" style={{ padding: '10px 15px' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <h4 className="panel-label text-highlight" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--primary)' }}>
                                    <ScanFace size={16} /> ACCIONES DE BIOMETRIC
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

                    <div style={{ display: 'flex', gap: '10px', flex: '1 1 auto' }}>
                        <select
                            value={selectedTournament}
                            onChange={(e) => setSelectedTournament(e.target.value)}
                            className="premium-input"
                            style={{
                                flex: '1',
                                minWidth: '150px',
                                maxWidth: '300px',
                                background: 'rgba(0, 51, 102, 0.5)',
                                color: 'white',
                                border: '1px solid rgba(0, 135, 81, 0.3)'
                            }}
                        >
                            <option value="all">🏆 Todos los Torneos</option>
                            {Array.from(new Set(matches.map(m => m.tournamentName || m.liga || 'General'))).sort().map(tName => (
                                <option key={tName as string} value={tName as string}>{tName as string}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar por equipo..."
                            className="premium-input search-input-large"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ flex: '2', minWidth: '200px' }}
                        />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex-center" style={{ padding: '3rem' }}>Cargando partidos...</div>
            ) : (
                <div className="match-list-container">
                    {matches.length === 0 ? (
                        <div className="glass-panel empty-state-card">
                            <Shield size={48} style={{ opacity: 0.1, marginBottom: '1.25rem' }} />
                            <p className="list-subtitle">No hay partidos programados todavía.</p>
                        </div>
                    ) : (
                        matches.filter(m => {
                            const matchesSearch = m.teamA?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                m.teamB?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                m.id?.slice(-6).toUpperCase().includes(searchTerm.toUpperCase());

                            const matchesTournament = selectedTournament === 'all' ||
                                String(m.tournamentName || m.liga || 'General').trim() === selectedTournament.trim();

                            return matchesSearch && matchesTournament;
                        }).map(match => {
                            const teamALogo = teamsMetadata.find(t => t.name === match.teamA?.name)?.logoUrl || getAdccImageUrl(match.teamA?.logo);
                            const teamBLogo = teamsMetadata.find(t => t.name === match.teamB?.name)?.logoUrl || getAdccImageUrl(match.teamB?.logo);
                            return (
                                <div
                                    key={match.id}
                                    className="glass-panel"
                                    style={{ padding: '25px', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                    onClick={() => navigate(`/partido/${match.id}`)}
                                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.transform = 'scale(1.01)'}
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
                                                {teamALogo ? <img src={teamALogo} alt={`Logo de ${match.teamA.name}`} /> : <Shield size={20} opacity={0.2} aria-hidden="true" />}
                                            </div>
                                            <span className="team-name-small" style={{ fontSize: '0.9rem' }}>{match.teamA?.name || 'Equipo A'}</span>
                                        </div>

                                        <div className="match-card-score" style={{ fontSize: '1.4rem' }}>
                                            {match.score?.a ?? 0} - {match.score?.b ?? 0}
                                        </div>

                                        <div className="match-card-team" style={{ minWidth: 0 }}>
                                            <div className="team-logo-container">
                                                {teamBLogo ? <img src={teamBLogo} alt={`Logo de ${match.teamB.name}`} /> : <Shield size={20} opacity={0.2} aria-hidden="true" />}
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
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default Partidos;
