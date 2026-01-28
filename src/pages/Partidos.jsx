import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Clock, ChevronRight, Activity, Trash2, Square } from 'lucide-react';
import { subscribeToMatches, deleteMatch } from '../services/matchesService';

const Partidos = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribeToMatches((data) => {
            setMatches(data);
            setLoading(false);
        });

        const timer = setInterval(() => {
            setRefreshTrigger(prev => prev + 1);
        }, 30000);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, []);

    const calculateMinute = (match) => {
        if (match.status !== 'live' || !match.liveStartTime) return null;
        const elapsed = Math.floor((Date.now() - match.liveStartTime) / 60000);
        return (match.accumulatedTime || 0) + elapsed;
    };

    const getStatusLabel = (status) => {
        const labels = {
            'scheduled': 'Próximamente',
            'live': 'En Vivo',
            'halftime': 'Entretiempo',
            'finished': 'Finalizado'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status) => {
        const colors = {
            'live': '#ef4444',
            'halftime': '#f59e0b',
            'finished': 'var(--text-muted)'
        };
        return colors[status] || 'var(--primary)';
    };

    const handleDelete = async (e, matchId) => {
        e.stopPropagation();
        const code = prompt("Ingrese el código de seguridad para eliminar este partido:");
        if (code === '777') {
            if (confirm("¿Estás seguro de que deseas eliminar este partido? Esta acción no se puede deshacer.")) {
                try {
                    await deleteMatch(matchId);
                } catch (error) {
                    alert("Error al eliminar el partido: " + error.message);
                }
            }
        } else if (code !== null) {
            alert("Código incorrecto.");
        }
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '5px' }}>Lista de <span style={{ color: 'var(--primary)' }}>Partidos</span></h1>
                <p style={{ color: 'var(--text-muted)' }}>Sigue los resultados en tiempo real</p>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>Cargando partidos...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {matches.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                            <Trophy size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                            <p style={{ color: 'var(--text-muted)' }}>No hay partidos programados todavía.</p>
                        </div>
                    ) : (
                        matches.map(match => (
                            <div
                                key={match.id}
                                className="glass-panel"
                                style={{ padding: '25px', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                onClick={() => navigate(`/partido/${match.id}`)}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', fontSize: '0.8rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={14} /> {match.date}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} /> {match.time} HS</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            color: getStatusColor(match.status),
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            {match.status === 'live' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Activity size={14} className="animate-pulse" />
                                                    <span style={{ fontSize: '1.2rem', color: '#fff', fontWeight: '900' }}>{calculateMinute(match)}'</span>
                                                </div>
                                            ) : getStatusLabel(match.status)}
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, match.id)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: 'none',
                                                color: '#ef4444',
                                                padding: '5px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                            title="Eliminar Partido"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="match-card-grid">
                                    <div className="match-card-team">
                                        <div className="team-logo-container">
                                            {match.teamA.logo ? <img src={match.teamA.logo} alt="Logo" /> : <Trophy size={20} opacity={0.2} />}
                                        </div>
                                        <span className="team-name-small">{match.teamA.name}</span>
                                    </div>

                                    <div className="match-card-score">
                                        {match.score.a} - {match.score.b}
                                    </div>

                                    <div className="match-card-team">
                                        <div className="team-logo-container">
                                            {match.teamB.logo ? <img src={match.teamB.logo} alt="Logo" /> : <Trophy size={20} opacity={0.2} />}
                                        </div>
                                        <span className="team-name-small">{match.teamB.name}</span>
                                    </div>
                                </div>

                                {/* Resumen de Eventos (Flashscore style) */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 60px 1fr',
                                    marginTop: '15px',
                                    paddingTop: '15px',
                                    borderTop: '1px solid rgba(255,255,255,0.03)'
                                }}>
                                    {/* Local Events */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', paddingRight: '10px' }}>
                                        {(match.events || []).filter(e => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                            <div key={e.id} style={{ fontSize: '0.65rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>{e.player}</span>
                                                {e.type === 'goal' && <Trophy size={9} color="#10b981" />}
                                                {e.type === 'yellow_card' && <Square size={9} fill="#fbbf24" color="#fbbf24" />}
                                                {e.type === 'red_card' && <Square size={9} fill="#ef4444" color="#ef4444" />}
                                                <span style={{ fontWeight: 'bold' }}>{e.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div />
                                    {/* Visitor Events */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', paddingLeft: '10px' }}>
                                        {(match.events || []).filter(e => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                            <div key={e.id} style={{ fontSize: '0.65rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{e.time}</span>
                                                {e.type === 'goal' && <Trophy size={9} color="#10b981" />}
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
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .animate-pulse { animation: pulse 2s infinite; }
            `}</style>
        </div>
    );
};

export default Partidos;
