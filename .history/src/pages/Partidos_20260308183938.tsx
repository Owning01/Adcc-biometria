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
    const isFinished = match.status === "finished";
    const statusLabel = getStatusLabel(match.status);

    return (
        <m.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            className="group relative bg-slate-900/50 backdrop-blur-xl border border-white/5 hover:border-emerald-500/50 rounded-3xl p-6 cursor-pointer transition-all duration-300 shadow-xl hover:shadow-emerald-500/10"
            onClick={() => navigate(`/partido/${match.id}`)}
        >
            {/* Header: Date & Time */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                        <Calendar size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{match.date}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                        <Clock size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-300 tracking-wider">{match.time} HS</span>
                    </div>
                </div>

                {(userRole === 'admin' || userRole === 'dev') && (
                    <button
                        onClick={(e) => handleDelete(e, match.id)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200 z-10"
                        title="Eliminar Partido"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Teams & Score */}
            <div className="flex items-center justify-between gap-4">
                {/* Team A */}
                <div className="flex-1 flex flex-col items-center gap-3 text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 group-hover:border-emerald-500/30 transition-colors overflow-hidden">
                        {teamALogo ? (
                            <img src={teamALogo} alt={match.teamA?.name} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" />
                        ) : (
                            <Shield size={32} className="text-white/10" />
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-slate-900/40 to-transparent pointer-events-none" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight px-1">
                        {match.teamA?.name || 'Equipo A'}
                    </span>
                </div>

                {/* Score Pill */}
                <div className="flex flex-col items-center gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl flex items-center justify-center gap-3 sm:gap-4 shadow-inner">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-500 font-mono tracking-tight">
                            {match.score?.a ?? 0}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        <span className="text-2xl sm:text-3xl font-black text-emerald-500 font-mono tracking-tight">
                            {match.score?.b ?? 0}
                        </span>
                    </div>
                    {match.status === 'live' && (
                        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">LIVE</span>
                        </div>
                    )}
                </div>

                {/* Team B */}
                <div className="flex-1 flex flex-col items-center gap-3 text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 group-hover:border-emerald-500/30 transition-colors overflow-hidden">
                        {teamBLogo ? (
                            <img src={teamBLogo} alt={match.teamB?.name} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" />
                        ) : (
                            <Shield size={32} className="text-white/10" />
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-slate-900/40 to-transparent pointer-events-none" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight px-1">
                        {match.teamB?.name || 'Equipo B'}
                    </span>
                </div>
            </div>


            {/* Events Summary (Mini-Timeline) */}
            {match.events && match.events.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 px-2 py-3 bg-white/5 rounded-2xl border border-white/5 group-hover:border-emerald-500/20 transition-colors">
                    {match.events
                        .filter((e: any) => ['goal', 'yellow_card', 'red_card'].includes(e.type))
                        .sort((a: any, b: any) => {
                            const [minA] = (a.time || "0:0").split(':').map(Number);
                            const [minB] = (b.time || "0:0").split(':').map(Number);
                            return minA - minB;
                        })
                        .map((event: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                                <span className="text-[9px] font-black text-slate-500 tabular-nums">{event.time}'</span>
                                {event.type === 'goal' && <Activity size={10} className="text-emerald-500" />}
                                {event.type === 'yellow_card' && <div className="w-1.5 h-2.5 bg-amber-400 rounded-[1px] shadow-[0_0_5px_rgba(251,191,36,0.5)]" />}
                                {event.type === 'red_card' && <div className="w-1.5 h-2.5 bg-red-500 rounded-[1px] shadow-[0_0_5px_rgba(239,68,68,0.5)]" />}
                                <span className="text-[9px] font-bold text-slate-300 truncate max-w-[60px] uppercase">
                                    {(event.player || '').split(' ')[0]}
                                </span>
                            </div>
                        ))}
                </div>
            )}

            {/* Footer: Tournament & Status */}
            <div className="mt-8 pt-4 border-t border-white/5 flex flex-col items-center gap-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-full">
                    {match.tournamentName || match.liga || 'General'}
                </span>
                <div className={`
                    px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-colors
                    ${isFinished
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/5 shadow-lg'
                    }
                `}>
                    {statusLabel}
                    {(match.status === 'halftime' || match.status === 'finished') && (
                        <span className="ml-1.5 opacity-60 font-medium">({formatMatchTime(match)})</span>
                    )}
                </div>
            </div>
        </m.div>
    );
});

const PARTIDOS_PAGE_SIZE = 7;
const CACHE_KEY_MATCHES = 'adcc_cache_matches';
const CACHE_KEY_TEAMS = 'adcc_cache_teams';

const Partidos = ({ userRole }: { userRole: string }) => {
    // Carga inicial desde caché para evitar pantalla blanca
    const cachedMatches = React.useMemo(() => {
        try { const c = localStorage.getItem(CACHE_KEY_MATCHES); return c ? JSON.parse(c) : []; } catch { return []; }
    }, []);
    const cachedTeams = React.useMemo(() => {
        try { const c = localStorage.getItem(CACHE_KEY_TEAMS); return c ? JSON.parse(c) : []; } catch { return []; }
    }, []);

    const [matches, setMatches] = useState<any[]>(cachedMatches);
    const { startSpecificProcessing, status: processorStatus } = useMatchBatchProcessor();
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>(cachedTeams);
    const [loading, setLoading] = useState(cachedMatches.length === 0); // solo spinner si no hay caché
    const navigate = useNavigate();

    // Paginación
    const [upcomingPage, setUpcomingPage] = useState(PARTIDOS_PAGE_SIZE);

    // Sync state
    const [syncRunning, setSyncRunning] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTournament, setSelectedTournament] = useState<string>('todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPast, setShowPast] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Efecto para suscribirse a la colección de partidos
    useEffect(() => {
        const unsubscribe = subscribeToMatches((data) => {
            const sorted = [...data].sort((a: any, b: any) => {
                const dateA = a.date || '';
                const dateB = b.date || '';
                const timeA = a.time || '23:59';
                const timeB = b.time || '23:59';
                return `${dateA}T${timeA}` > `${dateB}T${timeB}` ? 1 : -1;
            });
            setMatches(sorted);
            setLoading(false);
            // Guardar en caché para la próxima visita
            try { localStorage.setItem(CACHE_KEY_MATCHES, JSON.stringify(sorted)); } catch { /* cuota llena */ }
        });

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
            try { localStorage.setItem(CACHE_KEY_TEAMS, JSON.stringify(data)); } catch { /* cuota llena */ }
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

    // Resetear paginación cuando cambian filtros
    useEffect(() => { setUpcomingPage(PARTIDOS_PAGE_SIZE); }, [searchTerm, selectedTournament, selectedDate]);

    const paginatedUpcoming = upcomingMatches.slice(0, upcomingPage);


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

            <header className="mb-10 px-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b-2 border-emerald-500/20">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
                                <Calendar className="w-6 h-6 text-white" />
                            </div>
                            PARTIDOS
                        </h1>
                        <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                            <Activity size={14} className="text-emerald-500" />
                            {filteredMatches.length} partidos encontrados
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {(userRole === 'admin' || userRole === 'dev') && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSync}
                                    disabled={syncRunning}
                                    className="group flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-2xl transition-all duration-300 text-xs font-black tracking-widest shadow-xl shadow-emerald-500/20"
                                >
                                    <RefreshCw size={14} className={syncRunning ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                                    {syncRunning ? 'IMPORTANDO...' : 'IMPORTAR ADCC'}
                                </button>
                                <button
                                    onClick={handleClearMatches}
                                    disabled={syncRunning}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-2xl transition-all duration-300 text-xs font-black tracking-widest"
                                >
                                    <Trash2 size={14} />
                                    BORRAR
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="p-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-2xl transition-all duration-300 border border-white/5"
                            title="Recargar página"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Log Panel */}
                {showSyncPanel && syncLogs.length > 0 && (
                    <m.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 bg-slate-950/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6 max-h-60 overflow-hidden flex flex-col shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                            <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em]">📋 CONSOLA DE SINCRONIZACIÓN</span>
                            <button onClick={() => setShowSyncPanel(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed hide-scrollbar">
                            {syncLogs.map((line, i) => (
                                <div key={i} className={line.includes('❌') || line.includes('💥') ? 'text-red-400' : line.includes('✅') || line.includes('✔') ? 'text-emerald-400' : 'text-slate-400'}>
                                    {line}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </m.div>
                )}

                {/* Search & Filters */}
                <div className="mt-8 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por equipo..."
                            className="w-full bg-slate-900/50 border border-white/5 focus:border-emerald-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none transition-all duration-300"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 md:w-auto">
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
                            <select
                                value={selectedTournament}
                                onChange={(e) => setSelectedTournament(e.target.value)}
                                className="w-full sm:w-60 bg-slate-900/50 border border-white/5 focus:border-emerald-500/50 rounded-2xl py-3.5 pl-12 pr-10 text-sm text-white focus:outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="todos">Todos los Torneos</option>
                                {tournamentOptions.map(tName => (
                                    <option key={tName} value={tName}>{tName}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>

                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
                            <input
                                type="date"
                                className="w-full sm:w-48 bg-slate-900/50 border border-white/5 focus:border-emerald-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none transition-all flex"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                            />
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate('')}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
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
                                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={14} /> Próximos & En Vivo
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>({upcomingMatches.length})</span>
                                    </h2>
                                    <div className="grid-responsive" style={{ marginBottom: '16px' }}>
                                        {paginatedUpcoming.map(m => (
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
                                    {upcomingPage < upcomingMatches.length && (
                                        <button
                                            onClick={() => setUpcomingPage(p => p + PARTIDOS_PAGE_SIZE)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                margin: '0 auto 32px auto', padding: '10px 24px',
                                                background: 'rgba(0,135,81,0.12)', border: '1px solid rgba(0,135,81,0.3)',
                                                borderRadius: '99px', color: 'var(--primary)', cursor: 'pointer',
                                                fontSize: '0.85rem', fontWeight: 600
                                            }}
                                        >
                                            <ChevronDown size={16} /> Cargar más ({upcomingMatches.length - upcomingPage} restantes)
                                        </button>
                                    )}
                                </>
                            )}

                            {pastMatches.length > 0 && (
                                <div style={{ marginTop: '30px' }}>
                                    <button
                                        onClick={() => setShowPast(p => !p)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', padding: 0 }}
                                    >
                                        <Clock size={14} /> Ya Disputados ({pastMatches.length})
                                        <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>{showPast ? '▲' : '▼'}</span>
                                    </button>
                                    {showPast && (
                                        <div className="grid-responsive">
                                            {pastMatches.map(m => (
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
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {userRole === 'dev' && (
                <div className="hidden sm:block" style={{
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
