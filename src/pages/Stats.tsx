import React, { useState, useEffect } from 'react';
import { calculateAllStats, calculateTeamStats } from '../services/statsService';
import { getUsers, updateUser } from '../services/db';
import { LayoutGrid, Users, Trophy, Search, Activity, Calendar, Clock, BarChart2, ChevronRight, User, Edit2, Save, X } from 'lucide-react';

const Stats = () => {
    const [activeTab, setActiveTab] = useState('players'); // 'players', 'teams'
    const [loading, setLoading] = useState(true);
    const [playerStats, setPlayerStats] = useState({});
    const [teamStats, setTeamStats] = useState({});
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            const allUsers = await getUsers();
            const pStats = await calculateAllStats(allUsers);
            const tStats = await calculateTeamStats();
            setPlayerStats(pStats);
            setTeamStats(tStats);
            setUsers(allUsers);
            setLoading(false);
        };
        loadData();
    }, []);

    const handleManualStatsUpdate = async (userId, field, value) => {
        try {
            const user = users.find(u => u.id === userId);
            const newManualStats = { ...(user.manualStats || {}), [field]: value };
            await updateUser(userId, { manualStats: newManualStats });

            // Refresh local state
            const updatedUsers = users.map(u => u.id === userId ? { ...u, manualStats: newManualStats } : u);
            setUsers(updatedUsers);
            const newPStats = await calculateAllStats(updatedUsers);
            setPlayerStats(newPStats);
        } catch (error) {
            alert("Error al actualizar estadísticas: " + error.message);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.name || (u.nombre + ' ' + (u.apellido || '')) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.team?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        const statsA = playerStats[a.id]?.totalGoals || 0;
        const statsB = playerStats[b.id]?.totalGoals || 0;
        return statsB - statsA;
    });

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Calculando estadísticas...</div>;

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>
                    ESTADÍSTICAS <span style={{ color: 'var(--primary)' }}>ADCC</span>
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Métricas históricas de jugadores y equipos</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
                <button
                    onClick={() => setActiveTab('players')}
                    className={`glass-button ${activeTab === 'players' ? 'active' : ''}`}
                    style={{ background: activeTab === 'players' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'players' ? 'black' : 'white' }}
                >
                    <Users size={18} /> JUGADORES
                </button>
                <button
                    onClick={() => setActiveTab('teams')}
                    className={`glass-button ${activeTab === 'teams' ? 'active' : ''}`}
                    style={{ background: activeTab === 'teams' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'teams' ? 'black' : 'white' }}
                >
                    <Trophy size={18} /> EQUIPOS
                </button>
            </div>

            {activeTab === 'players' ? (
                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 992 ? '350px 1fr' : '1fr', gap: '25px' }}>
                    {/* Lista de Jugadores */}
                    <div className="glass-panel" style={{ padding: '20px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'relative', marginBottom: '15px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                className="premium-input"
                                placeholder="Buscar jugador o equipo..."
                                style={{ paddingLeft: '40px' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {filteredUsers.map(u => {
                                const stats = playerStats[u.id] || { totalGoals: 0, totalAssists: 0 };
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedPlayer(u)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: selectedPlayer?.id === u.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            marginBottom: '5px',
                                            border: selectedPlayer?.id === u.id ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
                                        }}
                                    >
                                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden' }}>
                                            <img src={u.photos?.[0] || u.photo || 'https://via.placeholder.com/40'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{u.name || (u.nombre + ' ' + (u.apellido || ''))}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.team}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{stats.totalGoals} G</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{stats.totalAssists} A</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Perfil del Jugador */}
                    <div className="glass-panel" style={{ padding: '30px' }}>
                        {selectedPlayer ? (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '40px' }}>
                                    <div style={{ width: '100px', height: '100px', borderRadius: '24px', background: '#1e293b', overflow: 'hidden', border: '3px solid var(--primary)', boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}>
                                        <img src={selectedPlayer.photos?.[0] || selectedPlayer.photo || 'https://via.placeholder.com/100'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedPlayer.name || (selectedPlayer.nombre + ' ' + (selectedPlayer.apellido || ''))}</h2>
                                        <p style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem', margin: '5px 0' }}>{selectedPlayer.team}</p>
                                        <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            <span>DNI: {selectedPlayer.dni}</span>
                                            <span>•</span>
                                            <EditableStat
                                                label="Ajuste Años"
                                                value={selectedPlayer.manualStats?.yearsAdjustment || 0}
                                                onSave={(v) => handleManualStatsUpdate(selectedPlayer.id, 'yearsAdjustment', v)}
                                                suffix=" años extra"
                                            />
                                            <span>•</span>
                                            <span>{playerStats[selectedPlayer.id]?.timeInLeague || 'Nuevo'} en ADCC</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                                    <StatCard
                                        label="GOLES TOTALES"
                                        value={playerStats[selectedPlayer.id]?.totalGoals || 0}
                                        icon={<Trophy color="#f59e0b" />}
                                        editable
                                        baseValue={selectedPlayer.manualStats?.baseGoals || 0}
                                        onSave={(v) => handleManualStatsUpdate(selectedPlayer.id, 'baseGoals', v)}
                                    />
                                    <StatCard
                                        label="ASISTENCIAS"
                                        value={playerStats[selectedPlayer.id]?.totalAssists || 0}
                                        icon={<Activity color="#10b981" />}
                                        editable
                                        baseValue={selectedPlayer.manualStats?.baseAssists || 0}
                                        onSave={(v) => handleManualStatsUpdate(selectedPlayer.id, 'baseAssists', v)}
                                    />
                                    <StatCard label="TEMPORADAS" value={Object.keys(playerStats[selectedPlayer.id]?.seasons || {}).length} icon={<Calendar color="#3b82f6" />} />
                                </div>

                                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>Historial por Temporada</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {Object.entries(playerStats[selectedPlayer.id]?.seasons || {}).map(([season, data]) => (
                                        <div key={season} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                            <div style={{ fontWeight: '700' }}>Temporada {season}</div>
                                            <div style={{ display: 'flex', gap: '20px' }}>
                                                <span><span style={{ color: 'var(--primary)' }}>{data.goals}</span> Goles</span>
                                                <span><span style={{ color: 'var(--primary)' }}>{data.assists}</span> Asist.</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <h3 style={{ fontSize: '1.1rem', marginTop: '40px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>Clubes anteriores ADCC</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {(playerStats[selectedPlayer.id]?.clubs || []).map(club => (
                                        <div key={club} style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            {club}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <User size={64} />
                                <p>Selecciona un jugador para ver su perfil estadístico</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
                    {Object.entries(teamStats).length === 0 ? (
                        <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', opacity: 0.3 }}>
                            No hay datos de campeonatos registrados aún.
                        </div>
                    ) : (
                        Object.entries(teamStats).map(([team, stats]) => (
                            <div key={team} className="glass-panel" style={{ padding: '25px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{team}</h2>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                                            <p style={{ color: 'var(--primary)', fontWeight: '700', margin: 0 }}>{stats.championshipsTotal} Campeonatos</p>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>• {stats.yearsInLeague} años en ADCC</span>
                                        </div>
                                    </div>
                                    <div style={{ width: '50px', height: '50px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Trophy size={28} color="#f59e0b" />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>LOGROS POR CATEGORÍA</div>
                                    {Object.entries(stats.championshipsByCat).map(([cat, count]) => (
                                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                                            <span>{cat}</span>
                                            <span style={{ fontWeight: '800' }}>x{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, editable, baseValue, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(baseValue || 0);

    return (
        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>{label}</span>
                {icon}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{value}</div>
                {editable && !isEditing && (
                    <button onClick={() => { setVal(baseValue); setIsEditing(true); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, opacity: 0.5 }}>
                        <Edit2 size={12} />
                    </button>
                )}
            </div>
            {isEditing && (
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
};

const EditableStat = ({ label, value, onSave, suffix = "" }) => {
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
};

export default Stats;
