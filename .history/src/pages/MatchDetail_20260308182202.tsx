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
import { Mic, MicOff, Users, Activity, BarChart2, Plus, ArrowLeft, Calendar, Clock, User as UserIcon, Trash2, Minus, Target, Zap, Star, Repeat2, Square, Info, ShieldAlert, Award, TrendingUp, Save, X, Shield, ShieldCheck } from 'lucide-react';
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
// SUB-COMPONENTS & INTERFACES
// ============================================================================

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button
        onClick={onClick}
        className={`match-tab-button ${active ? 'active' : ''}`}
    >
        <div className="tab-icon-wrapper">{icon}</div>
        <span className="tab-label-text">{label}</span>
        {active && <div className="tab-indicator" />}
    </button>
);

interface SquadColumnProps {
    title: string;
    logoUrl?: string;
    players: any[];
    teamSide: string; // 'A' or 'B'
    onAdd: () => void;
    onSubstitution: (team: string) => void;
    onUpdate: (idx: number, field: string, value: any) => void;
    onRemove: (idx: number) => void;
    isReferee: boolean;
    userRole: string;
    onPlayerClick: (idx: number, player: any) => void;
    onPhotoClick: (url: string, name: string) => void;
    matchEvents?: any[];
}

const SquadColumn = ({ title, logoUrl, players, teamSide, onAdd, onSubstitution, onUpdate, onRemove, isReferee, userRole, onPlayerClick, onPhotoClick, matchEvents = [] }: SquadColumnProps) => {
    const isAdmin = userRole === 'admin' || userRole === 'dev';
    const canManageMatch = isAdmin || userRole === 'referee';

    const getGoalTimes = (playerName: string) => {
        return (matchEvents || [])
            .filter(e => e.type === 'goal' && e.player === playerName && e.teamSide === teamSide)
            .map(e => e.time);
    };

    return (
        <div className="glass-panel overflow-hidden border border-white/10 flex flex-col h-full bg-white/5 backdrop-blur-md">
            {/* Squad Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://placehold.co/64x64?text=T')} />
                        ) : (
                            <Users size={20} className="text-primary" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-lg font-black text-white truncate uppercase tracking-tight leading-none mb-1">{title}</h4>
                        <div className="text-[0.65rem] font-bold text-white/40 uppercase tracking-[1px]">Plantel: {players.length} JUGADORES</div>
                    </div>
                </div>
                {canManageMatch && (
                    <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => onSubstitution(teamSide)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-all text-[0.7rem] font-black">
                            <Repeat2 size={12} /> <span className="hidden sm:inline">CAMBIO</span>
                        </button>
                        {isAdmin && (
                            <button onClick={onAdd} className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 flex items-center justify-center transition-all">
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Players List */}
            <div className="p-2 flex flex-col gap-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                {players.length === 0 ? (
                    <div className="py-12 text-center text-white/20 italic font-medium flex flex-col items-center gap-2">
                        <Users size={32} className="opacity-10" />
                        Sin jugadores asignados
                    </div>
                ) : (
                    players.map((p: any, idx: number) => {
                        const goalTimes = getGoalTimes(p.name);
                        return (
                            <div key={idx}
                                onClick={() => canManageMatch && onPlayerClick(idx, p)}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 ${p.isDisabled ? 'opacity-50 grayscale bg-red-500/5 border-red-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'} ${canManageMatch ? 'cursor-pointer' : ''}`}
                            >
                                {/* Player Number */}
                                <div className="w-10 h-10 flex-shrink-0 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-lg font-black text-primary shadow-inner">
                                    <input
                                        type="number"
                                        value={p.number}
                                        onChange={(e) => onUpdate(idx, 'number', e.target.value)}
                                        className="bg-transparent border-none text-center w-full focus:outline-none pointer-events-auto"
                                        disabled={!isAdmin}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>

                                {/* Player Photo */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPhotoClick(getAdccImageUrl(p.photo) || '', p.name);
                                    }}
                                    className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 relative group/photo"
                                >
                                    <img src={getAdccImageUrl(p.photo) || 'https://via.placeholder.com/80'} alt={p.name} className="w-full h-full object-cover transition-transform group-hover/photo:scale-110" />
                                    <div className="absolute inset-0 bg-primary/0 group-hover/photo:bg-primary/20 transition-colors flex items-center justify-center">
                                        <Plus size={12} className="text-white opacity-0 group-hover/photo:opacity-100" />
                                    </div>
                                </div>

                                {/* Player Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center flex-wrap gap-1">
                                        <div className={`font-bold truncate text-[0.95rem] ${p.status === 'expulsado' ? 'text-red-500' : 'text-white'} ${p.status === 'suplente' ? 'opacity-60' : ''}`}>
                                            {p.name}
                                        </div>
                                        {p.isDisabled && <span className="text-red-500 animate-pulse" title="Inhabilitado">⚠️</span>}
                                        {p.status === 'expulsado' && <span className="px-1.5 py-0.5 bg-red-500 text-[0.6rem] text-white rounded font-black uppercase tracking-[1px]">ROJA</span>}

                                        {/* Goal Times Badge */}
                                        {goalTimes.length > 0 && (
                                            <div className="flex gap-1">
                                                {goalTimes.map((gt, gidx) => (
                                                    <span key={gidx} className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-500/20 text-emerald-400 text-[0.6rem] font-bold rounded border border-emerald-500/30">
                                                        <Activity size={8} /> {gt}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-white/40">
                                        {p.status === 'titular' ? (p.isDisabled ? 'Inhabilitado' : 'Titular') : (p.status === 'suplente' ? 'Suplente' : 'Expulsado')}
                                    </div>
                                </div>

                                {/* Player Stats Indicators */}
                                <div className="flex items-center gap-2">
                                    {(parseInt(p.yellowCards) > 0) && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded-md">
                                            <div className="w-2 h-3 bg-amber-400 rounded-sm"></div>
                                            <span className="text-[0.7rem] font-black text-amber-400">{p.yellowCards}</span>
                                        </div>
                                    )}
                                    {p.redCard && (
                                        <div className="w-2.5 h-4 bg-red-500 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                    )}
                                    {(parseInt(p.goals) > 0) && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                                            <Target size={12} className="text-emerald-500" />
                                            <span className="text-[0.7rem] font-black text-emerald-500">{p.goals}</span>
                                        </div>
                                    )}

                                    {/* Remove button only for admins/referees if needed */}
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(idx);
                                            }}
                                            className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const StatBar = ({ label, a, b, icon, color = 'var(--primary)' }: { label: string, a: number, b: number, icon: React.ReactNode, color?: string }) => {
    const total = (a + b) || 1;
    const pctA = (a / total) * 100;

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-center px-1">
                <div className="text-lg font-black" style={{ color: a > b ? color : 'rgba(255,255,255,0.4)' }}>{a}</div>
                <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-widest opacity-60 font-bold">
                    {icon} <span>{label}</span>
                </div>
                <div className="text-lg font-black" style={{ color: b > a ? color : 'rgba(255,255,255,0.4)' }}>{b}</div>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{ width: `${pctA}%`, background: a > 0 ? (a >= b ? color : 'rgba(255,255,255,0.1)') : 'transparent' }}
                ></div>
                <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{ flex: 1, background: b > 0 ? (b >= a ? color : 'rgba(255,255,255,0.1)') : 'transparent' }}
                ></div>
            </div>
        </div>
    );
};

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
        res_visitante_p: null as number | null
    });

    // Estado para Modal de Acciones de Jugador
    const [selectedPlayer, setSelectedPlayer] = useState<{ index: number, teamSide: string, player: any } | null>(null);

    // Estado para Foto en Grande (Zoom)
    const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string, name: string } | null>(null);

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
            name: user.name || (user.nombre + ' ' + (user.apellido || '')).trim() || 'Sin Nombre',
            photo: user.photo || user.photoURL || (user.photos && user.photos[0]) || null,
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
                            const teamAUsers = allUsers.filter((u: any) => u && u.team === match.teamA?.name);
                            if (teamAUsers.length > 0) {
                                updates.playersA = teamAUsers.map((u: any, idx: number) => ({
                                    userId: u.id,
                                    name: u.name || (u.nombre + ' ' + (u.apellido || '')).trim() || 'Sin Nombre',
                                    photo: u.photo || u.photoURL || (u.photos && u.photos[0]) || null,
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
                            const teamBUsers = allUsers.filter((u: any) => u && u.team === match.teamB?.name);
                            if (teamBUsers.length > 0) {
                                updates.playersB = teamBUsers.map((u: any, idx: number) => ({
                                    userId: u.id,
                                    name: u.name || (u.nombre + ' ' + (u.apellido || '')).trim() || 'Sin Nombre',
                                    photo: u.photo || u.photoURL || (u.photos && u.photos[0]) || null,
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
                    team: teamType === 'A' ? targetMatch.teamA?.name : targetMatch.teamB?.name,
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
                    team: teamType === 'A' ? targetMatch.teamA?.name : targetMatch.teamB?.name,
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
                    team: teamType === 'A' ? targetMatch.teamA?.name : targetMatch.teamB?.name,
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
                    team: teamType === 'A' ? targetMatch.teamA?.name : targetMatch.teamB?.name,
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
            team: teamType === 'A' ? match.teamA?.name : match.teamB?.name,
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
            const leading = (currentMatch.score?.a ?? 0) > (currentMatch.score?.b ?? 0) ? `Gana ${currentMatch.teamA?.name} ` : ((currentMatch.score?.b ?? 0) > (currentMatch.score?.a ?? 0) ? `Gana ${currentMatch.teamB?.name} ` : "Empate");
            voiceReferee.speak(`${currentMatch.score?.a ?? 0} a ${currentMatch.score?.b ?? 0}. ${leading} `);
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

        const partidoId = (match.partido_id || match.realId || 0);
        const finalMatchId = typeof partidoId === 'string' ? parseInt(partidoId) : partidoId;

        if (!finalMatchId) {
            alert("Este partido no tiene un ID de ADCC válido para cargar la planilla. Por favor, verifique la importación.");
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
            partido_id: finalMatchId,
            res_local: match.score?.a ?? 0,
            res_local_p: reportData.res_local_p || 0,
            res_visitante: match.score?.b ?? 0,
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

    const targetTeamName = showAddPlayer === 'A' ? (match.teamA?.name ?? '') : (match.teamB?.name ?? '');
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
            <div className="glass-panel p-4 sm:p-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                        <div className="pulse-dot"></div>
                        <span className="font-extrabold text-[0.7rem] tracking-[2px] text-red-500 uppercase">EN VIVO</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
                        <Calendar size={14} className="text-primary" />
                        <span className="font-semibold text-[0.75rem] text-white/80">{match.date} {match.time} HS</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Equipo Local */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-4 overflow-hidden p-3 group">
                            {(() => {
                                const teamData = teamsMetadata.find(t => t.name === match.teamA?.name);
                                const logoUrl = teamData?.logoUrl || getAdccImageUrl(match.teamA?.logo);
                                return logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt="Logo Local"
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                        onError={(e) => (e.currentTarget.src = 'https://placehold.co/128x128?text=Team')}
                                    />
                                ) : (
                                    <Shield size={40} className="text-white/20" />
                                );
                            })()}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">{match.teamA?.name ?? 'Equipo Local'}</h2>
                        <span className="text-[0.65rem] uppercase tracking-widest text-primary font-bold opacity-60">Local</span>

                        <div className="mt-2.5 flex flex-col gap-1 items-center">
                            {(match.events || []).filter(e => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                <div key={e.id} className="text-[0.8rem] opacity-80 flex items-center gap-1.5">
                                    <span className="font-bold text-primary">{e.time}</span>
                                    <span className="text-white/90">{e.player}</span>
                                    {e.type === 'goal' && <Activity size={10} className="text-emerald-500" />}
                                    {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" className="text-amber-400" />}
                                    {e.type === 'red_card' && <Square size={10} fill="#ef4444" className="text-red-500" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Resultado Central */}
                    <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-3 sm:gap-6 mb-4">
                            {(isAdminOrDev || isReferee) ? (
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleScoreChange('a', 1)} className="score-control-premium plus"><Plus size={16} /></button>
                                    <button onClick={() => handleScoreChange('a', -1)} className="score-control-premium minus"><Minus size={16} /></button>
                                </div>
                            ) : null}

                            <div className="score-display-premium min-w-[120px] sm:min-w-[150px]">
                                <span>{match.score?.a ?? 0}</span>
                                <span className="score-divider mx-2">:</span>
                                <span>{match.score?.b ?? 0}</span>
                            </div>

                            {(isAdminOrDev || isReferee) ? (
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleScoreChange('b', 1)} className="score-control-premium plus"><Plus size={16} /></button>
                                    <button onClick={() => handleScoreChange('b', -1)} className="score-control-premium minus"><Minus size={16} /></button>
                                </div>
                            ) : null}
                        </div>

                        {match.status === 'live' && (
                            <div className="flex flex-col items-center gap-1 px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl animate-pulse">
                                <div className="flex items-center gap-2">
                                    <div className="pulse-dot"></div>
                                    <span className="text-[0.7rem] font-black text-red-500">TIEMPO CORRIENDO</span>
                                </div>
                                <div className="text-2xl font-black text-white tabular-nums tracking-tighter">
                                    {matchTime.min.toString().padStart(2, '0')}:{matchTime.sec.toString().padStart(2, '0')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Equipo Visitante */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-4 overflow-hidden p-3 group">
                            {(() => {
                                const teamData = teamsMetadata.find(t => t.name === match.teamB?.name);
                                const logoUrl = teamData?.logoUrl || getAdccImageUrl(match.teamB?.logo);
                                return logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt="Logo Visitante"
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                        onError={(e) => (e.currentTarget.src = 'https://placehold.co/128x128?text=Team')}
                                    />
                                ) : (
                                    <Shield size={40} className="text-white/20" />
                                );
                            })()}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">{match.teamB?.name ?? 'Equipo Visitante'}</h2>
                        <span className="text-[0.65rem] uppercase tracking-widest text-primary font-bold opacity-60">Visitante</span>

                        <div className="mt-2.5 flex flex-col gap-1 items-center">
                            {(match.events || []).filter(e => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                <div key={e.id} className="text-[0.8rem] opacity-80 flex items-center gap-1.5">
                                    <span className="font-bold text-primary">{e.time}</span>
                                    <span className="text-white/90">{e.player}</span>
                                    {e.type === 'goal' && <Activity size={10} className="text-emerald-500" />}
                                    {e.type === 'yellow_card' && <Square size={10} fill="#fbbf24" className="text-amber-400" />}
                                    {e.type === 'red_card' && <Square size={10} fill="#ef4444" className="text-red-500" />}
                                </div>
                            ))}
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
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6 sticky top-20 z-10 backdrop-blur-xl">
                <TabButton active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} icon={<TrendingUp size={18} />} label="Incidencias" />
                <TabButton active={activeTab === 'planteles'} onClick={() => setActiveTab('planteles')} icon={<Users size={18} />} label="Planteles" />
                <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Award size={18} />} label="Estadísticas" />
            </div>

            {/* Tab Content: Planteles */}
            {activeTab === 'planteles' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SquadColumn
                        title={match.teamA?.name ?? 'Equipo Local'}
                        logoUrl={teamsMetadata.find(t => t.name === match.teamA?.name)?.logoUrl || getAdccImageUrl(match.teamA?.logo)}
                        players={match.playersA || []}
                        teamSide="A"
                        onAdd={() => setShowAddPlayer('A')}
                        onSubstitution={() => handleSubstitution('A')}
                        onUpdate={(idx: number, field: string, val: any) => handleUpdatePlayer(idx, 'A', field, val)}
                        onRemove={(idx: number) => removePlayer(idx, 'A')}
                        isReferee={isReferee}
                        userRole={userRole}
                        onPlayerClick={(idx, p) => setSelectedPlayer({ index: idx, teamSide: 'A', player: p })}
                        onPhotoClick={(url, name) => setZoomedPhoto({ url, name })}
                        matchEvents={match.events || []}
                    />
                    <SquadColumn
                        title={match.teamB?.name ?? 'Equipo Visitante'}
                        logoUrl={teamsMetadata.find(t => t.name === match.teamB?.name)?.logoUrl || getAdccImageUrl(match.teamB?.logo)}
                        players={match.playersB || []}
                        teamSide="B"
                        onAdd={() => setShowAddPlayer('B')}
                        onSubstitution={() => handleSubstitution('B')}
                        onUpdate={(idx: number, field: string, val: any) => handleUpdatePlayer(idx, 'B', field, val)}
                        onRemove={(idx: number) => removePlayer(idx, 'B')}
                        isReferee={isReferee}
                        userRole={userRole}
                        onPlayerClick={(idx, p) => setSelectedPlayer({ index: idx, teamSide: 'B', player: p })}
                        onPhotoClick={(url, name) => setZoomedPhoto({ url, name })}
                        matchEvents={match.events || []}
                    />
                </div>
            )}

            {
                activeTab === 'stats' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="glass-panel p-6 sm:p-10 relative overflow-hidden group">
                            {/* Decorative elements for premium feel */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/10 transition-colors duration-700"></div>

                            <h3 className="flex items-center justify-center gap-2.5 mb-10 text-[0.85rem] uppercase tracking-[4px] text-white/80 font-black relative">
                                <Zap size={20} className="text-primary animate-pulse" />
                                Comparativa de Rendimiento
                            </h3>

                            <div className="flex flex-col gap-10 relative">
                                <StatBar
                                    label="Goles Totales"
                                    a={match.score?.a ?? 0}
                                    b={match.score?.b ?? 0}
                                    icon={<Target size={14} />}
                                    color="var(--primary)"
                                />
                                <StatBar
                                    label="Tarjetas Amarillas"
                                    a={(match.events || []).filter(e => e.teamSide === 'A' && e.type === 'yellow_card').length}
                                    b={(match.events || []).filter(e => e.teamSide === 'B' && e.type === 'yellow_card').length}
                                    icon={<Square size={14} fill="#fbbf24" className="text-amber-400" />}
                                    color="#fbbf24"
                                />
                                <StatBar
                                    label="Tarjetas Rojas"
                                    a={(match.events || []).filter(e => e.teamSide === 'A' && e.type === 'red_card').length}
                                    b={(match.events || []).filter(e => e.teamSide === 'B' && e.type === 'red_card').length}
                                    icon={<Square size={14} fill="#ef4444" className="text-red-500" />}
                                    color="#ef4444"
                                />
                                <StatBar
                                    label="Convocados"
                                    a={(match.playersA || []).length}
                                    b={(match.playersB || []).length}
                                    icon={<Users size={14} />}
                                    color="#60a5fa"
                                />
                                <StatBar
                                    label="Expulsiones Clínicas"
                                    a={(match.playersA || []).filter(p => p.status === 'expulsado').length}
                                    b={(match.playersB || []).filter(p => p.status === 'expulsado').length}
                                    icon={<ShieldAlert size={14} />}
                                    color="#f43f5e"
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            {activeTab === 'eventos' && (
                <div className="glass-panel p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col items-center mb-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <TrendingUp size={20} className="text-primary" />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Cronología Dinámica</h3>
                        </div>
                        <div className="h-1 w-12 bg-primary rounded-full"></div>
                    </div>

                    <div className="relative pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/50 before:via-primary/20 before:to-transparent">
                        {(match.events || []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-white/30 italic">
                                <Info size={32} className="mb-4 opacity-20" />
                                <p>No hay incidencias registradas.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {[...(match.events || [])].reverse().map((event, idx) => {
                                    const isLocal = event.teamSide === 'A' || !event.teamSide;
                                    const iconColor = event.type === 'goal' ? 'text-emerald-500' : (event.type === 'red_card' ? 'text-red-500' : (event.type === 'yellow_card' ? 'text-amber-400' : 'text-blue-400'));
                                    const bgColor = event.type === 'goal' ? 'bg-emerald-500/10' : (event.type === 'red_card' ? 'bg-red-500/10' : (event.type === 'yellow_card' ? 'bg-amber-400/10' : 'bg-blue-400/10'));
                                    const borderColor = event.type === 'goal' ? 'border-emerald-500/20' : (event.type === 'red_card' ? 'border-red-500/20' : (event.type === 'yellow_card' ? 'border-amber-400/20' : 'border-blue-400/20'));

                                    return (
                                        <div key={event.id || idx} className="relative group animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                            {/* Timeline Time Indicator */}
                                            <div className="absolute -left-[38px] top-2 w-7 h-5 rounded-full bg-dark-soft border border-primary/50 flex items-center justify-center z-10 shadow-lg">
                                                <span className="text-[0.6rem] font-bold text-white leading-none tabular-nums">{event.time}</span>
                                            </div>

                                            {/* Event Card */}
                                            <div className={`rounded-xl p-4 border transition-all duration-300 group-hover:translate-x-1 ${isLocal ? 'bg-primary/5 border-primary/10 group-hover:border-primary/30' : 'bg-white/2 border-white/5 group-hover:border-white/20'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`px-2 py-0.5 rounded-md ${bgColor} ${borderColor} border`}>
                                                            <span className={`text-[0.65rem] font-black uppercase tracking-wider ${iconColor}`}>
                                                                {event.type === 'goal' && '¡GOL!'}
                                                                {event.type === 'assist' && 'Asistencia'}
                                                                {event.type === 'yellow_card' && 'Amonestación'}
                                                                {event.type === 'red_card' && 'Expulsión'}
                                                                {event.type === 'substitution' && 'Cambio'}
                                                                {['match_start', 'halftime', 'finish'].includes(event.type) && 'Info'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">
                                                            {event.teamSide === 'A' ? (match.teamA?.name) : (match.teamB?.name)}
                                                        </span>
                                                    </div>
                                                    {isAdminOrDev && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }}
                                                            className="p-1.5 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor} ${iconColor}`}>
                                                        {event.type === 'goal' && <Target size={20} />}
                                                        {event.type === 'assist' && <Star size={20} />}
                                                        {event.type === 'yellow_card' && <Square size={18} fill="currentColor" className="rounded-[2px]" />}
                                                        {event.type === 'red_card' && <Square size={18} fill="currentColor" className="rounded-[2px]" />}
                                                        {event.type === 'substitution' && <Repeat2 size={20} />}
                                                        {['match_start', 'halftime', 'finish'].includes(event.type) && <Info size={20} />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        {event.type === 'substitution' ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-red-400 font-bold truncate">⬇ {event.playerOut}</span>
                                                                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                                                <span className="text-emerald-500 font-bold truncate">⬆ {event.playerIn}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-white font-black text-lg truncate">
                                                                {event.player || event.detail}
                                                            </div>
                                                        )}
                                                        {event.details && (
                                                            <div className="text-[0.8rem] text-white/50 italic truncate">
                                                                {event.details}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                            <img src={getAdccImageUrl(user.photos?.[0] || user.photo) || 'https://via.placeholder.com/40'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            {
                showQuickRegister && (
                    <QuickRegisterModal
                        data={quickRegisterData}
                        onClose={() => setShowQuickRegister(false)}
                    />
                )
            }

            {/* Modal de Carga de Planilla Oficial */}
            {
                showReportModal && (
                    <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
                        <div className="glass-panel" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '40px', border: '1px solid var(--primary)', position: 'relative' }}>
                            <button onClick={() => setShowReportModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={30} /></button>

                            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '10px' }}>CARGA DE PLANILLA OFICIAL</h2>
                                <p style={{ opacity: 0.6 }}>Complete los datos requeridos para la base de datos de ADCC</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>ID DE PARTIDO (Sincronizado)</label>
                                    <div style={{
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        fontSize: '1.2rem',
                                        fontWeight: '900',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <Award size={20} className="text-primary" />
                                        {match?.partido_id || match?.realId || 'SIN ID'}
                                    </div>
                                    {!(match?.partido_id || match?.realId) && (
                                        <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>Advertencia: Falta ID de partido en sistema API.</span>
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
                )
            }

            {/* MODAL DE ACCIONES DE JUGADOR */}
            {
                selectedPlayer && (
                    <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 11000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
                        <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '30px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={() => setSelectedPlayer(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}><X size={24} /></button>

                            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <div
                                    onClick={() => setZoomedPhoto({ url: getAdccImageUrl(selectedPlayer.player.photo) || '', name: selectedPlayer.player.name })}
                                    style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', margin: '0 auto 15px', border: '2px solid var(--primary)', cursor: 'zoom-in' }}
                                >
                                    <img src={getAdccImageUrl(selectedPlayer.player.photo) || 'https://via.placeholder.com/80'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <h3 style={{ margin: '0 0 5px', fontSize: '1.4rem' }}>{selectedPlayer.player.name}</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>N° {selectedPlayer.player.number} | {selectedPlayer.player.status === 'titular' ? 'Titular' : 'Suplente'}</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {/* GOLES */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.05)', padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981' }}>
                                        <Target size={20} />
                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>GOLES</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <button
                                            onClick={() => {
                                                const currentGoals = parseInt(selectedPlayer.player.goals) || 0;
                                                if (currentGoals > 0) {
                                                    handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'goals', currentGoals - 1);
                                                    handleScoreChange(selectedPlayer.teamSide, -1);
                                                    setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, goals: currentGoals - 1 } } : null);
                                                }
                                            }}
                                            className="glass-button" style={{ padding: '5px', borderRadius: '50%', width: '30px', height: '30px' }}
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{selectedPlayer.player.goals || 0}</span>
                                        <button
                                            onClick={() => {
                                                const currentGoals = parseInt(selectedPlayer.player.goals) || 0;
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'goals', currentGoals + 1);
                                                handleScoreChange(selectedPlayer.teamSide, 1);
                                                setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, goals: currentGoals + 1 } } : null);
                                            }}
                                            className="glass-button" style={{ padding: '5px', borderRadius: '50%', width: '30px', height: '30px', background: 'rgba(16, 185, 129, 0.2)' }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* AMARILLAS */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(251, 191, 36, 0.05)', padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                                        <Square size={20} fill="#fbbf24" strokeWidth={0} />
                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>AMARILLAS</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <button
                                            onClick={() => {
                                                const currentCards = parseInt(selectedPlayer.player.yellowCards) || 0;
                                                if (currentCards > 0) {
                                                    handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'yellowCards', currentCards - 1);
                                                    setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, yellowCards: currentCards - 1 } } : null);
                                                }
                                            }}
                                            className="glass-button" style={{ padding: '5px', borderRadius: '50%', width: '30px', height: '30px' }}
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{selectedPlayer.player.yellowCards || 0}</span>
                                        <button
                                            onClick={() => {
                                                const currentCards = parseInt(selectedPlayer.player.yellowCards) || 0;
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'yellowCards', currentCards + 1);
                                                setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, yellowCards: currentCards + 1 } } : null);
                                            }}
                                            className="glass-button" style={{ padding: '15px', borderRadius: '50%', width: '30px', height: '30px', background: 'rgba(251, 191, 36, 0.2)' }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* ROJA */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.05)', padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                                        <Square size={20} fill="#ef4444" strokeWidth={0} />
                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>ROJA</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <button
                                            onClick={() => {
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'redCard', false);
                                                setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, redCard: false } } : null);
                                            }}
                                            className="glass-button" style={{ padding: '5px', borderRadius: '50%', width: '30px', height: '30px' }}
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <div style={{ width: '15px', height: '20px', background: selectedPlayer.player.redCard ? "#ef4444" : "rgba(239, 68, 68, 0.2)", borderRadius: '2px' }}></div>
                                        <button
                                            onClick={() => {
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'redCard', true);
                                                setSelectedPlayer(prev => prev ? { ...prev, player: { ...prev.player, redCard: true } } : null);
                                            }}
                                            className="glass-button" style={{ padding: '5px', borderRadius: '50%', width: '30px', height: '30px', background: 'rgba(239, 68, 68, 0.2)' }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* CAMBIAR ESTADO / POSICION */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                    <button
                                        onClick={() => {
                                            const newStatus = selectedPlayer.player.status === 'titular' ? 'suplente' : 'titular';
                                            handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'status', newStatus);
                                            setSelectedPlayer(null);
                                        }}
                                        className="glass-button"
                                        style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <Repeat2 size={18} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{selectedPlayer.player.status === 'titular' ? 'A BANCA' : 'A TITULAR'}</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (confirm('¿Restablecer jugador (quitar expulsión/inhabilitación)?')) {
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'status', 'titular');
                                                handleUpdatePlayer(selectedPlayer.index, selectedPlayer.teamSide, 'redCard', false);
                                                setSelectedPlayer(null);
                                            }
                                        }}
                                        className="glass-button"
                                        style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                    >
                                        <ShieldCheck size={18} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>RESTABLECER</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL ZOOM DE FOTO */}
            {
                zoomedPhoto && (
                    <div
                        className="modal-overlay animate-fade-in"
                        onClick={() => setZoomedPhoto(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(15px)', cursor: 'zoom-out' }}
                    >
                        <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setZoomedPhoto(null)}
                                style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10 }}
                            >
                                <X size={32} />
                            </button>
                            <img
                                src={zoomedPhoto.url}
                                alt={zoomedPhoto.name}
                                style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '80vh', borderRadius: '15px', boxShadow: '0 0 50px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.1)' }}
                            />
                            <div style={{ marginTop: '15px', textAlign: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>{zoomedPhoto.name}</h3>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default MatchDetail;
