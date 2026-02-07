import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { voiceReferee } from '../services/voiceService';
import { subscribeToMatch, updateMatch } from '../services/matchesService';
import { getUsers } from '../services/db';
import { Mic, MicOff, Trophy, Users, Activity, BarChart2, Plus, ArrowLeft, Calendar, Clock, User, Trash2, Minus, Square, Repeat, Download } from 'lucide-react';
import releaseInfo from '../release.json';

const MatchDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [match, setMatch] = useState(null);
    const [activeTab, setActiveTab] = useState('planteles'); // eventos, planteles, stats
    const [loading, setLoading] = useState(true);
    const [showAddPlayer, setShowAddPlayer] = useState(null); // 'A' or 'B'
    const [allUsers, setAllUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [matchTime, setMatchTime] = useState({ min: 0, sec: 0 });

    // Estado para control de Voz
    const [isVoiceActive, setIsVoiceActive] = useState(false);

    /**
     * Efecto principal:
     * 1. Suscribe a actualizaciones en tiempo real del partido.
     * 2. Gestiona el cronómetro local sincronizado con el servidor.
     * 3. Carga la lista global de usuarios.
     */
    useEffect(() => {
        const unsubscribe = subscribeToMatch(id, (data) => {
            setMatch(data);
            setLoading(false);
        });

        const timer = setInterval(() => {
            if (match && match.status === 'live' && match.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
                setMatchTime({
                    min: Math.floor(totalElapsedSeconds / 60),
                    sec: totalElapsedSeconds % 60
                });
            } else {
                const totalSeconds = (match?.accumulatedSeconds || (match?.accumulatedTime || 0) * 60);
                setMatchTime({
                    min: Math.floor(totalSeconds / 60),
                    sec: totalSeconds % 60
                });
            }
        }, 1000);

        loadUsers();
        return () => {
            unsubscribe();
            clearInterval(timer);
            if (voiceReferee.isListening) {
                voiceReferee.stop();
            }
        };
    }, [id, match?.status, match?.liveStartTime]);

    const loadUsers = async () => {
        const data = await getUsers();
        setAllUsers(data);
    };


    /**
     * Actualiza el marcador global del partido.
     * @param {string} team - 'a' o 'b'
     * @param {number} delta - Valor a sumar o restar (ej: 1, -1)
     */
    const handleScoreChange = async (team, delta, matchOverride = null) => {
        const targetMatch = matchOverride || match;
        const teamKey = team.toLowerCase();
        const currentScore = targetMatch.score[teamKey] || 0;
        const newScore = Math.max(0, currentScore + delta);
        await updateMatch(id, { score: { ...targetMatch.score, [teamKey]: newScore } });
    };

    /**
     * Añade un jugador de la base de datos al plantel del partido.
     * Inicializa sus stats en 0 para este encuentro.
     */
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
            number: user.dorsal ? parseInt(user.dorsal) : (currentPlayers.length + 1),
            goals: 0,
            assists: 0,
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
                    try {
                        let updates = {};
                        let changed = false;

                        if (hasNoPlayersA) {
                            const teamAUsers = allUsers.filter(u => u && u.team === match.teamA.name);
                            if (teamAUsers.length > 0) {
                                updates.playersA = teamAUsers.map((u, idx) => ({
                                    userId: u.id,
                                    name: u.name || (u.nombre + ' ' + (u.apellido || '')),
                                    photo: u.photos?.[0] || u.photo || null,
                                    number: (u.dorsal && !isNaN(parseInt(u.dorsal))) ? parseInt(u.dorsal) : (idx + 1),
                                    goals: 0,
                                    assists: 0,
                                    yellowCards: 0,
                                    redCard: false,
                                    status: 'titular'
                                }));
                                changed = true;
                            }
                        }

                        if (hasNoPlayersB) {
                            const teamBUsers = allUsers.filter(u => u && u.team === match.teamB.name);
                            if (teamBUsers.length > 0) {
                                updates.playersB = teamBUsers.map((u, idx) => ({
                                    userId: u.id,
                                    name: u.name || (u.nombre + ' ' + (u.apellido || '')),
                                    photo: u.photos?.[0] || u.photo || null,
                                    number: (u.dorsal && !isNaN(parseInt(u.dorsal))) ? parseInt(u.dorsal) : (idx + 1),
                                    goals: 0,
                                    assists: 0,
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
                    } catch (error) {
                        console.error("Error en autoPopulate:", error);
                    }
                };
                autoPopulate();
            }
        }
    }, [loading, match?.id, allUsers.length]);

    /**
     * Actualiza las estadísticas de un jugador (goles, tarjetas, dorsal).
     * Genera automáticamente los eventos correspondientes en el timeline.
     * Maneja reglas de negocio como doble amarilla = roja, y expulsión = no más goles.
     */
    const handleUpdatePlayer = async (playerIndex, teamType, field, value, matchOverride = null) => {
        const targetMatch = matchOverride || match;
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(targetMatch[playerKey] || [])];
        const player = currentPlayers[playerIndex];
        const oldValue = player[field] || 0;

        currentPlayers[playerIndex] = { ...player, [field]: value };

        let extraData = {};
        const getEventTime = () => {
            if (targetMatch.status === 'live' && targetMatch.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - targetMatch.liveStartTime) / 1000) + (targetMatch.accumulatedSeconds || (targetMatch.accumulatedTime || 0) * 60);
                const m = Math.floor(totalElapsedSeconds / 60);
                const s = totalElapsedSeconds % 60;
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')}`;
        };

        const timeStr = getEventTime();

        if (field === 'goals') {
            const oldGoals = parseInt(oldValue) || 0;
            const newGoals = parseInt(value) || 0;
            if (newGoals > oldGoals) {
                extraData.events = [...(targetMatch.events || []), {
                    id: Date.now().toString(), type: 'goal', player: player.name,
                    team: teamType === 'A' ? targetMatch.teamA.name : targetMatch.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                }];
            } else if (newGoals < oldGoals) {
                const allEvents = [...(targetMatch.events || [])];
                const lastGoalIdx = allEvents.map((e, idx) => ({ ...e, originalIdx: idx }))
                    .filter(e => e.type === 'goal' && e.player === player.name && e.teamSide === teamType)
                    .pop()?.originalIdx;
                if (lastGoalIdx !== undefined) {
                    allEvents.splice(lastGoalIdx, 1);
                    extraData.events = allEvents;
                }
            }
        }

        if (field === 'assists') {
            const oldQty = parseInt(oldValue) || 0;
            const newQty = parseInt(value) || 0;
            if (newQty > oldQty) {
                extraData.events = [...(targetMatch.events || []), {
                    id: Date.now().toString(), type: 'assist', player: player.name,
                    team: teamType === 'A' ? targetMatch.teamA.name : targetMatch.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                }];
            } else if (newQty < oldQty) {
                const allEvents = [...(targetMatch.events || [])];
                const lastIdx = allEvents.map((e, idx) => ({ ...e, originalIdx: idx }))
                    .filter(e => e.type === 'assist' && e.player === player.name && e.teamSide === teamType)
                    .pop()?.originalIdx;
                if (lastIdx !== undefined) {
                    allEvents.splice(lastIdx, 1);
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
                    team: teamType === 'A' ? targetMatch.teamA.name : targetMatch.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                };
                extraData.events = [...(targetMatch.events || []), newEvent];

                if (isDoubleYellow) {
                    currentPlayers[playerIndex].status = 'expulsado';
                    currentPlayers[playerIndex].redCard = true;
                }
            } else if (newCount < oldValue) {
                const allEvents = [...(targetMatch.events || [])];
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
                extraData.events = [...(targetMatch.events || []), {
                    id: Date.now().toString(), type: 'red_card', player: player.name,
                    detail: 'Roja Directa',
                    team: teamType === 'A' ? targetMatch.teamA.name : targetMatch.teamB.name,
                    teamSide: teamType, time: timeStr, timestamp: Date.now()
                }];
            } else if (value === false && oldValue === true) {
                const allEvents = [...(targetMatch.events || [])];
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

    /**
     * Registra una sustitución.
     * Genera el evento en el timeline con el minuto exacto.
     */
    const handleSubstitution = async (teamType) => {
        const playerIn = prompt("Nombre del jugador que ENTRA:");
        const playerOut = prompt("Nombre del jugador que SALE:");
        if (!playerIn || !playerOut) return;

        await executeSubstitution(teamType, playerIn, playerOut);
    };

    const executeSubstitution = async (teamType, playerInName, playerOutName) => {
        const getEventTime = () => {
            if (match.status === 'live' && match.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
                const m = Math.floor(totalElapsedSeconds / 60);
                const s = totalElapsedSeconds % 60;
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')}`;
        };

        const timeStr = getEventTime();

        const newEvent = {
            id: Date.now().toString(),
            type: 'substitution',
            playerIn: playerInName,
            playerOut: playerOutName,
            team: teamType === 'A' ? match.teamA.name : match.teamB.name,
            teamSide: teamType,
            time: timeStr,
            timestamp: Date.now()
        };

        await updateMatch(id, { events: [...(match.events || []), newEvent] });
    };

    /**
     * Procesa comandos de voz del árbitro
     */
    // Ref para acceder al estado más reciente dentro del callback de voz (evita closures viejos)
    const matchRef = useRef(match);
    useEffect(() => {
        matchRef.current = match;
    }, [match]);

    /**
     * Procesa comandos de voz del árbitro
     */
    const handleVoiceCommand = async (data) => {
        const currentMatch = matchRef.current;
        if (!currentMatch) return;

        console.log("Comando de voz recibido:", data);

        const { command, dorsal } = data;

        // Función auxiliar para buscar jugador por dorsal
        const findAndExecute = async (teamSide, action) => {
            const playerKey = teamSide === 'A' ? 'playersA' : 'playersB';
            const players = currentMatch[playerKey] || [];

            // Si hay dorsal, buscamos específicamente
            let playerIndex = -1;

            if (dorsal) {
                // Buscamos coincidencia exacta con el número de camiseta (string comparison safe)
                playerIndex = players.findIndex(p => p.number == dorsal);
            }

            if (playerIndex !== -1) {
                if (action === 'goal') {
                    // Sumar gol al jugador
                    const currentGoals = parseInt(players[playerIndex].goals) || 0;
                    await handleUpdatePlayer(playerIndex, teamSide, 'goals', currentGoals + 1, currentMatch); // Pasamos currentMatch
                    // Actualizar marcador global
                    await handleScoreChange(teamSide, 1, currentMatch);
                } else if (action === 'yellow') {
                    const currentCards = parseInt(players[playerIndex].yellowCards) || 0;
                    await handleUpdatePlayer(playerIndex, teamSide, 'yellowCards', currentCards + 1, currentMatch);
                } else if (action === 'red') {
                    await handleUpdatePlayer(playerIndex, teamSide, 'redCard', true, currentMatch);
                }
            } else {
                // Si es gol y no hay dorsal, sumamos al marcador global solamente
                if (action === 'goal') {
                    await handleScoreChange(teamSide, 1, currentMatch);
                }
            }
        };

        if (command === 'goal_local') await findAndExecute('A', 'goal');
        if (command === 'goal_visitor') await findAndExecute('B', 'goal');

        // Si detectamos tarjeta, buscamos el dorsal en el equipo indicado o en AMBOS si no se especifica
        if (command.includes('yellow_card') || command.includes('red_card')) {
            if (dorsal) {
                const action = command.includes('yellow_card') ? 'yellow' : 'red';

                // Si el comando especifica equipo (ej: yellow_card_local)
                if (command.endsWith('_local')) {
                    await findAndExecute('A', action);
                } else if (command.endsWith('_visitor')) {
                    await findAndExecute('B', action);
                } else {
                    // Si no especifica (comando genérico "amarilla 10"), buscamos en ambos
                    const idxA = (currentMatch.playersA || []).findIndex(p => p.number == dorsal);
                    const idxB = (currentMatch.playersB || []).findIndex(p => p.number == dorsal);

                    if (idxA !== -1) await findAndExecute('A', action);
                    else if (idxB !== -1) await findAndExecute('B', action);
                    else voiceReferee.speak(`No encuentro al dorsal ${dorsal}`);
                }
            } else {
                voiceReferee.speak("Necesito el número de dorsal.");
            }
        }
        if (command === 'time_check') {
            voiceReferee.speak(`Van ${matchTime.min} minutos de juego.`);
        }

        if (command === 'score_check') {
            const leading = currentMatch.score.a > currentMatch.score.b ? `Gana ${currentMatch.teamA.name}` : (currentMatch.score.b > currentMatch.score.a ? `Gana ${currentMatch.teamB.name}` : "Empate");
            voiceReferee.speak(`${currentMatch.score.a} a ${currentMatch.score.b}. ${leading}`);
        }

        if (command === 'start_match') await changeMatchStatus('live');
        if (command === 'halftime') await changeMatchStatus('halftime');
        if (command === 'finish_match') await changeMatchStatus('finished');

        if (command === 'substitution') {
            // voiceService devuelve: dorsal (IN), dorsal2 (OUT) usualmente si se dice "Entra X Sale Y"
            // Pero validaremos buscando al jugador que SALE (dorsal2) en los titulares/plantel
            const numIn = data.dorsal;
            const numOut = data.dorsal2;

            if (!numIn || !numOut) {
                voiceReferee.speak("Indique números. Ejemplo: Entra 8 sale 10");
                return;
            }

            // Buscamos quién Sale (numOut) para saber el equipo
            const pOutA = (currentMatch.playersA || []).find(p => p.number == numOut);
            const pOutB = (currentMatch.playersB || []).find(p => p.number == numOut);

            let teamSide = null;
            let playerOutName = '';
            let playerInName = '';

            if (pOutA) {
                teamSide = 'A';
                playerOutName = pOutA.name;
                const pIn = (currentMatch.playersA || []).find(p => p.number == numIn);
                playerInName = pIn ? pIn.name : `Dorsal ${numIn}`;
            } else if (pOutB) {
                teamSide = 'B';
                playerOutName = pOutB.name;
                const pIn = (currentMatch.playersB || []).find(p => p.number == numIn);
                playerInName = pIn ? pIn.name : `Dorsal ${numIn}`;
            } else {
                voiceReferee.speak(`No encuentro al jugador número ${numOut}`);
                return;
            }

            // Ejecutar sustitución
            await executeSubstitution(teamSide, playerInName, playerOutName);
        }

        if (command === 'undo') {
            voiceReferee.speak("Función deshacer no disponible por seguridad.");
        }
    };

    const changeMatchStatus = async (newStatus) => {
        const updateData = { status: newStatus };
        const now = Date.now();
        let newEvent = null;

        const formatCurrentTime = () => {
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')}`;
        };

        if (newStatus === 'live') {
            updateData.liveStartTime = now;
            if (match.status === 'scheduled') {
                newEvent = { id: 'start-' + now, type: 'match_start', detail: 'Inicio de Partido', time: '00:00', timestamp: now };
            } else if (match.status === 'halftime') {
                newEvent = { id: 'resume-' + now, type: 'match_start', detail: 'Reinicio 2do Tiempo', time: formatCurrentTime(), timestamp: now };
            }
        } else if (newStatus === 'halftime' || newStatus === 'finished') {
            if (match.status === 'live' && match.liveStartTime) {
                const elapsedSec = Math.floor((now - match.liveStartTime) / 1000);
                updateData.accumulatedSeconds = (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60) + elapsedSec;
                updateData.liveStartTime = null;
            }
            if (newStatus === 'halftime') {
                newEvent = { id: 'halftime-' + now, type: 'halftime', detail: 'Entretiempo', time: formatCurrentTime(), timestamp: now };
            } else if (newStatus === 'finished') {
                newEvent = { id: 'finish-' + now, type: 'finish', detail: 'Final del Partido', time: formatCurrentTime(), timestamp: now };
            }
        }

        if (newEvent) {
            updateData.events = [...(match.events || []), newEvent];
        }

        await updateMatch(id, updateData);
    };

    const toggleVoice = () => {
        if (isVoiceActive) {
            voiceReferee.stop();
            setIsVoiceActive(false);
        } else {
            voiceReferee.start(handleVoiceCommand);
            setIsVoiceActive(true);
        }
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
            {/* Header Volver y Voz */}
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                <button
                    onClick={toggleVoice}
                    className="glass-button"
                    style={{
                        padding: '8px 16px',
                        background: isVoiceActive ? '#ef4444' : 'rgba(255,255,255,0.1)',
                        borderColor: isVoiceActive ? '#ef4444' : 'rgba(255,255,255,0.2)',
                        animation: isVoiceActive ? 'pulse 2s infinite' : 'none'
                    }}
                >
                    {isVoiceActive ? <Mic size={18} color="white" /> : <MicOff size={18} />}
                    <span style={{ marginLeft: '8px' }}>{isVoiceActive ? 'DIGA: ÁRBITRO...' : 'Usar Voz'}</span>
                </button>
            </div>

            {/* Scoreboard Card */}
            <div className="glass-panel" style={{ padding: '30px', marginBottom: '25px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
                    <select
                        className="premium-input"
                        style={{ padding: '5px 10px', fontSize: '0.7rem', width: 'auto', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        value={match.status}
                        onChange={(e) => changeMatchStatus(e.target.value)}
                    >
                        <option style={{ color: 'black' }} value="scheduled">Programado</option>
                        <option style={{ color: 'black' }} value="live">En Vivo</option>
                        <option style={{ color: 'black' }} value="halftime">Entretiempo</option>
                        <option style={{ color: 'black' }} value="finished">Finalizado</option>
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
                                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                                    {matchTime.min.toString().padStart(2, '0')}:{matchTime.sec.toString().padStart(2, '0')}
                                </div>
                            </div>
                        )}
                        {match.status === 'halftime' && (
                            <div className="halftime-badge" style={{ padding: '8px 15px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                • ENTRETIEMPO ({matchTime.min.toString().padStart(2, '0')}:{matchTime.sec.toString().padStart(2, '0')})
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
            {
                activeTab === 'planteles' && (
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
                )
            }

            {
                activeTab === 'stats' && (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
                        <h3>Resumen de Estadísticas</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Métricas acumuladas del encuentro.</p>
                    </div>
                )
            }

            {
                activeTab === 'eventos' && (
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
                                                background: event.type === 'goal' ? '#10b981' : (event.type === 'red_card' ? '#ef4444' : (event.type === 'yellow_card' ? '#fbbf24' : (event.type.includes('match') || event.type === 'halftime' || event.type === 'finish' ? '#3b82f6' : 'var(--primary)'))),
                                                boxShadow: `0 0 10px ${event.type === 'goal' ? '#10b981' : (event.type.includes('match') ? '#3b82f6' : 'var(--primary)')}`
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
                                                        {event.type === 'assist' && <Activity size={16} />}
                                                        {event.type === 'yellow_card' && <Square size={18} fill="#fbbf24" color="#fbbf24" style={{ borderRadius: '2px' }} />}
                                                        {event.type === 'red_card' && <Square size={18} fill="#ef4444" color="#ef4444" style={{ borderRadius: '2px' }} />}
                                                        {event.type === 'substitution' && <Repeat size={16} />}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                                                            {event.type === 'goal' && '¡GOOOL!'}
                                                            {event.type === 'assist' && '¡ASISTENCIA!'}
                                                            {event.type === 'yellow_card' && 'Tarjeta Amarilla'}
                                                            {event.type === 'red_card' && 'Tarjeta Roja'}
                                                            {event.type === 'substitution' && 'Cambio de Jugador'}
                                                            {event.type === 'match_start' && 'Inicio / Reinicio'}
                                                            {event.type === 'halftime' && 'Entretiempo'}
                                                            {event.type === 'finish' && 'Final del Partido'}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                                            {event.type === 'substitution' ? (
                                                                <>Sale <span style={{ color: '#ef4444' }}>{event.playerOut}</span> / Entra <span style={{ color: '#10b981' }}>{event.playerIn}</span></>
                                                            ) : (event.type === 'match_start' || event.type === 'halftime' || event.type === 'finish') ? (
                                                                <span>{event.detail}</span>
                                                            ) : (
                                                                <><span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{event.player}</span> {event.detail ? `(${event.detail})` : ''}</>
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
                )
            }

            {/* Modal Selector Jugadores */}
            {
                showAddPlayer && (
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
                                            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{user.name || (user.nombre + ' ' + (user.apellido || ''))}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DNI: {user.dni}</div>
                                        </div>
                                        <Plus size={18} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
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
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>G:</span>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                                <button
                                    onClick={() => onUpdate(idx, 'goals', Math.max(0, (parseInt(p.goals) || 0) - 1))}
                                    disabled={p.status === 'suplente' || p.status === 'expulsado'}
                                    style={{ background: 'none', border: 'none', color: p.status === 'suplente' || p.status === 'expulsado' ? 'rgba(255,255,255,0.05)' : '#ef4444', cursor: p.status === 'suplente' || p.status === 'expulsado' ? 'not-allowed' : 'pointer', padding: '2px' }}
                                >
                                    <Minus size={10} />
                                </button>
                                <div style={{ minWidth: '15px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>{p.goals || 0}</div>
                                <button
                                    onClick={() => onUpdate(idx, 'goals', (parseInt(p.goals) || 0) + 1)}
                                    disabled={p.status === 'suplente' || p.status === 'expulsado'}
                                    style={{ background: 'none', border: 'none', color: p.status === 'suplente' || p.status === 'expulsado' ? 'rgba(255,255,255,0.05)' : '#10b981', cursor: p.status === 'suplente' || p.status === 'expulsado' ? 'not-allowed' : 'pointer', padding: '2px' }}
                                >
                                    <Plus size={10} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>A:</span>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                                <button
                                    onClick={() => onUpdate(idx, 'assists', Math.max(0, (parseInt(p.assists) || 0) - 1))}
                                    disabled={p.status === 'suplente' || p.status === 'expulsado'}
                                    style={{ background: 'none', border: 'none', color: p.status === 'suplente' || p.status === 'expulsado' ? 'rgba(255,255,255,0.05)' : '#3b82f6', cursor: p.status === 'suplente' || p.status === 'expulsado' ? 'not-allowed' : 'pointer', padding: '2px' }}
                                >
                                    <Minus size={10} />
                                </button>
                                <div style={{ minWidth: '15px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>{p.assists || 0}</div>
                                <button
                                    onClick={() => onUpdate(idx, 'assists', (parseInt(p.assists) || 0) + 1)}
                                    disabled={p.status === 'suplente' || p.status === 'expulsado'}
                                    style={{ background: 'none', border: 'none', color: p.status === 'suplente' || p.status === 'expulsado' ? 'rgba(255,255,255,0.05)' : '#3b82f6', cursor: p.status === 'suplente' || p.status === 'expulsado' ? 'not-allowed' : 'pointer', padding: '2px' }}
                                >
                                    <Plus size={10} />
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
