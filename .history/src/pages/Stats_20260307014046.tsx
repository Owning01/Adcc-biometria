/**
 * @file Stats.tsx
 * @description PÁGINA DE ESTADÍSTICAS
 * Dashboard analítico que muestra el rendimiento histórico de jugadores y equipos.
 * Permite la edición manual de estadísticas base (goles/asistencias heredados).
 */
import React, { useState, useEffect } from 'react';
import { calculateAllStats, calculateTeamStats } from '../services/statsService';
import { getUsers, updateUser, User } from '../services/db';
import { LayoutGrid, Users, Shield, Search, Activity, Calendar, Clock, BarChart2, ChevronRight, User as UserIcon, Edit2, Save, X, Image as ImageIcon, Award } from 'lucide-react';
import { subscribeToTeams, Team } from '../services/teamsService';
import { getAdccImageUrl } from '../utils/imageUtils';

// ============================================================================
// 1. HELPER INTERFACES
// ============================================================================
interface PlayerStats {
    totalGoals: number;
    totalAssists: number;
    timeInLeague: string;
    seasons: Record<string, { goals: number; assists: number }>;
    clubs: string[];
}

interface TeamStats {
    championshipsTotal: number;
    yearsInLeague: number;
    championshipsByCat: Record<string, number>;
}

// ============================================================================
// 2. MAIN COMPONENT & STATE
// ============================================================================
const Stats = ({ userRole }: { userRole?: string }) => {
    const isAdmin = userRole === 'admin' || userRole === 'dev';
    const [activeTab, setActiveTab] = useState('players'); // 'players', 'teams'
    const [loading, setLoading] = useState(true);
    const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
    const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const allUsers: User[] = await getUsers();
            const pStats = await calculateAllStats(allUsers);
            const tStats = await calculateTeamStats();
            setPlayerStats(pStats as any);
            setTeamStats(tStats as any);
            setUsers(allUsers);
            setLoading(false);
        };
        loadData();

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
        });

        return () => unsubTeams();
    }, []);

    const handleManualStatsUpdate = async (userId: string, field: string, value: any) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            const newManualStats = { ...(user.manualStats || {}), [field]: value };
            await updateUser(userId, { manualStats: newManualStats });

            // Refresh local state
            const updatedUsers = users.map(u => u.id === userId ? { ...u, manualStats: newManualStats } : u);
            setUsers(updatedUsers);
            const newPStats = await calculateAllStats(updatedUsers);
            setPlayerStats(newPStats as any);
        } catch (error: any) {
            alert("Error al actualizar estadísticas: " + (error?.message || "Error desconocido"));
        }
    };

    const filteredUsers = React.useMemo(() => {
        return users.filter(u =>
            (u.name || (u.nombre + ' ' + (u.apellido || '')) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.team || '').toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => {
            const statsA = playerStats[a.id]?.totalGoals || 0;
            const statsB = playerStats[b.id]?.totalGoals || 0;
            return statsB - statsA;
        });
    }, [users, searchTerm, playerStats]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Calculando estadísticas...</div>;

    return (
        <div className="animate-fade-in">
            <header className="stats-header">
                <h1 className="list-title">ESTADÍSTICAS <span className="text-highlight">ADCC</span></h1>
                <p className="list-subtitle">Métricas históricas de jugadores y equipos</p>
            </header>

            <div className="stats-tab-group">
                <button
                    onClick={() => setActiveTab('players')}
                    className={`glass-button ${activeTab === 'players' ? 'active' : ''}`}
                    style={{ minWidth: '140px' }}
                >
                    <Users size={18} /> JUGADORES
                </button>
                <button
                    onClick={() => setActiveTab('teams')}
                    className={`glass-button ${activeTab === 'teams' ? 'active' : ''}`}
                    style={{ minWidth: '140px' }}
                >
                    <LayoutGrid size={18} /> EQUIPOS
                </button>
            </div>

        </div>
    ) : (
        /* Contenido de la pestaña de Equipos */
        <div className="stats-grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
            {Object.entries(teamStats).map(([team, stats]) => (
                <TeamStatCard
                    key={team}
                    team={team}
                    stats={stats}
                    teamData={teamsMetadata.find(t => t.name === team)}
                />
            ))}
        </div>
    )
}
        </div >
    );
};

