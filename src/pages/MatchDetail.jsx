import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, Activity, BarChart2, Plus, ArrowLeft, Calendar, Clock, User, Trash2, Minus, Square, Repeat } from 'lucide-react';
import { subscribeToMatch, updateMatch } from '../services/matchesService';
import { getUsers } from '../services/db';

const MatchDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [match, setMatch] = useState(null);
    const [activeTab, setActiveTab] = useState('planteles'); // eventos, planteles, stats
    const [loading, setLoading] = useState(true);
    const [showAddPlayer, setShowAddPlayer] = useState(null); // 'A' or 'B'
    const [allUsers, setAllUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [currentMinute, setCurrentMinute] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribeToMatch(id, (data) => {
            setMatch(data);
            setLoading(false);
            if (data && data.status === 'live' && data.liveStartTime) {
                const elapsedSinceLastStart = Math.floor((Date.now() - data.liveStartTime) / 60000);
                setCurrentMinute((data.accumulatedTime || 0) + elapsedSinceLastStart);
            }
        });

        // Timer para actualizar el minuto en vivo cada 30 segundos
        const timer = setInterval(() => {
            if (match && match.status === 'live' && match.liveStartTime) {
                const elapsedSinceLastStart = Math.floor((Date.now() - match.liveStartTime) / 60000);
                setCurrentMinute((match.accumulatedTime || 0) + elapsedSinceLastStart);
            }
        }, 30000);

        loadUsers();
        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [id, match?.status]);

    const loadUsers = async () => {
        const data = await getUsers();
        setAllUsers(data);
    };

    const handleScoreChange = async (team, delta) => {
        const teamKey = team.toLowerCase();
        const currentScore = match.score[teamKey] || 0;
        const newScore = Math.max(0, currentScore + delta);
        await updateMatch(id, { score: { ...match.score, [teamKey]: newScore } });
    };

    const handleAddPlayer = async (user, teamType) => {
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = match[playerKey] || [];

        if (currentPlayers.some(p => p.userId === user.id)) {
            alert("El jugador ya está en el equipo");
            return;
        }

        const newPlayer = {
            userId: user.id,
            name: user.name || (user.nombre + ' ' + (user.apellido || '')),
            photo: user.photos?.[0] || user.photo || null,
            number: currentPlayers.length + 1,
            goals: 0,
            yellowCards: 0,
            redCard: false,
            status: 'titular'
        };

        const updatedMatch = {
            ...match,
            [playerKey]: [...currentPlayers, newPlayer]
        };

        await updateMatch(id, { [playerKey]: updatedMatch[playerKey] });
        setShowAddPlayer(null);
    };

    // Auto-poblar jugadores si la lista está vacía
    useEffect(() => {
        if (!loading && match && allUsers.length > 0) {
            const hasNoPlayersA = !match.playersA || match.playersA.length === 0;
            const hasNoPlayersB = !match.playersB || match.playersB.length === 0;

            if (hasNoPlayersA || hasNoPlayersB) {
                const autoPopulate = async () => {
                    let updates = {};
                    let changed = false;

                    if (hasNoPlayersA) {
                        const teamAUsers = allUsers.filter(u => u.team === match.teamA.name);
                        if (teamAUsers.length > 0) {
                            updates.playersA = teamAUsers.map((u, idx) => ({
                                userId: u.id,
                                name: u.name || (u.nombre + ' ' + (u.apellido || '')),
                                photo: u.photos?.[0] || u.photo || null,
                                number: idx + 1,
                                goals: 0,
                                yellowCards: 0,
                                redCard: false,
                                status: 'titular'
                            }));
                            changed = true;
                        }
                    }

                    if (hasNoPlayersB) {
                        const teamBUsers = allUsers.filter(u => u.team === match.teamB.name);
                        if (teamBUsers.length > 0) {
                            updates.playersB = teamBUsers.map((u, idx) => ({
                                userId: u.id,
                                name: u.name || (u.nombre + ' ' + (u.apellido || '')),
                                photo: u.photos?.[0] || u.photo || null,
                                number: idx + 1,
                                goals: 0,
                                yellowCards: 0,
                                redCard: false,
                                status: 'titular'
                            }));
                            changed = true;
                        }
                    }

                    if (changed) {
                        console.log("Auto-poblando jugadores...");
                        await updateMatch(id, updates);
                    }
                };
                autoPopulate();
            }
        }
    }, [loading, match?.id, allUsers.length]);

    const handleUpdatePlayer = async (playerIndex, teamType, field, value) => {
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(match[playerKey] || [])];
        const player = currentPlayers[playerIndex];
        const oldValue = player[field] || 0;

        currentPlayers[playerIndex] = { ...player, [field]: value };

        let extraData = {};
        const getEventTime = () => {
            if (match.status === 'live' && match.liveStartTime) {
                const elapsedSinceLastStart = Math.floor((Date.now() - match.liveStartTime) / 60000);
                const totalMinutes = (match.accumulatedTime || 0) + elapsedSinceLastStart + 1;
                return `${totalMinutes}'`;
            }
            if (match.status === 'halftime') {
                return `${match.accumulatedTime || 45}' (ET)`;
            }
            if (match.status === 'finished') {
                return "FT";
            }
            const now = new Date();
            return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        };

        const timeStr = getEventTime();

        if (field === 'goals') {
            const oldGoals = parseInt(oldValue) || 0;
            const newGoals = parseInt(value) || 0;
            if (newGoals > oldGoals) {
                extraData.events = [...(match.events || []), {
                    id: Date.now().toString(), type: 'goal', player: player.name,
                    team: teamType === 'A' ? match.teamA.name : match.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                }];
            } else if (newGoals < oldGoals) {
                const allEvents = [...(match.events || [])];
                const lastGoalIdx = allEvents.map((e, idx) => ({ ...e, originalIdx: idx }))
                    .filter(e => e.type === 'goal' && e.player === player.name && e.teamSide === teamType)
                    .pop()?.originalIdx;
                if (lastGoalIdx !== undefined) {
                    allEvents.splice(lastGoalIdx, 1);
                    extraData.events = allEvents;
                }
            }
        }

        if (field === 'yellowCards') {
            const newCount = parseInt(value) || 0;
            if (newCount > oldValue) {
                const isDoubleYellow = newCount >= 2;
                const newEvent = {
                    id: Date.now().toString(),
                    type: isDoubleYellow ? 'red_card' : 'yellow_card',
                    player: player.name,
                    detail: isDoubleYellow ? 'Doble Amarilla' : 'Amonestación',
                    team: teamType === 'A' ? match.teamA.name : match.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                };
                extraData.events = [...(match.events || []), newEvent];

                if (isDoubleYellow) {
                    currentPlayers[playerIndex].status = 'expulsado';
                    currentPlayers[playerIndex].redCard = true;
                }
            } else if (newCount < oldValue) {
                const allEvents = [...(match.events || [])];
                const lastIdx = allEvents.map((e, idx) => ({ ...e, originalIdx: idx }))
                    .filter(e => (e.type === 'yellow_card' || (e.type === 'red_card' && e.detail === 'Doble Amarilla')) && e.player === player.name && e.teamSide === teamType)
                    .pop()?.originalIdx;
                if (lastIdx !== undefined) {
                    allEvents.splice(lastIdx, 1);
                    extraData.events = allEvents;
                }
                if (newCount < 2 && !currentPlayers[playerIndex].redCard) {
                    currentPlayers[playerIndex].status = 'titular';
                }
            }
        }

        if (field === 'redCard') {
            if (value === true && oldValue !== true) {
                currentPlayers[playerIndex].status = 'expulsado';
                extraData.events = [...(match.events || []), {
                    id: Date.now().toString(), type: 'red_card', player: player.name,
                    detail: 'Roja Directa',
                    team: teamType === 'A' ? match.teamA.name : match.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                }];
            } else if (value === false && oldValue === true) {
                const allEvents = [...(match.events || [])];
                const lastIdx = allEvents.map((e, idx) => ({ ...e, originalIdx: idx }))
                    .filter(e => e.type === 'red_card' && e.player === player.name && e.teamSide === teamType && e.detail === 'Roja Directa')
                    .pop()?.originalIdx;
                if (lastIdx !== undefined) {
                    allEvents.splice(lastIdx, 1);
                    extraData.events = allEvents;
                }
                if ((parseInt(currentPlayers[playerIndex].yellowCards) || 0) < 2) {
                    currentPlayers[playerIndex].status = 'titular';
                }
            }
        }

        await updateMatch(id, { [playerKey]: currentPlayers, ...extraData });
    };

    const handleSubstitution = async (teamType) => {
        const playerIn = prompt("Nombre del jugador que ENTRA:");
        const playerOut = prompt("Nombre del jugador que SALE:");
        if (!playerIn || !playerOut) return;

        const getEventTime = () => {
            if (match.status === 'live' && match.liveStartTime) {
                const elapsedSinceLastStart = Math.floor((Date.now() - match.liveStartTime) / 60000);
                const totalMinutes = (match.accumulatedTime || 0) + elapsedSinceLastStart + 1;
                return `${totalMinutes}'`;
            }
            const now = new Date();
            return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        };

        const timeStr = getEventTime();

        const newEvent = {
            id: Date.now().toString(),
            type: 'substitution',
            playerIn,
            playerOut,
            team: teamType === 'A' ? match.teamA.name : match.teamB.name,
            teamSide: teamType,
            time: timeStr,
            timestamp: Date.now()
        };

        await updateMatch(id, { events: [...(match.events || []), newEvent] });
    };

    const removeEvent = async (eventId) => {
        if (!window.confirm("¿Eliminar este evento?")) return;
        const updatedEvents = (match.events || []).filter(e => e.id !== eventId);
        await updateMatch(id, { events: updatedEvents });
    };

    const removePlayer = async (playerIndex, teamType) => {
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(match[playerKey] || [])];
        const player = currentPlayers[playerIndex];

        if (player.status === 'suplente') {
            if (window.confirm(`¿Deseas volver a poner a ${player.name} como Titular?`)) {
                currentPlayers[playerIndex].status = 'titular';
            } else if (window.confirm(`¿Deseas ELIMINAR definitivamente a ${player.name} de este partido?`)) {
                currentPlayers.splice(playerIndex, 1);
            } else {
                return;
            }
        } else {
            if (window.confirm(`¿Mover a ${player.name} a SUPLENTES?`)) {
                currentPlayers[playerIndex].status = 'suplente';
            } else {
                return;
            }
        }

        await updateMatch(id, { [playerKey]: currentPlayers });
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando partido...</div>;
    if (!match) return <div style={{ padding: '40px', textAlign: 'center' }}>Partido no encontrado</div>;

    const targetTeamName = showAddPlayer === 'A' ? match.teamA.name : match.teamB.name;
    const filteredUsers = allUsers.filter(u => {
        const matchesSearch = (u.name || (u.nombre + ' ' + (u.apellido || '')) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.dni?.includes(searchTerm);
        const matchesTeam = u.team === targetTeamName;
        return matchesSearch && matchesTeam;
    });

    return (
        <div className="animate-fade-in">
            {/* Header Volver */}
            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => navigate('/partidos')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        padding: '10px 0',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <ArrowLeft size={18} /> Volver a Partidos
                </button>
            </div>

            {/* Scoreboard Card */}
            <div className="glass-panel" style={{ padding: '30px', marginBottom: '25px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
                    <select
                        className="premium-input"
                        style={{ padding: '5px 10px', fontSize: '0.7rem', width: 'auto', border: 'none', background: 'rgba(255,255,255,0.05)' }}
                        value={match.status}
                        onChange={async (e) => {
                            const newStatus = e.target.value;
                            const updateData = { status: newStatus };
                            const now = Date.now();

                            if (newStatus === 'live') {
                                // Si estaba en scheduled o en halftime, empezamos a contar
                                updateData.liveStartTime = now;
                            } else if (newStatus === 'halftime' || newStatus === 'finished') {
                                // Si pasamos a pausa/fin, sumamos lo transcurrido al acumulado
                                if (match.status === 'live' && match.liveStartTime) {
                                    const elapsed = Math.floor((now - match.liveStartTime) / 60000);
                                    updateData.accumulatedTime = (match.accumulatedTime || 0) + elapsed;
                                    updateData.liveStartTime = null; // Detenemos el reloj
                                }
                            }

                            await updateMatch(id, updateData);
                        }}
                    >
                        <option value="scheduled">Programado</option>
                        <option value="live">En Vivo</option>
                        <option value="halftime">Entretiempo</option>
                        <option value="finished">Finalizado</option>
                    </select>
                </div>

                <div className="scoreboard-grid">
                    {/* Team Local */}
                    <div className="scoreboard-team">
                        <div className="team-logo-large">
                            {match.teamA.logo ? <img src={match.teamA.logo} alt="Logo Local" /> : <Trophy size={40} opacity={0.2} />}
                        </div>
                        <h2 className="team-name-large">{match.teamA.name}</h2>
                        <span className="team-label">Local</span>

                        {/* Goles y Tarjetas Local (Summary) */}
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            {(match.events || []).filter(e => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                <div key={e.id} style={{ fontSize: '0.7rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{e.time}</span>
                                    <span>{e.player}</span>
                                    {e.type === 'goal' && <Trophy size={10} color="#10b981" />}
                                    {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" color="#fbbf24" />}
                                    {e.type === 'red_card' && <Square size={10} fill="#ef4444" color="#ef4444" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Result */}
                    <div className="scoreboard-result">
                        <div className="score-container">
                            <div className="score-control">
                                <button onClick={() => handleScoreChange('a', 1)} className="score-btn plus"><Plus size={14} /></button>
                                <div className="score-number">{match.score.a}</div>
                                <button onClick={() => handleScoreChange('a', -1)} className="score-btn minus"><Minus size={14} /></button>
                            </div>
                            <span className="score-separator">-</span>
                            <div className="score-control">
                                <button onClick={() => handleScoreChange('b', 1)} className="score-btn plus"><Plus size={14} /></button>
                                <div className="score-number">{match.score.b}</div>
                                <button onClick={() => handleScoreChange('b', -1)} className="score-btn minus"><Minus size={14} /></button>
                            </div>
                        </div>
                        {match.status === 'live' && (
                            <div className="live-badge" style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px 20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <div className="pulse-dot"></div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>EN VIVO</span>
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
                                    {currentMinute}'
                                </div>
                            </div>
                        )}
                        {match.status === 'halftime' && (
                            <div className="halftime-badge" style={{ padding: '8px 15px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                • ENTRETIEMPO ({match.accumulatedTime || 45}')
                            </div>
                        )}
                        {match.status === 'finished' && (
                            <div className="halftime-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>FINALIZADO</div>
                        )}

                        <div className="match-info" style={{ marginTop: '15px', opacity: 0.5 }}>
                            <span><Calendar size={12} /> {match.date}</span>
                            <span><Clock size={12} /> {match.time} HS</span>
                        </div>
                    </div>

                    {/* Team Visitor */}
                    <div className="scoreboard-team">
                        <div className="team-logo-large">
                            {match.teamB.logo ? <img src={match.teamB.logo} alt="Logo Visitante" /> : <Trophy size={40} opacity={0.2} />}
                        </div>
                        <h2 className="team-name-large">{match.teamB.name}</h2>
                        <span className="team-label">Visitante</span>

                        {/* Goles y Tarjetas Visitante (Summary) */}
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            {(match.events || []).filter(e => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                <div key={e.id} style={{ fontSize: '0.7rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{e.time}</span>
                                    <span>{e.player}</span>
                                    {e.type === 'goal' && <Trophy size={10} color="#10b981" />}
                                    {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" color="#fbbf24" />}
                                    {e.type === 'red_card' && <Square size={10} fill="#ef4444" color="#ef4444" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Selector */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '25px' }}>
                <TabButton active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} icon={<Activity size={18} />} label="Eventos" />
                <TabButton active={activeTab === 'planteles'} onClick={() => setActiveTab('planteles')} icon={<Users size={18} />} label="Planteles" />
                <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 size={18} />} label="Stats" />
            </div>

            {/* Tab Content: Planteles */}
            {activeTab === 'planteles' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
                    gap: '20px'
                }}>
                    <SquadColumn
                        title={match.teamA.name}
                        players={match.playersA || []}
                        teamType="A"
                        onAdd={() => setShowAddPlayer('A')}
                        onSubstitution={() => handleSubstitution('A')}
                        onUpdate={(idx, f, v) => handleUpdatePlayer(idx, 'A', f, v)}
                        onRemove={(idx) => removePlayer(idx, 'A')}
                    />
                    <SquadColumn
                        title={match.teamB.name}
                        players={match.playersB || []}
                        teamType="B"
                        onAdd={() => setShowAddPlayer('B')}
                        onSubstitution={() => handleSubstitution('B')}
                        onUpdate={(idx, f, v) => handleUpdatePlayer(idx, 'B', f, v)}
                        onRemove={(idx) => removePlayer(idx, 'B')}
                    />
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
                    <h3>Resumen de Estadísticas</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Métricas acumuladas del encuentro.</p>
                </div>
            )}

            {activeTab === 'eventos' && (
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={20} color="var(--primary)" />
                        Cronología del Partido
                    </h3>

                    <div style={{ position: 'relative', paddingLeft: '20px' }}>
                        <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.05)' }} />

                        {(match.events || []).length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay eventos registrados aún.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {[...(match.events || [])].reverse().map((event) => (
                                    <div key={event.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            position: 'absolute',
                                            left: '-17px',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: event.type === 'goal' ? '#10b981' : (event.type === 'red_card' ? '#ef4444' : (event.type === 'yellow_card' ? '#fbbf24' : 'var(--primary)')),
                                            boxShadow: `0 0 10px ${event.type === 'goal' ? '#10b981' : 'var(--primary)'}`
                                        }} />

                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', minWidth: '45px' }}>
                                            {event.time}
                                        </div>

                                        <div className="glass-panel" style={{
                                            flex: 1,
                                            padding: '12px 20px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderColor: 'rgba(255,255,255,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: event.type === 'goal' ? '#10b981' : (event.type.includes('card') ? 'transparent' : 'var(--primary)'),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                                }}>
                                                    {event.type === 'goal' && <Trophy size={16} />}
                                                    {event.type === 'yellow_card' && <Square size={18} fill="#fbbf24" color="#fbbf24" style={{ borderRadius: '2px' }} />}
                                                    {event.type === 'red_card' && <Square size={18} fill="#ef4444" color="#ef4444" style={{ borderRadius: '2px' }} />}
                                                    {event.type === 'substitution' && <Repeat size={16} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                                                        {event.type === 'goal' && '¡GOOOL!'}
                                                        {event.type === 'yellow_card' && 'Tarjeta Amarilla'}
                                                        {event.type === 'red_card' && 'Tarjeta Roja'}
                                                        {event.type === 'substitution' && 'Cambio de Jugador'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                                        {event.type === 'substitution' ? (
                                                            <>Sale <span style={{ color: '#ef4444' }}>{event.playerOut}</span> / Entra <span style={{ color: '#10b981' }}>{event.playerIn}</span></>
                                                        ) : (
                                                            <><span style={{ fontWeight: 'bold', color: 'white' }}>{event.player}</span> {event.detail ? `(${event.detail})` : ''}</>
                                                        )}
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{event.team}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => removeEvent(event.id)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', padding: '5px' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Selector Jugadores */}
            {showAddPlayer && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '25px', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0 }}>Agregar Jugador a <span style={{ color: 'var(--primary)' }}>{showAddPlayer === 'A' ? match.teamA.name : match.teamB.name}</span></h2>
                                <button onClick={() => setShowAddPlayer(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                            </div>
                            <input
                                className="premium-input"
                                placeholder="Buscar por nombre o DNI..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                            {filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    className="nav-item"
                                    style={{
                                        flexDirection: 'row',
                                        padding: '12px',
                                        justifyContent: 'flex-start',
                                        gap: '15px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.02)',
                                        marginBottom: '5px'
                                    }}
                                    onClick={() => handleAddPlayer(user, showAddPlayer)}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155', overflow: 'hidden' }}>
                                        <img src={user.photos?.[0] || user.photo || 'https://via.placeholder.com/40'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '600', color: 'white' }}>{user.name || (user.nombre + ' ' + (user.apellido || ''))}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DNI: {user.dni}</div>
                                    </div>
                                    <Plus size={18} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        style={{
            background: active ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
            border: active ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
            borderRadius: '99px',
            padding: '10px 20px',
            color: active ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: active ? '700' : '500',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
        }}
    >
        {icon} {label}
    </button>
);

const SquadColumn = ({ title, players, teamType, onAdd, onSubstitution, onUpdate, onRemove }) => (
    <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start', // Cambio a flex-start para nombres largos
            gap: '10px',
            background: 'rgba(255,255,255,0.02)'
        }}>
            <div style={{ flex: 1, minWidth: 0 }}> {/* minWidth: 0 permite que el texto se trunque o ajuste */}
                <h4 style={{
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontSize: '0.9rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' // Mantiene el nombre en una línea con scroll/ellipsis si es necesario
                }} title={title}>{title}</h4>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Plantel: {players.length} jugadores</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => onSubstitution(teamType)} className="glass-button" style={{ fontSize: '0.6rem', padding: '5px 8px', background: 'rgba(59, 130, 246, 0.1)' }}>
                    <Repeat size={12} /> <span className="hide-mobile">CAMBIO</span>
                </button>
                <button onClick={onAdd} className="glass-button" style={{ width: '30px', height: '30px', padding: 0, borderRadius: '50%', fontSize: '0.6rem' }}>
                    <Plus size={16} />
                </button>
            </div>
        </div>
        <div style={{ padding: '10px' }}>
            {players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin jugadores asignados</div>
            ) : (
                players.map((p, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        gap: '12px',
                        borderBottom: idx === players.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)'
                    }}>
                        <div style={{ width: '25px', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>
                            <input
                                type="number"
                                value={p.number}
                                onChange={(e) => onUpdate(idx, 'number', e.target.value)}
                                style={{ background: 'none', border: 'none', color: 'inherit', width: '100%', textAlign: 'center', fontWeight: 'bold' }}
                            />
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={p.photo || 'https://via.placeholder.com/40'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ flex: 1, opacity: p.status === 'suplente' ? 0.5 : 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '500', color: p.status === 'expulsado' ? '#ef4444' : 'white' }}>
                                {p.name}
                                {p.status === 'expulsado' && <span style={{ fontSize: '0.6rem', background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: '4px', marginLeft: '5px' }}>EXPULSADO</span>}
                                {p.status === 'suplente' && <span style={{ fontSize: '0.6rem', background: '#475569', color: 'white', padding: '1px 4px', borderRadius: '4px', marginLeft: '5px' }}>SUPLENTE</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.status === 'titular' ? 'Titular' : (p.status === 'suplente' ? 'Suplente' : 'Expulsado')}</div>
                        </div>

                        {/* Cards Control */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '6px', padding: '2px' }}>
                                <button onClick={() => onUpdate(idx, 'yellowCards', Math.max(0, (parseInt(p.yellowCards) || 0) - 1))} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '2px', opacity: 0.5 }}><Minus size={10} /></button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 4px' }}>
                                    <Square size={14} fill="#fbbf24" color="#fbbf24" style={{ borderRadius: '2px' }} />
                                    <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 'bold' }}>{p.yellowCards || 0}</span>
                                </div>
                                <button onClick={() => onUpdate(idx, 'yellowCards', (parseInt(p.yellowCards) || 0) + 1)} disabled={p.status === 'expulsado'} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '2px' }}><Plus size={10} /></button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', padding: '2px' }}>
                                <button onClick={() => onUpdate(idx, 'redCard', false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', opacity: 0.5 }}><Minus size={10} /></button>
                                <div style={{ padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                                    <Square size={14} fill={p.redCard ? "#ef4444" : "transparent"} color="#ef4444" style={{ borderRadius: '2px', opacity: p.redCard ? 1 : 0.2 }} />
                                </div>
                                <button onClick={() => onUpdate(idx, 'redCard', true)} disabled={p.status === 'expulsado'} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><Plus size={10} /></button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Goles:</span>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                                <button
                                    onClick={() => onUpdate(idx, 'goals', Math.max(0, (parseInt(p.goals) || 0) - 1))}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                    <Minus size={12} />
                                </button>
                                <input
                                    type="number"
                                    value={p.goals}
                                    onChange={(e) => onUpdate(idx, 'goals', e.target.value)}
                                    style={{ background: 'none', border: 'none', color: 'white', width: '25px', textAlign: 'center', appearance: 'none', fontSize: '0.8rem', fontWeight: 'bold' }}
                                />
                                <button
                                    onClick={() => onUpdate(idx, 'goals', (parseInt(p.goals) || 0) + 1)}
                                    style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => onRemove(idx)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: p.status === 'suplente' ? 'var(--primary)' : 'var(--error)',
                                opacity: 0.5,
                                cursor: 'pointer'
                            }}
                            title={p.status === 'suplente' ? "Restaurar a Titular" : "Mover a Suplentes"}
                        >
                            {p.status === 'suplente' ? <Plus size={14} /> : <Trash2 size={14} />}
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
);

export default MatchDetail;
