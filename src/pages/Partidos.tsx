/**
 * @file Partidos.jsx
 * @description Vista principal del listado de partidos.
 * Permite visualizar partidos en vivo, programados y finalizados.
 * Incluye funcionalidad para eliminar partidos (protegida con código).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Clock, ChevronRight, Activity, Trash2, Square, ScanFace, Search, Plus } from 'lucide-react';
import { subscribeToMatches, deleteMatch } from '../services/matchesService';

const Partidos = ({ userRole }: { userRole: string }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Efecto para suscribirse a la colección de partidos
    useEffect(() => {
        const unsubscribe = subscribeToMatches((data) => {
            // Ordenar por fecha y hora descendente (más nuevos arriba)
            const sorted = [...(data || [])].sort((a: any, b: any) => {
                const dateA = new Date(`${a.date} ${a.time}`).getTime();
                const dateB = new Date(`${b.date} ${b.time}`).getTime();
                return dateB - dateA;
            });
            setMatches(sorted);
            setLoading(false);
        });

        // Timer para forzar re-renderizado cada 30 segundos (actualizar tiempos live)
        const timer = setInterval(() => {
            setRefreshTrigger(prev => prev + 1);
        }, 30000);

        return () => {
            unsubscribe();
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
            <header className="list-header">
                <h1 className="list-title">Lista de <span className="text-highlight">Partidos</span></h1>
                <p className="list-subtitle">Sigue los resultados en tiempo real</p>
                <div className="header-controls">
                    <div className="glass-panel quick-actions-panel">
                        <div style={{ flex: '1 1 200px' }}>
                            <h4 className="panel-label text-highlight" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <ScanFace size={16} /> ACCIONES DE BIOMETRÍA
                            </h4>
                            <p className="list-subtitle" style={{ fontSize: '0.7rem' }}>Identifica jugadores en tiempo real.</p>
                        </div>
                        <div className="flex-center" style={{ gap: '10px' }}>
                            <button onClick={() => navigate('/alta')} className="glass-button" style={{ background: 'var(--primary)', color: 'black', padding: '8px 15px', fontSize: '0.7rem' }}>
                                <Search size={14} /> CONSULTA RÁPIDA
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por equipo o ID de partido..."
                        className="premium-input search-input-large"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {loading ? (
                <div className="flex-center" style={{ padding: '3rem' }}>Cargando partidos...</div>
            ) : (
                <div className="match-list-container">
                    {matches.length === 0 ? (
                        <div className="glass-panel empty-state-card">
                            <Trophy size={48} style={{ opacity: 0.1, marginBottom: '1.25rem' }} />
                            <p className="list-subtitle">No hay partidos programados todavía.</p>
                        </div>
                    ) : (
                        matches.filter(m =>
                            m.teamA.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.teamB.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.id.slice(-6).toUpperCase().includes(searchTerm.toUpperCase())
                        ).map(match => (
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
                                        <span className="match-id-badge">
                                            #{match.id.slice(-6).toUpperCase()}
                                        </span>
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
                                            {match.teamA.logo ? <img src={match.teamA.logo} alt="Logo" /> : <Trophy size={20} opacity={0.2} />}
                                        </div>
                                        <span className="team-name-small" style={{ fontSize: '0.9rem' }}>{match.teamA.name}</span>
                                    </div>

                                    <div className="match-card-score" style={{ fontSize: '1.4rem' }}>
                                        {match.score.a} - {match.score.b}
                                    </div>

                                    <div className="match-card-team" style={{ minWidth: 0 }}>
                                        <div className="team-logo-container">
                                            {match.teamB.logo ? <img src={match.teamB.logo} alt="Logo" /> : <Trophy size={20} opacity={0.2} />}
                                        </div>
                                        <span className="team-name-small" style={{ fontSize: '0.9rem' }}>{match.teamB.name}</span>
                                    </div>
                                </div>

                                {/* Resumen de Eventos (Flashscore style) */}
                                <div className="events-grid">
                                    {/* Local Events */}
                                    <div className="flex-center-end" style={{ gap: '4px', paddingRight: '10px' }}>
                                        {(match.events || []).filter((e: any) => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                                            <div key={e.id} className="event-item">
                                                <span>{e.player}</span>
                                                {e.type === 'goal' && <Trophy size={9} className="text-highlight" />}
                                                {e.type === 'yellow_card' && <Square size={9} fill="#fbbf24" color="#fbbf24" />}
                                                {e.type === 'red_card' && <Square size={9} fill="#ef4444" color="#ef4444" />}
                                                <span style={{ fontWeight: 'bold' }}>{e.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div />
                                    {/* Visitor Events */}
                                    <div className="flex-center-start" style={{ gap: '4px', paddingLeft: '10px' }}>
                                        {(match.events || []).filter((e: any) => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                                            <div key={e.id} className="event-item">
                                                <span style={{ fontWeight: 'bold' }}>{e.time}</span>
                                                {e.type === 'goal' && <Trophy size={9} className="text-highlight" />}
                                                {e.type === 'yellow_card' && <Square size={9} fill="#fbbf24" color="#fbbf24" />}
                                                {e.type === 'red_card' && <Square size={9} fill="#ef4444" color="#ef4444" />}
                                                <span>{e.player}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Partidos;