// ============================================================================
// 3. HELPER COMPONENTS (CARDS & EDITABLES) - MEMOIZED
// ============================================================================

const StatCard = React.memo(({ label, value, icon, editable = false, baseValue = 0, onSave }: { label: string, value: any, icon: any, editable?: boolean, baseValue?: any, onSave?: (v: any) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(baseValue || 0);

    return (
        <div className="stat-card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>{label}</span>
                {icon}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{value}</div>
                {editable && !isEditing && onSave && (
                    <button onClick={() => { setVal(baseValue); setIsEditing(true); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, opacity: 0.5 }}>
                        <Edit2 size={12} />
                    </button>
                )}
            </div>
            {isEditing && onSave && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px', zIndex: 10 }}>
                    <input
                        type="number"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        style={{ width: '60px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '6px', color: 'white', padding: '5px', textAlign: 'center' }}
                    />
                    <button onClick={() => { onSave(val); setIsEditing(false); }} style={{ background: 'var(--primary)', border: 'none', borderRadius: '6px', padding: '5px' }}><Save size={14} color="black" /></button>
                    <button onClick={() => setIsEditing(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '5px' }}><X size={14} color="white" /></button>
                </div>
            )}
            {editable && (baseValue > 0) && (
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                    Incluye {baseValue} base manual
                </div>
            )}
        </div>
    );
});

const EditableStat = React.memo(({ label, value, onSave, suffix = "" }: { label: string, value: any, onSave: (v: any) => void, suffix?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(value);

    if (isEditing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                    type="number"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    style={{ width: '40px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '4px', color: 'white', fontSize: '0.7rem' }}
                />
                <button onClick={() => { onSave(val); setIsEditing(false); }} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}><Save size={12} /></button>
            </div>
        );
    }

    return (
        <span onClick={() => { setVal(value); setIsEditing(true); }} style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)' }}>
            {value}{suffix}
        </span>
    );
});

const PlayerListItem = React.memo(({ user, stats, isActive, onClick }: {
    user: User,
    stats: { totalGoals: number; totalAssists: number },
    isActive: boolean,
    onClick: () => void
}) => (
    <div
        onClick={onClick}
        className={`player-item ${isActive ? 'active' : ''}`}
    >
        <div className="player-item-avatar">
            <img
                src={user.photos?.[0] || user.photo || 'https://via.placeholder.com/40'}
                alt={user.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
        </div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                {user.name || (user.nombre + ' ' + (user.apellido || ''))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.team}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{stats.totalGoals} G</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{stats.totalAssists} A</div>
        </div>
    </div>
));

const TeamStatCard = React.memo(({ team, stats, teamData }: {
    team: string,
    stats: TeamStats,
    teamData?: Team
}) => (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
                <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: '800' }}>{team}</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                    <p className="text-highlight" style={{ fontWeight: '700', margin: 0 }}>{stats.championshipsTotal} Campeonatos</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>• {stats.yearsInLeague} años en ADCC</span>
                </div>
            </div>
            <div style={{ width: '50px', height: '50px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border-light)', overflow: 'hidden' }}>
                {teamData?.logoUrl ? (
                    <img src={teamData.logoUrl} alt={team} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                ) : (
                    <Award size={28} color="#f59e0b" />
                )}
            </div>
        </div>

        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: '700', letterSpacing: '0.5px' }}>LOGROS POR CATEGORÍA</div>
            {Object.entries(stats.championshipsByCat).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    <span>{cat}</span>
                    <span style={{ fontWeight: '800' }}>x{count}</span>
                </div>
            ))}
        </div>
    </div>
));

export default Stats;
