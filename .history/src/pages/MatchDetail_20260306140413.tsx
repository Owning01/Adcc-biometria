/**
 * @file MatchDetail.tsx
 * @description DETALLE DEL PARTIDO (LIVE MATCH CENTER)
 * Pantalla principal para la gestión y visualización de un partido en tiempo real.
 *
 * Funcionalidades Clave:
 * 1. Scoreboard en vivo con cronómetro sincronizado.
 * 2. Gestión de planteles (selección de titulares/suplentes).
 * 3. Eventos en tiempo real (Goles, Tarjetas, Cambios).
 * 4. Integración con Árbitro por Voz (Voice Referee).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { voiceReferee } from '../services/voiceService';
import { subscribeToMatch, updateMatch, getActiveMatches } from '../services/matchesService';
import { getUsers, subscribeToUsers, updateTeamName, updateTeamCategory, saveUser, checkDniExists, updateUser, updateUserCategories, User } from '../services/db';
import QuickRegisterModal from '../components/QuickRegisterModal';
import { Mic, MicOff, Users, Activity, BarChart2, Plus, ArrowLeft, Calendar, Clock, User as UserIcon, Trash2, Minus, Target, Zap, Star, Repeat2, Square, Info, ShieldAlert, Award, TrendingUp, Save, X, Shield } from 'lucide-react';
import { subscribeToTeams, Team } from '../services/teamsService';
import { getAdccImageUrl } from '../utils/imageUtils';
import { submitADCCMatchReport } from '../services/adccService';
import releaseInfo from '../release.json';

interface Match {
    id: string;
    status: string;
    liveStartTime?: number;
    accumulatedSeconds?: number;
    accumulatedTime?: number;
    teamA: { name: string; logo?: string };
    teamB: { name: string; logo?: string };
    score: { a: number; b: number };
    date: string;
    time: string;
    playersA?: any[];
    playersB?: any[];
    events?: any[];
    [key: string]: any;
}

// ============================================================================
// 1. MAIN COMPONENT & STATE
// ============================================================================
const MatchDetail = ({ userRole }: { userRole: string }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<Match | null>(null);
    const [activeTab, setActiveTab] = useState('planteles'); // eventos, planteles, stats
    const [loading, setLoading] = useState(true);
    const [showAddPlayer, setShowAddPlayer] = useState<string | null>(null); // 'A' or 'B'
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterData, setQuickRegisterData] = useState<any>(null);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);

    const [matchTime, setMatchTime] = useState({ min: 0, sec: 0 });

    // Permisos de usuario
    const isAdminOrDev = userRole === 'admin' || userRole === 'dev';
    const isReferee = userRole === 'referee';

    // Estado para control de Voz
    const [isVoiceActive, setIsVoiceActive] = useState(false);

    // Estado para Carga de Planilla Oficial
    const [showReportModal, setShowReportModal] = useState(false);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [reportData, setReportData] = useState({
        arbitro1: '',
        arbitro2: '',
        arbitro3: '',
        informearbitro: '',
        res_local_p: null as number | null,
        res_visitante_p: null as number | null,
        partido_id_manual: ''
    });

    // Estado para Modal de Acciones de Jugador
    const [selectedPlayer, setSelectedPlayer] = useState<{ index: number, teamSide: string, player: any } | null>(null);

    // ============================================================================
    // 2. EFFECTS & SUBSCRIPTIONS
    // ============================================================================

    /**
     * Efecto principal:
     * 1. Suscribe a actualizaciones en tiempo real del partido.
     * 2. Gestiona el cronómetro local sincronizado con el servidor.
     * 3. Carga la lista global de usuarios.
     */
    useEffect(() => {
        if (!id) return;
        const unsubscribe = subscribeToMatch(id, (data: any) => {
            setMatch(data);
            setLoading(false);
        });

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
        });

        // Configurar timer para el cronómetro local
        const timer = setInterval(() => {
            // Usamos un ref o el estado directamente, pero cuidado con cierres
            // Aquí dependemos de que el efecto se reinicia si match cambia
            // O mejor hacemos lógica independiente del estado match para solo calcular tiempo
        }, 1000);

        // Lógica corregida del timer dentro del intervalo, 
        // pero necesitamos acceder al estado actual de match.
        // Como este efecto se reinicia con match?.status/liveStartTime, está bien.

        if (match && match.status === 'live' && match.liveStartTime) {
            // Calcular tiempo transcurrido
        }

        // ... (resto del timer logic original, simplificado abajo para el replace)

        loadUsers();
        return () => {
            unsubscribe();
            unsubTeams();
            // clearInterval(timer);
            if (voiceReferee.isListening) {
                voiceReferee.stop();
            }
        };
    }, [id]); // Solo re-suscribir si cambia ID

    // Efecto separado para el timer para no re-suscribir a firebase a cada rato
    useEffect(() => {
        const timer = setInterval(() => {
            if (match && match.status === 'live' && match.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
                setMatchTime({
                    min: Math.floor(totalElapsedSeconds / 60),
                    sec: totalElapsedSeconds % 60
                });
            } else if (match) {
                const totalSeconds = (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
                setMatchTime({
                    min: Math.floor(totalSeconds / 60),
                    sec: totalSeconds % 60
                });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [match]); // Depende de match para calcular

    const loadUsers = async () => {
        const data = await getUsers();
        setAllUsers(data);
    };


    // ============================================================================
    // 3. ACTION HANDLERS (SCORE, PLAYERS, EVENTS)
    // ============================================================================

    /**
     * Actualiza el marcador global del partido.
     * @param {string} team - 'a' o 'b'
     * @param {number} delta - Valor a sumar o restar (ej: 1, -1)
     */
    const handleScoreChange = async (team: string, delta: number, matchOverride: Match | null = null) => {
        const targetMatch = matchOverride || match;
        if (!targetMatch) return;

        const teamKey = team.toLowerCase() as 'a' | 'b';
        const currentScore = targetMatch.score[teamKey] || 0;
        const newScore = Math.max(0, currentScore + delta);
        await updateMatch(id!, { score: { ...targetMatch.score, [teamKey]: newScore } });
    };

    /**
     * Añade un jugador de la base de datos al plantel del partido.
     * Inicializa sus stats en 0 para este encuentro.
     */
    const handleAddPlayer = async (user: any, teamType: string) => {
        if (!match) return;
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = match[playerKey] || [];

        if (currentPlayers.some((p: any) => p.userId === user.id)) {
            alert("El jugador ya está en el plantel.");
            return;
        }

        const newPlayer = {
            userId: user.id,
            jleid: user.jleid || null,
            dni: user.dni || null,
            name: user.name || (user.nombre + ' ' + (user.apellido || '')),
            photo: user.photos?.[0] || user.photo || null,
            number: user.dorsal ? parseInt(user.dorsal) : (currentPlayers.length + 1),
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCard: false,
            status: 'titular',
            isDisabled: user.status === 'deshabilitado' || (user.categoryStatuses && user.categoryStatuses[match.category] === 'deshabilitado')
        };

        // 🛡️ Validación: Verificar si el jugador ya está en otro partido EN VIVO
        const activeMatches = await getActiveMatches();
        const isPlayingElsewhere = activeMatches.some((m: any) =>
            m.id !== id && // No es este partido
            (m.playersA?.some((p: any) => p.userId === user.id) || m.playersB?.some((p: any) => p.userId === user.id))
        );

        if (isPlayingElsewhere) {
            const confirmAdd = window.confirm(`⚠️ ALERTA: ${newPlayer.name} figura jugando en otro partido EN VIVO ahora mismo. ¿Agregarlo de todas formas?`);
            if (!confirmAdd) return;
        }

        if (newPlayer.isDisabled) {
            const confirmAdd = window.confirm(`🚫 JUGADOR DESHABILITADO: ${newPlayer.name} no tiene permiso para jugar. ¿Agregarlo igual con advertencia visual?`);
            if (!confirmAdd) return;
        }

        const updatedMatch = {
            ...match,
            [playerKey]: [...currentPlayers, newPlayer]
        };

        await updateMatch(id!, { [playerKey]: updatedMatch[playerKey] });
        setShowAddPlayer(null);
    };

    /**
     * Actualiza el estado del partido (live, halftime, finished).
     */
    const handleStatusUpdate = async (newStatus: string) => {
        if (!id) return;
        const updates: any = { status: newStatus };

        if (newStatus === 'live') {
            updates.liveStartTime = Date.now();
        } else if (newStatus === 'halftime' || newStatus === 'finished') {
            // Detener timer y guardar tiempo acumulado
            if (match?.liveStartTime) {
                const elapsed = Math.floor((Date.now() - match.liveStartTime) / 1000);
                updates.accumulatedSeconds = (match.accumulatedSeconds || 0) + elapsed;
                updates.liveStartTime = null;
            }
        }

        await updateMatch(id, updates);
    };

    // Auto-poblar jugadores si la lista está vacía
    useEffect(() => {
        if (!loading && match && allUsers.length > 0) {
            const hasNoPlayersA = !match.playersA || match.playersA.length === 0;
            const hasNoPlayersB = !match.playersB || match.playersB.length === 0;

            if (hasNoPlayersA || hasNoPlayersB) {
                const autoPopulate = async () => {
                    try {
                        let updates: any = {};
                        let changed = false;

                        if (hasNoPlayersA) {
                            const teamAUsers = allUsers.filter((u: any) => u && u.team === match.teamA.name);
                            if (teamAUsers.length > 0) {
                                updates.playersA = teamAUsers.map((u: any, idx: number) => ({
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
                            const teamBUsers = allUsers.filter((u: any) => u && u.team === match.teamB.name);
                            if (teamBUsers.length > 0) {
                                updates.playersB = teamBUsers.map((u: any, idx: number) => ({
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
                            await updateMatch(id!, updates);
                        }
                    } catch (error) {
                        // Error en autoPopulate
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
    const handleUpdatePlayer = async (playerIndex: number, teamType: string, field: string, value: any, matchOverride: Match | null = null) => {
        const targetMatch = matchOverride || match;
        if (!targetMatch) return;

        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(targetMatch[playerKey] || [])];
        const player = currentPlayers[playerIndex];
        const oldValue = player[field] || 0;

        currentPlayers[playerIndex] = { ...player, [field]: value };

        let extraData: any = {};
        const getEventTime = () => {
            if (targetMatch.status === 'live' && targetMatch.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - targetMatch.liveStartTime) / 1000) + (targetMatch.accumulatedSeconds || (targetMatch.accumulatedTime || 0) * 60);
                const m = Math.floor(totalElapsedSeconds / 60);
                const s = totalElapsedSeconds % 60;
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
            }
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')} `;
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
                const lastGoalIdx = allEvents.map((e: any, idx: number) => ({ ...e, originalIdx: idx }))
                    .filter((e: any) => e.type === 'goal' && e.player === player.name && e.teamSide === teamType)
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
                const lastIdx = allEvents.map((e: any, idx: number) => ({ ...e, originalIdx: idx }))
                    .filter((e: any) => e.type === 'assist' && e.player === player.name && e.teamSide === teamType)
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
                const lastIdx = allEvents.map((e: any, idx: number) => ({ ...e, originalIdx: idx }))
                    .filter((e: any) => (e.type === 'yellow_card' || (e.type === 'red_card' && e.detail === 'Doble Amarilla')) && e.player === player.name && e.teamSide === teamType)
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
                const lastIdx = allEvents.map((e: any, idx: number) => ({ ...e, originalIdx: idx }))
                    .filter((e: any) => e.type === 'red_card' && e.player === player.name && e.teamSide === teamType && e.detail === 'Roja Directa')
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

        await updateMatch(id!, { [playerKey]: currentPlayers, ...extraData });
    };

    /**
     * Registra una sustitución.
     * Genera el evento en el timeline con el minuto exacto.
     */
    const handleSubstitution = async (teamType: string, playerInName?: string, playerOutName?: string) => {
        if (!match) return;
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(match[playerKey] || [])];

        let inName = playerInName;
        let outName = playerOutName;

        if (!inName || !outName) {
            // Lógica simple para UI manual (sin modal complejo)
            const numOut = prompt("Dorsal del jugador que SALE:");
            if (!numOut) return;
            const pOut = currentPlayers.find((p: any) => p.number == numOut);
            if (!pOut) { alert("Jugador no encontrado"); return; }
            outName = pOut.name;

            const numIn = prompt("Dorsal del jugador que ENTRA:");
            if (!numIn) return;
            const pIn = currentPlayers.find((p: any) => p.number == numIn);
            if (!pIn) { alert("Jugador no encontrado"); return; }
            inName = pIn.name;
        }

        // 1. Encontrar índices
        const idxIn = currentPlayers.findIndex((p: any) => p.name === inName);
        const idxOut = currentPlayers.findIndex((p: any) => p.name === outName);

        if (idxIn === -1 || idxOut === -1) {
            return;
        }

        // 2. Cambiar estados
        currentPlayers[idxIn] = { ...currentPlayers[idxIn], status: 'titular' };
        currentPlayers[idxOut] = { ...currentPlayers[idxOut], status: 'suplente' };

        // 3. Registrar evento de cambio (opcional, si quisieras que aparezca en el timeline)
        const getEventTime = () => {
            if (match.status === 'live' && match.liveStartTime) {
                const totalElapsedSeconds = Math.floor((Date.now() - match.liveStartTime) / 1000) + (match.accumulatedSeconds || (match.accumulatedTime || 0) * 60);
                const m = Math.floor(totalElapsedSeconds / 60);
                const s = totalElapsedSeconds % 60;
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
            }
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')} `;
        };

        const extraData: any = {};
        extraData.events = [...(match.events || []), {
            id: Date.now().toString(),
            type: 'substitution',
            playerIn: inName,
            playerOut: outName,
            team: teamType === 'A' ? match.teamA.name : match.teamB.name,
            teamSide: teamType,
            time: getEventTime(),
            timestamp: Date.now()
        }];

        await updateMatch(id!, { [playerKey]: currentPlayers, ...extraData });
    };

    // ============================================================================
    // 4. VOICE COMMAND LOGIC
    // ============================================================================

    /**
     * Procesa comandos de voz del árbitro
     */
    // Ref para acceder al estado más reciente dentro del callback de voz (evita closures viejos)
    const matchRef = useRef(match);
    useEffect(() => {
        matchRef.current = match;
    }, [match]);

    /**
     * Cambia el estado del partido (live, halftime, finished)
     * Actualiza cronómetro y genera eventos de inicio/fin
     */
    const changeMatchStatus = async (newStatus: string) => {
        if (!match) return;

        const updateData: any = { status: newStatus };
        const now = Date.now();
        let newEvent = null;

        const formatCurrentTime = () => {
            return `${matchTime.min.toString().padStart(2, '0')}:${matchTime.sec.toString().padStart(2, '0')} `;
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

        await updateMatch(id!, updateData);
    };

    /**
     * Procesa comandos de voz del árbitro
     */
    const handleVoiceCommand = async (data: any) => {
        const currentMatch = matchRef.current;
        if (!currentMatch) return;


        const { command, dorsal, dorsal2 } = data;

        // Función auxiliar para buscar jugador por dorsal y ejecutar acción
        const findAndExecute = async (teamSide: string, action: string) => {
            const playerKey = teamSide === 'A' ? 'playersA' : 'playersB';
            const players = currentMatch[playerKey] || [];
            let playerIndex = -1;

            if (dorsal) {
                // Buscamos coincidencia exacta con el número de camiseta
                playerIndex = players.findIndex((p: any) => p.number == dorsal);
            }

            if (playerIndex !== -1) {
                const playerWrapper = { ...players[playerIndex] };
                if (action === 'goal') {
                    const currentGoals = parseInt(playerWrapper.goals) || 0;
                    await handleUpdatePlayer(playerIndex, teamSide, 'goals', currentGoals + 1, currentMatch);
                    await handleScoreChange(teamSide, 1, currentMatch);
                    voiceReferee.speak(`Gol de ${playerWrapper.name} `);
                } else if (action === 'yellow') {
                    const currentCards = parseInt(playerWrapper.yellowCards) || 0;
                    await handleUpdatePlayer(playerIndex, teamSide, 'yellowCards', currentCards + 1, currentMatch);
                    voiceReferee.speak(`Amarilla para ${playerWrapper.name} `);
                } else if (action === 'red') {
                    await handleUpdatePlayer(playerIndex, teamSide, 'redCard', true, currentMatch);
                    voiceReferee.speak(`Roja para ${playerWrapper.name} `);
                }
            } else {
                // Acciones sin jugador específico o jugador no encontrado
                if (action === 'goal') {
                    await handleScoreChange(teamSide, 1, currentMatch);
                    voiceReferee.speak(`Gol para el equipo ${teamSide === 'A' ? 'local' : 'visitante'} `);
                } else if (dorsal) {
                    voiceReferee.speak(`No encuentro el dorsal ${dorsal} en el equipo ${teamSide === 'A' ? 'local' : 'visitante'} `);
                }
            }
        };

        if (command === 'goal_local') await findAndExecute('A', 'goal');
        if (command === 'goal_visitor') await findAndExecute('B', 'goal');

        // Si detectamos tarjeta
        if (command.includes('yellow_card') || command.includes('red_card')) {
            if (dorsal) {
                const action = command.includes('yellow_card') ? 'yellow' : 'red';

                if (command.endsWith('_local')) {
                    await findAndExecute('A', action);
                } else if (command.endsWith('_visitor')) {
                    await findAndExecute('B', action);
                } else {
                    const idxA = (currentMatch.playersA || []).findIndex((p: any) => p.number == dorsal);
                    const idxB = (currentMatch.playersB || []).findIndex((p: any) => p.number == dorsal);

                    if (idxA !== -1) await findAndExecute('A', action);
                    else if (idxB !== -1) await findAndExecute('B', action);
                    else voiceReferee.speak(`No encuentro al dorsal ${dorsal} `);
                }
            } else {
                voiceReferee.speak("Necesito el número de dorsal.");
            }
        }

        if (command === 'time_check') {
            voiceReferee.speak(`Van ${matchTime.min} minutos de juego.`);
        }

        if (command === 'score_check') {
            const leading = currentMatch.score.a > currentMatch.score.b ? `Gana ${currentMatch.teamA.name} ` : (currentMatch.score.b > currentMatch.score.a ? `Gana ${currentMatch.teamB.name} ` : "Empate");
            voiceReferee.speak(`${currentMatch.score.a} a ${currentMatch.score.b}. ${leading} `);
        }

        if (command === 'start_match') await changeMatchStatus('live');
        if (command === 'halftime') await changeMatchStatus('halftime');
        if (command === 'finish_match') await changeMatchStatus('finished');

        if (command === 'substitution') {
            const numIn = dorsal;
            const numOut = dorsal2;

            if (!numIn || !numOut) {
                voiceReferee.speak("Indique números. Ejemplo: Entra 8 sale 10");
                return;
            }

            const pOutA = (currentMatch.playersA || []).find((p: any) => p.number == numOut);
            const pOutB = (currentMatch.playersB || []).find((p: any) => p.number == numOut);

            let teamSide = null;
            let playerOutName = '';
            let playerInName = '';

            if (pOutA) {
                teamSide = 'A';
                playerOutName = pOutA.name;
                const pIn = (currentMatch.playersA || []).find((p: any) => p.number == numIn);
                playerInName = pIn ? pIn.name : `Dorsal ${numIn} `;
            } else if (pOutB) {
                teamSide = 'B';
                playerOutName = pOutB.name;
                const pIn = (currentMatch.playersB || []).find((p: any) => p.number == numIn);
                playerInName = pIn ? pIn.name : `Dorsal ${numIn} `;
            } else {
                voiceReferee.speak(`No encuentro al jugador número ${numOut} `);
                return;
            }

            await handleSubstitution(teamSide!, playerInName, playerOutName);
        }

        if (command === 'undo') {
            voiceReferee.speak("Función deshacer no disponible por seguridad.");
        }
    };

    /**
     * Envía la planilla oficial a la API externa
     */
    const submitMatchReport = async () => {
        if (!match) return;

        const partidoId = reportData.partido_id_manual
            ? parseInt(reportData.partido_id_manual)
            : (match.partido_id || match.realId || 0);

        if (!partidoId && !reportData.partido_id_manual) {
            alert("Por favor ingrese el ID numérico del partido.");
            return;
        }

        setIsSubmittingReport(true);

        const formatPlayers = (players: any[]) => {
            return (players || []).map(p => {
                let jleid = p.jleid;
                if (!jleid && p.dni && allUsers) {
                    const found = allUsers.find((u: any) => u.dni === p.dni);
                    if (found && found.jleid) jleid = found.jleid;
                }

                // Si no hay jleid todavía, usamos el DNI como fallback numérico (el API requiere int)
                const finalJleid = jleid ? parseInt(jleid.toString()) : (p.dni ? parseInt(p.dni.toString()) : 0);

                const jugoValue = (p.jugo === 1 || p.status === 'titular' || p.status === 'suplente_entro' || !!p.redCard) ? 1 : 0;

                const rawCamiseta = p.number ?? p.camiseta ?? p.dorsal;
                const finalCamiseta = (rawCamiseta !== undefined && rawCamiseta !== null) ? parseInt(rawCamiseta.toString()) : null;

                return {
                    jleid: finalJleid,
                    camiseta: finalCamiseta,
                    gf: parseInt(p.goals) || 0,
                    gc: 0, // Goles en contra individualmente no se computan aquí usualmente
                    amarilla: (p.yellowCards || 0) === 1 ? 1 : 0,
                    dobleamarilla: (p.yellowCards || 0) >= 2 ? 1 : 0,
                    roja: !!p.redCard ? 1 : 0,
                    jugo: jugoValue
                };
            });
        };

        const payload = {
            partido_id: partidoId,
            res_local: match.score.a,
            res_local_p: reportData.res_local_p || 0,
            res_visitante: match.score.b,
            res_visitante_p: reportData.res_visitante_p || 0,
            arbitro1: reportData.arbitro1 || "",
            arbitro2: reportData.arbitro2 || "",
            arbitro3: reportData.arbitro3 || "",
            informearbitro: reportData.informearbitro || "",
            equipo_local: formatPlayers(match.playersA || []),
            equipo_visitante: formatPlayers(match.playersB || [])
        };

        try {
            const response = await submitADCCMatchReport(payload);

            if (response.ok) {
                // Planilla enviada con éxito
                alert("✅ Planilla enviada con éxito a ADCC.");
                setShowReportModal(false);
            } else {
                // Error API
                const errorMsg = typeof response.errors === 'object'
                    ? JSON.stringify(response.errors)
                    : (response.errors || response.error || "Error desconocido");
                alert(`❌ Error al enviar la planilla: ${errorMsg}`);
            }
        } catch (error) {
            // Error de conexión
            alert("❌ Error de conexión con el servidor de la liga.");
        } finally {
            setIsSubmittingReport(false);
        }
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

    const removeEvent = async (eventId: string) => {
        if (!match) return;
        if (!window.confirm("¿Eliminar este evento?")) return;
        const updatedEvents = (match.events || []).filter((e: any) => e.id !== eventId);
        await updateMatch(id!, { events: updatedEvents });
    };

    const removePlayer = async (playerIndex: number, teamType: string) => {
        if (!match) return;
        const playerKey = teamType === 'A' ? 'playersA' : 'playersB';
        const currentPlayers = [...(match[playerKey] || [])];
        const player = currentPlayers[playerIndex];

        if (!player) return;

        if (player.status === 'suplente') {
            if (window.confirm(`¿Deseas volver a poner a ${player.name} como Titular ? `)) {
                currentPlayers[playerIndex].status = 'titular';
            } else if (window.confirm(`¿Deseas ELIMINAR definitivamente a ${player.name} de este partido ? `)) {
                currentPlayers.splice(playerIndex, 1);
            } else {
                return;
            }
        } else {
            if (window.confirm(`¿Mover a ${player.name} a SUPLENTES ? `)) {
                currentPlayers[playerIndex].status = 'suplente';
            } else {
                return;
            }
        }

        await updateMatch(id!, { [playerKey]: currentPlayers });
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

    const handleOpenQuickRegister = () => {
        setQuickRegisterData({
            name: '',
            dni: '',
            team: targetTeamName,
            category: match.category || 'Principal'
        });
        setShowQuickRegister(true);
    };

    // ============================================================================
    // 5. RENDER UI
    // ============================================================================

    return (
        <div className="animate-fade-in">
            {/* Header Volver */}
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                <button onClick={() => navigate(-1)} className="glass-button">
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Scoreboard Card */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', position: 'relative' }}>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-6 relative z-10">
                            {/* Match Identifier */}
                            {(isAdminOrDev || isReferee) && (
                                <span className="text-[10px] sm:text-xs font-black bg-primary text-slate-900 px-2 py-1 rounded tracking-tighter shadow-lg shadow-primary/20">
                                    ID: #{match.id.slice(-6).toUpperCase()}
                                </span>
                            )}

                            {/* Status Badge */}
                            {match.status === 'live' ? (
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <div className="status-chip active" style={{ cursor: 'default' }}>
                                        <Activity size={12} className="animate-pulse" />
                                        EN VIVO
                                    </div>
                                    <div className="status-chip" onClick={() => handleStatusUpdate('halftime')} style={{ cursor: 'pointer' }}>
                                        ENTRETIEMPO
                                    </div>
                                    <div className="status-chip danger" onClick={() => handleStatusUpdate('finished')} style={{ cursor: 'pointer' }}>
                                        FINALIZADO
                                    </div>
                                </div>
                            ) : (
                                <div className="status-chip active"
                                    style={{ cursor: (isAdminOrDev || isReferee) ? 'pointer' : 'default' }}
                                    onClick={() => (isAdminOrDev || isReferee) && match.status === 'scheduled' && handleStatusUpdate('live')}>
                                    {match.status === 'live' && <Activity size={12} className="animate-pulse" />}
                                    {match.status === 'scheduled' ? 'INICIAR PARTIDO' :
                                        match.status === 'live' ? 'EN VIVO' :
                                            match.status === 'halftime' ? 'ENTRETIEMPO' :
                                                match.status === 'finished' ? 'FINALIZADO' : match.status.toUpperCase()}
                                </div>
                            )}
                        </div>

                        <div className="scoreboard-grid">
                            {/* Team Local */}
                            <div className="scoreboard-team">
                                <div className="team-logo-large">
                                    {(() => {
                                        const teamData = teamsMetadata.find(t => t.name === match.teamA.name);
                                        const logoUrl = teamData?.logoUrl || getAdccImageUrl(match.teamA.logo);
                                        return logoUrl ? (
                                            <img src={logoUrl} alt="Logo Local" onError={(e) => (e.currentTarget.src = 'https://placehold.co/128x128?text=Team')} />
                                        ) : (
                                            <Shield size={40} opacity={0.2} />
                                        );
                                    })()}
                                </div>
                                <h2 className="team-name-large">{match.teamA.name}</h2>
                                <span className="team-label">Local</span>

                                {/* Goles y Tarjetas Local (Summary) */}
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                    {(match.events || []).filter(e => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                        <div key={e.id} style={{ fontSize: '0.9rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{e.time}</span>
                                            <span>{e.player}</span>
                                            {e.type === 'goal' && <Activity size={10} color="#10b981" />}
                                            {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" color="#fbbf24" />}
                                            {e.type === 'red_card' && <Square size={10} fill="#ef4444" color="#ef4444" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Result */}
                            <div className="scoreboard-result">
                                <div className="flex items-center justify-center gap-2 sm:gap-6">
                                    {isAdminOrDev || isReferee ? (
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleScoreChange('a', 1)}
                                                className="score-control-premium plus"
                                                aria-label="Sumar gol local"
                                            >
                                                <Plus size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleScoreChange('a', -1)}
                                                className="score-control-premium minus"
                                                aria-label="Restar gol local"
                                            >
                                                <Minus size={16} />
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="score-display-premium min-w-[120px] sm:min-w-[180px]">
                                        <span>{match.score.a}</span>
                                        <span className="score-divider mx-2 sm:mx-4">:</span>
                                        <span>{match.score.b}</span>
                                    </div>

                                    {isAdminOrDev || isReferee ? (
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleScoreChange('b', 1)}
                                                className="score-control-premium plus"
                                                aria-label="Sumar gol visitante"
                                            >
                                                <Plus size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleScoreChange('b', -1)}
                                                className="score-control-premium minus"
                                                aria-label="Restar gol visitante"
                                            >
                                                <Minus size={16} />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                                {match.status === 'live' && (
                                    <div className="live-badge" style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px 20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <div className="pulse-dot"></div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '800' }}>EN VIVO</span>
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
                                    {match.liveStartTime && match.status === 'live' && (
                                        <span style={{ marginLeft: '10px', color: '#10b981' }}>
                                            (Inicio Real: {new Date(match.liveStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Team Visitor */}
                            <div className="scoreboard-team">
                                <div className="team-logo-large">
                                    {(() => {
                                        const teamData = teamsMetadata.find(t => t.name === match.teamB.name);
                                        const logoUrl = teamData?.logoUrl || getAdccImageUrl(match.teamB.logo);
                                        return logoUrl ? (
                                            <img src={logoUrl} alt="Logo Visitante" onError={(e) => (e.currentTarget.src = 'https://placehold.co/128x128?text=Team')} />
                                        ) : (
                                            <Shield size={40} opacity={0.2} />
                                        );
                                    })()}
                                </div>
                                <h2 className="team-name-large">{match.teamB.name}</h2>
                                <span className="team-label">Visitante</span>

                                {/* Goles y Tarjetas Visitante (Summary) */}
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                    {(match.events || []).filter(e => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                        <div key={e.id} style={{ fontSize: '0.9rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{e.time}</span>
                                            <span>{e.player}</span>
                                            {e.type === 'goal' && <Activity size={10} color="#10b981" />}
                                            {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" color="#fbbf24" />}
                                            {e.type === 'red_card' && <Square size={10} fill="#ef4444" color="#ef4444" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {isAdminOrDev && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', padding: '0 20px' }}>
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="glass-button w-full sm:w-auto"
                            style={{
                                background: 'rgba(52, 211, 153, 0.1)',
                                color: '#34d399',
                                padding: '12px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                fontSize: '0.9rem',
                                fontWeight: 'bold'
                            }}
                        >
                            <Save size={18} /> CARGAR PLANILLA OFICIAL
                        </button>
                    </div>
                )}

                {/* Tabs Selector */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '25px', padding: '0 10px' }}>
                    <TabButton active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} icon={<TrendingUp size={18} />} label="Incidencias" />
                    <TabButton active={activeTab === 'planteles'} onClick={() => setActiveTab('planteles')} icon={<Users size={18} />} label="Planteles" />
                    <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Award size={18} />} label="Estadísticas" />
                </div>

                {/* Tab Content: Planteles */}
                {
                    activeTab === 'planteles' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
                            gap: '20px'
                        }}>
                            <SquadColumn
                                title={match.teamA.name}
                                logoUrl={teamsMetadata.find(t => t.name === match.teamA.name)?.logoUrl || getAdccImageUrl(match.teamA.logo)}
                                players={match.playersA || []}
                                teamType="A"
                                onAdd={() => setShowAddPlayer('A')}
                                onSubstitution={() => handleSubstitution('A')}
                                onUpdate={(idx: number, field: string, val: any) => handleUpdatePlayer(idx, 'A', field, val)}
                                onRemove={(idx: number) => removePlayer(idx, 'A')}
                                isReferee={isReferee}
                                userRole={userRole}
                                onPlayerClick={(idx, p) => setSelectedPlayer({ index: idx, teamSide: 'A', player: p })}
                            />
                            <SquadColumn
                                title={match.teamB.name}
                                logoUrl={teamsMetadata.find(t => t.name === match.teamB.name)?.logoUrl || getAdccImageUrl(match.teamB.logo)}
                                players={match.playersB || []}
                                teamType="B"
                                onAdd={() => setShowAddPlayer('B')}
                                onSubstitution={() => handleSubstitution('B')}
                                onUpdate={(idx: number, field: string, val: any) => handleUpdatePlayer(idx, 'B', field, val)}
                                onRemove={(idx: number) => removePlayer(idx, 'B')}
                                isReferee={isReferee}
                                userRole={userRole}
                                onPlayerClick={(idx, p) => setSelectedPlayer({ index: idx, teamSide: 'B', player: p })}
                            />
                        </div>
                    )
                }

                {
                    activeTab === 'stats' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="glass-panel" style={{ padding: '30px' }}>
                                <h3 style={{ margin: '0 0 25px 0', textAlign: 'center', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7 }}>
                                    <Zap size={18} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                                    Comparativa de Rendimiento
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                    <StatBar
                                        label="Goles"
                                        a={match.score.a}
                                        b={match.score.b}
                                        icon={<Target size={14} />}
                                    />
                                    <StatBar
                                        label="Tarjetas Amarillas"
                                        a={(match.events || []).filter(e => e.teamSide === 'A' && e.type === 'yellow_card').length}
                                        b={(match.events || []).filter(e => e.teamSide === 'B' && e.type === 'yellow_card').length}
                                        icon={<Square size={14} fill="#fbbf24" color="#fbbf24" />}
                                        color="#fbbf24"
                                    />
                                    <StatBar
                                        label="Tarjetas Rojas"
                                        a={(match.events || []).filter(e => e.teamSide === 'A' && e.type === 'red_card').length}
                                        b={(match.events || []).filter(e => e.teamSide === 'B' && e.type === 'red_card').length}
                                        icon={<Square size={14} fill="#ef4444" color="#ef4444" />}
                                        color="#ef4444"
                                    />
                                    <StatBar
                                        label="Total Jugadores"
                                        a={(match.playersA || []).length}
                                        b={(match.playersB || []).length}
                                        icon={<Users size={14} />}
                                    />
                                    <StatBar
                                        label="Expulsados"
                                        a={(match.playersA || []).filter(p => p.status === 'expulsado').length}
                                        b={(match.playersB || []).filter(p => p.status === 'expulsado').length}
                                        icon={<ShieldAlert size={14} />}
                                        color="#ef4444"
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'eventos' && (
                        <div className="animate-fade-in glass-panel" style={{ padding: '30px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>Cronología Dinámica</h3>
                                <div style={{ height: '2px', width: '50px', background: 'var(--primary)', margin: '10px auto' }}></div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                {/* Central Line */}
                                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.05)', display: window.innerWidth > 768 ? 'block' : 'none' }} />

                                {(match.events || []).length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay incidencias registradas.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                        {[...(match.events || [])].reverse().map((event) => {
                                            const isLocal = event.teamSide === 'A' || !event.teamSide;
                                            const iconColor = event.type === 'goal' ? '#10b981' : (event.type === 'red_card' ? '#ef4444' : (event.type === 'yellow_card' ? '#fbbf24' : '#3b82f6'));

                                            return (
                                                <div key={event.id} style={{
                                                    display: 'flex',
                                                    justifyContent: window.innerWidth > 768 ? (isLocal ? 'flex-end' : 'flex-start') : 'flex-start',
                                                    alignItems: 'center',
                                                    paddingRight: window.innerWidth > 768 ? (isLocal ? '55%' : '0') : '0',
                                                    paddingLeft: window.innerWidth > 768 ? (isLocal ? '0' : '55%') : '40px',
                                                    position: 'relative'
                                                }}>
                                                    {/* Desktop Circle in middle */}
                                                    {window.innerWidth > 768 && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#1a1a1a',
                                                            border: `2px solid ${iconColor} `,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            zIndex: 2,
                                                            boxShadow: `0 0 10px ${iconColor} 44`
                                                        }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{event.time}'</span>
                                                        </div>
                                                    )}

                                                    {/* Mobile Circle in side */}
                                                    {window.innerWidth <= 768 && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: 0,
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#1a1a1a',
                                                            border: `2px solid ${iconColor} `,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            zIndex: 2,
                                                        }}>
                                                            <span style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>{event.time}'</span>
                                                        </div>
                                                    )}

                                                    <div className="glass-panel" style={{
                                                        width: '100%',
                                                        padding: '15px 20px',
                                                        background: isLocal ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.02)',
                                                        border: isLocal ? '1px solid rgba(59, 130, 246, 0.1)' : '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '15px',
                                                        position: 'relative'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                                <div style={{
                                                                    width: '36px', height: '36px', borderRadius: '10px',
                                                                    background: `${iconColor} 22`,
                                                                    color: iconColor,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    {event.type === 'goal' && <Target size={20} />}
                                                                    {event.type === 'assist' && <Star size={20} />}
                                                                    {event.type === 'yellow_card' && <Square size={20} fill="#fbbf24" color="#fbbf24" style={{ borderRadius: '2px' }} />}
                                                                    {event.type === 'red_card' && <Square size={20} fill="#ef4444" color="#ef4444" style={{ borderRadius: '2px' }} />}
                                                                    {event.type === 'substitution' && <Repeat2 size={20} />}
                                                                    {(event.type === 'match_start' || event.type === 'halftime' || event.type === 'finish') && <Info size={20} />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                        {event.type === 'goal' && '¡GOL!'}
                                                                        {event.type === 'assist' && 'Asistencia'}
                                                                        {event.type === 'yellow_card' && 'Amonestación'}
                                                                        {event.type === 'red_card' && 'Expulsión'}
                                                                        {event.type === 'substitution' && 'Cambio'}
                                                                        {event.type === 'match_start' && 'Inicio'}
                                                                        {event.type === 'halftime' && 'Pausa'}
                                                                        {event.type === 'finish' && 'Final'}
                                                                    </div>
                                                                    <div style={{ fontSize: '1.1rem', color: '#fff' }}>
                                                                        {event.type === 'substitution' ? (
                                                                            <div style={{ fontSize: '0.95rem' }}>
                                                                                <span style={{ color: '#ef4444' }}>⬇ {event.playerOut}</span>
                                                                                <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                                                                <span style={{ color: '#10b981' }}>⬆ {event.playerIn}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span style={{ fontWeight: '500' }}>{event.player || event.detail}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isAdminOrDev && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }}
                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.4, cursor: 'pointer' }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Agregar Jugador - {targetTeamName}</h3>
                                        <button
                                            onClick={handleOpenQuickRegister}
                                            className="glass-button"
                                            style={{ padding: '6px 12px', fontSize: '0.9rem', background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.2)' }}
                                        >
                                            + NUEVO REGISTRO BIOMÉTRICO
                                        </button>
                                    </div>
                                    <input
                                        autoFocus
                                        className="premium-input"
                                        placeholder="Buscar por nombre o DNI..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ marginBottom: '15px' }}
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
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>DNI: {user.dni}</div>
                                            </div>
                                            <Plus size={18} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }
                {showQuickRegister && (
                    <QuickRegisterModal
                        data={quickRegisterData}
                        onClose={() => setShowQuickRegister(false)}
                    />
                )}

                {/* Modal de Carga de Planilla Oficial */}
                {showReportModal && (
                    <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
                        <div className="glass-panel" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '40px', border: '1px solid var(--primary)', position: 'relative' }}>
                            <button onClick={() => setShowReportModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={30} /></button>

                            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '10px' }}>CARGA DE PLANILLA OFICIAL</h2>
                                <p style={{ opacity: 0.6 }}>Complete los datos requeridos para la base de datos de ADCC</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>ID DE PARTIDO (Debe ser numérico)</label>
                                    <input
                                        type="number"
                                        className="premium-input w-full"
                                        placeholder="Ej: 1234"
                                        value={reportData.partido_id_manual}
                                        onChange={(e) => setReportData({ ...reportData, partido_id_manual: e.target.value })}
                                    />
                                    {!(match?.partido_id || match?.realId) && !reportData.partido_id_manual && (
                                        <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>Campo obligatorio. Consulte en la web oficial.</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>SITUACIÓN ESPECIAL</label>
                                    <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>Los goles y tarjetas se toman automáticamente de lo cargado en vivo.</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>ÁRBITRO 1</label>
                                    <input
                                        type="text"
                                        className="premium-input w-full"
                                        placeholder="Nombre"
                                        value={reportData.arbitro1}
                                        onChange={(e) => setReportData({ ...reportData, arbitro1: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>ÁRBITRO 2</label>
                                    <input
                                        type="text"
                                        className="premium-input w-full"
                                        placeholder="Nombre"
                                        value={reportData.arbitro2}
                                        onChange={(e) => setReportData({ ...reportData, arbitro2: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>ÁRBITRO 3</label>
                                    <input
                                        type="text"
                                        className="premium-input w-full"
                                        placeholder="Nombre"
                                        value={reportData.arbitro3}
                                        onChange={(e) => setReportData({ ...reportData, arbitro3: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '30px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>INFORME DEL ÁRBITRO</label>
                                <textarea
                                    className="premium-input w-full"
                                    rows={4}
                                    placeholder="Describa incidencias, expulsiones o cualquier detalle relevante del encuentro..."
                                    style={{ resize: 'none' }}
                                    value={reportData.informearbitro}
                                    onChange={(e) => setReportData({ ...reportData, informearbitro: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px' }}>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center' }}>DEFINICIÓN POR PENALES</h4>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <label style={{ fontSize: '0.6rem', display: 'block' }}>LOCAL</label>
                                            <input
                                                type="number"
                                                className="premium-input"
                                                style={{ width: '60px', textAlign: 'center' }}
                                                value={reportData.res_local_p || ''}
                                                onChange={(e) => setReportData({ ...reportData, res_local_p: e.target.value ? parseInt(e.target.value) : null })}
                                            />
                                        </div>
                                        <span style={{ fontWeight: 'bold' }}>-</span>
                                        <div style={{ textAlign: 'center' }}>
                                            <label style={{ fontSize: '0.6rem', display: 'block' }}>VISITANTE</label>
                                            <input
                                                type="number"
                                                className="premium-input"
                                                style={{ width: '60px', textAlign: 'center' }}
                                                value={reportData.res_visitante_p || ''}
                                                onChange={(e) => setReportData({ ...reportData, res_visitante_p: e.target.value ? parseInt(e.target.value) : null })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ background: 'rgba(0, 135, 81, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0, 135, 81, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '5px' }}>
                                            <ShieldAlert size={18} />
                                            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>RESUMEN ACTUAL</span>
                                        </div>
                                        <p style={{ fontSize: '1.2rem', margin: 0, fontWeight: '900' }}>
                                            {match?.teamA.name} {match?.score.a} - {match?.score.b} {match?.teamB.name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="glass-button w-full"
                                    style={{ padding: '15px' }}
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={submitMatchReport}
                                    disabled={isSubmittingReport}
                                    className="glass-button w-full"
                                    style={{
                                        padding: '15px',
                                        background: 'var(--primary)',
                                        color: 'black',
                                        fontWeight: '900',
                                        boxShadow: '0 0 20px var(--primary-glow)'
                                    }}
                                >
                                    {isSubmittingReport ? 'ENVIANDO A ADCC...' : 'CONFIRMAR Y ENVIAR PLANILLA'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DE ACCIONES DE JUGADOR */}
                {selectedPlayer && (
                    <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 11000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
                        <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '30px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={() => setSelectedPlayer(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}><X size={24} /></button>

                            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', margin: '0 auto 15px', border: '2px solid var(--primary)' }}>
                                    <img src={selectedPlayer.player.photo || 'https://via.placeholder.com/80'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <h3 style={{ margin: '0 0 5px', fontSize: '1.4rem' }}>{selectedPlayer.player.name}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>N° {selectedPlayer.player.number} | {selectedPlayer.player.status === 'titular' ? 'Titular' : 'Suplente'}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'goals', (parseInt(selectedPlayer.player.goals) || 0) + 1);
                                        handleScoreChange(selectedPlayer.teamSide, 1);
                                        setSelectedPlayer(null);
                                    }}
                                    className="glass-button w-full"
                                    style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                >
                                    <Target size={24} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>ANOTAR GOL</span>
                                </button>

                                <button
                                    onClick={() => {
                                        handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'yellowCards', (parseInt(selectedPlayer.player.yellowCards) || 0) + 1);
                                        setSelectedPlayer(null);
                                    }}
                                    className="glass-button w-full"
                                    style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.2)' }}
                                >
                                    <Square size={24} fill="#fbbf24" strokeWidth={0} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>AMARILLA</span>
                                </button>

                                <button
                                    onClick={() => {
                                        handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'redCard', true);
                                        setSelectedPlayer(null);
                                    }}
                                    className="glass-button w-full"
                                    style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                >
                                    <Square size={24} fill="#ef4444" strokeWidth={0} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>ROJA DIRECTA</span>
                                </button>

                                <button
                                    onClick={() => {
                                        const newStatus = selectedPlayer.player.status === 'titular' ? 'suplente' : 'titular';
                                        handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'status', newStatus);
                                        setSelectedPlayer(null);
                                    }}
                                    className="glass-button w-full"
                                    style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                >
                                    <Repeat2 size={24} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{selectedPlayer.player.status === 'titular' ? 'A LA BANCA' : 'A TITULAR'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
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
        {icon} <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>{label}</span>
    </button>
);

interface SquadColumnProps {
    title: string;
    logoUrl?: string;
    players: any[];
    teamType: string;
    onAdd: () => void;
    onSubstitution: (team: string) => void;
    onUpdate: (idx: number, field: string, value: any) => void;
    onRemove: (idx: number) => void;
    isReferee: boolean;
    userRole: string;
    onPlayerClick: (idx: number, player: any) => void;
}

const SquadColumn = ({ title, logoUrl, players, teamType, onAdd, onSubstitution, onUpdate, onRemove, isReferee, userRole, onPlayerClick }: SquadColumnProps) => {
    const isAdmin = userRole === 'admin' || userRole === 'dev';
    const canManageMatch = isAdmin || userRole === 'referee';
    const isUsuario = userRole === 'usuario';

    return (
        <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                padding: '20px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '10px',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '45px', height: '45px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--glass-border-light)' }}>
                        {logoUrl ? <img src={logoUrl} alt="L" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : <Users size={20} color="var(--primary)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                            margin: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            fontSize: '1.1rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={title}>{title}</h4>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Plantel: {players.length} jugadores</div>
                    </div>
                </div>
                {canManageMatch && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => onSubstitution(teamType)} className="glass-button" style={{ fontSize: '0.8rem', padding: '5px 8px', background: 'rgba(59, 130, 246, 0.1)' }}>
                            <Repeat2 size={12} /> <span className="hide-mobile">CAMBIO</span>
                        </button>
                        {isAdmin && (
                            <button onClick={onAdd} className="glass-button" style={{ width: '30px', height: '30px', padding: 0, borderRadius: '50%', fontSize: '0.8rem' }}>
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div style={{ padding: '10px' }}>
                {players.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '1rem' }}>Sin jugadores asignados</div>
                ) : (
                    players.map((p: any, idx: number) => (
                        <div key={idx}
                            onClick={() => canManageMatch && onPlayerClick(idx, p)}
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                padding: '12px',
                                gap: '12px',
                                borderRadius: '10px',
                                marginBottom: '4px',
                                background: p.isDisabled ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
                                borderLeft: p.isDisabled ? '4px solid #ef4444' : '4px solid transparent',
                                transition: 'all 0.2s ease',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: canManageMatch ? 'pointer' : 'default'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px' }}>
                                <div style={{ width: '25px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>
                                    <input
                                        type="number"
                                        value={p.number}
                                        onChange={(e) => onUpdate(idx, 'number', e.target.value)}
                                        style={{ background: 'none', border: 'none', color: 'inherit', width: '100%', textAlign: 'center', fontWeight: 'bold' }}
                                        disabled={!isAdmin}
                                    />
                                </div>
                                <div style={{ minWidth: '40px', width: '40px', height: '40px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', border: p.isDisabled ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }}>
                                    <img src={p.photo || 'https://via.placeholder.com/40'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ flex: 1, opacity: p.status === 'suplente' ? 0.5 : 1 }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: p.isDisabled ? '#fca5a5' : (p.status === 'expulsado' ? '#ef4444' : 'white'), lineHeight: '1.2' }}>
                                        {p.name}
                                        {p.isDisabled && <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '900', marginLeft: '5px' }}>⚠️</span>}
                                        {p.status === 'expulsado' && <span style={{ fontSize: '0.8rem', background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: '4px', marginLeft: '5px' }}>ROJA</span>}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {p.status === 'titular' ? (p.isDisabled ? 'Inhabilitado' : 'Titular') : (p.status === 'suplente' ? 'Suplente' : 'Expulsado')}
                                    </div>
                                </div>
                            </div>

                            {canManageMatch && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(251, 191, 36, 0.12)', borderRadius: '6px', padding: '1px' }}>
                                            <button onClick={() => onUpdate(idx, 'yellowCards', Math.max(0, (parseInt(p.yellowCards) || 0) - 1))} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}><Minus size={14} /></button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 5px' }}>
                                                <div style={{ width: '10px', height: '14px', background: '#fbbf24', borderRadius: '1.5px', boxShadow: '0 0 5px rgba(251, 191, 36, 0.5)' }}></div>
                                                <span style={{ fontSize: '1rem', color: '#fbbf24', fontWeight: 'bold' }}>{p.yellowCards || 0}</span>
                                            </div>
                                            <button onClick={() => onUpdate(idx, 'yellowCards', (parseInt(p.yellowCards) || 0) + 1)} disabled={p.status === 'expulsado' || p.isDisabled} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', opacity: p.status === 'expulsado' || p.isDisabled ? 0.3 : 1 }}><Plus size={14} /></button>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '6px', padding: '1px' }}>
                                            <button onClick={() => onUpdate(idx, 'redCard', false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}><Minus size={14} /></button>
                                            <div style={{ padding: '0 5px', display: 'flex', alignItems: 'center' }}>
                                                <div style={{ width: '10px', height: '14px', background: p.redCard ? "#ef4444" : "rgba(239, 68, 68, 0.1)", borderRadius: '1.5px', boxShadow: p.redCard ? '0 0 5px rgba(239, 68, 68, 0.5)' : 'none' }}></div>
                                            </div>
                                            <button onClick={() => onUpdate(idx, 'redCard', true)} disabled={p.status === 'expulsado' || p.isDisabled} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', opacity: p.status === 'expulsado' || p.isDisabled ? 0.3 : 1 }}><Plus size={14} /></button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button
                                                onClick={() => onUpdate(idx, 'goals', Math.max(0, (parseInt(p.goals) || 0) - 1))}
                                                disabled={(parseInt(p.goals) || 0) <= 0}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: (parseInt(p.goals) || 0) <= 0 ? 0.4 : 1 }}
                                                title="Restar Gol"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <div style={{ minWidth: '50px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap', padding: '0 4px' }}>
                                                {p.goals || 0} <span style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.5px' }}>GOLES</span>
                                            </div>
                                            <button
                                                onClick={() => onUpdate(idx, 'goals', (parseInt(p.goals) || 0) + 1)}
                                                disabled={p.status === 'suplente' || p.status === 'expulsado' || p.isDisabled}
                                                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: p.status === 'suplente' || p.status === 'expulsado' || p.isDisabled ? 0.3 : 1 }}
                                                title="Sumar Gol"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <button
                                            onClick={() => onRemove(idx)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: p.status === 'suplente' ? 'var(--primary)' : 'var(--error)',
                                                opacity: 0.5,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {p.status === 'suplente' ? <Plus size={14} /> : <Trash2 size={14} />}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const StatBar = ({ label, a, b, icon, color = 'var(--primary)' }: { label: string, a: number, b: number, icon: React.ReactNode, color?: string }) => {
    const total = (a + b) || 1;
    const pctA = (a / total) * 100;

    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1rem', fontWeight: 'bold' }}>
                <div style={{ color: a > b ? color : 'var(--text-muted)' }}>{a}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.6 }}>
                    {icon} <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>{label}</span>
                </div>
                <div style={{ color: b > a ? color : 'var(--text-muted)' }}>{b}</div>
            </div>
            <div style={{ height: '6px', display: 'flex', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${pctA}%`, background: a > 0 ? (a >= b ? color : 'rgba(255,255,255,0.1)') : 'transparent', transition: 'width 1s ease' }}></div>
                <div style={{ flex: 1, background: b > 0 ? (b >= a ? color : 'rgba(255,255,255,0.1)') : 'transparent', transition: 'width 1s ease' }}></div>
            </div>
        </div>
    );
};

export default MatchDetail;
