/**
 * @file Equipos.tsx
 * @description Gestión de Torneos para ADCC Biometric.
 */
import React, { useState, useEffect } from 'react';
import {
    getUsers,
    User,
    updateUser,
    updateUserCategories,
    subscribeToUsers
} from '../services/db';
import {
    getTournaments,
    saveTournament,
    updateTournament,
    deleteTournament,
    Tournament,
    getMatches,
    Match,
    subscribeToMatch
} from '../services/matchesService';
import { subscribeToTeams, Team } from '../services/teamsService';
import {
    Plus,
    Edit2,
    Trash2,
    Calendar,
    Users,
    Search,
    RefreshCw,
    X,
    ImageIcon,
    ArrowRightLeft,
    UserPlus
} from 'lucide-react';
import { syncADCCData } from '../services/syncService';
import { getAdccImageUrl } from '../utils/imageUtils';
import QuickRegisterModal from '../components/QuickRegisterModal';

const Equipos = ({ userRole }: { userRole: string }) => {
    const isUsuario = userRole === 'usuario';
    const isPublic = userRole === 'public';

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'torneos'>('torneos');
    const [showNewTournament, setShowNewTournament] = useState(false);
    const [newTournament, setNewTournament] = useState({ name: '', category: '' });
    const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isCreatingTournament, setIsCreatingTournament] = useState(false);

    // Listados de apoyo
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [tempTeams, setTempTeams] = useState<string[]>([]);
    const [teamCategories, setTeamCategories] = useState<Record<string, string[]>>({});
    const [tempCategories, setTempCategories] = useState<Record<string, string[]>>({});
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);

    // Partido Nuevo
    const [showNewMatch, setShowNewMatch] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newMatch, setNewMatch] = useState({
        teamA: '',
        teamB: '',
        date: new Date().toISOString().split('T')[0],
        time: '14:00'
    });

    // Quick Register
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterData, setQuickRegisterData] = useState({ name: '', dni: '', team: '', category: '' });

    // Sync
    const [syncingAll, setSyncingAll] = useState(false);

    useEffect(() => {
        loadData();
        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
            const names = data.map(t => t.name);
            setAvailableTeams(names);
        });
        return () => unsubTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tData, uData] = await Promise.all([
                getTournaments(),
                getUsers()
            ]);
            setTournaments(tData);
            setAllUsers(uData);
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTournament.name) return;
        setIsCreatingTournament(true);
        try {
            await saveTournament({
                name: newTournament.name,
                category: newTournament.category || 'General',
                status: 'active'
            });
            setShowNewTournament(false);
            setNewTournament({ name: '', category: '' });
            loadData();
        } catch (err) {
            alert("Error al crear torneo");
        } finally {
            setIsCreatingTournament(false);
        }
    };

    const handleUpdateTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTournament) return;
        try {
            await updateTournament(editingTournament.id, {
                name: editingTournament.name,
                category: editingTournament.category
            });
            setEditingTournament(null);
            loadData();
        } catch (err) {
            alert("Error al actualizar torneo");
        }
    };

    const handleDeleteTournament = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("¿Eliminar este torneo y sus partidos asociados?")) {
            try {
                await deleteTournament(id);
                if (selectedTournament?.id === id) setSelectedTournament(null);
                loadData();
            } catch (err) {
                alert("Error al eliminar torneo");
            }
        }
    };

    const handleCreateMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTournament || !newMatch.teamA || !newMatch.teamB) return;
        setIsCreating(true);
        try {
            // Lógica de creación de partido (simulada aquí por brevedad, asumiendo db tiene addMatch)
            // En una app real llamarías a un servicio para agregar el partido al torneo
            // ... (AQUÍ IRÍA LA LLAMADA AL SERVICIO)
            setShowNewMatch(false);
            setNewMatch({ teamA: '', teamB: '', date: new Date().toISOString().split('T')[0], time: '14:00' });
        } catch (err) {
            alert("Error al crear partido");
        } finally {
            setIsCreating(false);
        }
    };

    const handleFullSync = async () => {
        if (!window.confirm("¿Deseas sincronizar todos los datos de ADCC (Partidos, Equipos, Jugadores)? Esto puede tardar unos segundos.")) return;
        setSyncingAll(true);
        try {
            await syncADCCData({ userRole });
            await loadData();
            alert("Sincronización completa");
        } catch (err) {
            alert("Error en sincronización");
        } finally {
            setSyncingAll(false);
        }
    };

    const handleOpenQuickRegister = (team: string, category: string) => {
        setQuickRegisterData({ name: '', dni: '', team, category });
        setShowQuickRegister(true);
    };

    if (loading) return <div className="loading-screen">Cargando gestión deportiva...</div>;

    return (
        <div className="page-container animate-fade-in">
            <div className="hero-mini">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div>
                        <h1 className="premium-title">Torneos y Gestión</h1>
                        <p className="premium-subtitle">Control de competiciones y equipos registrados</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', padding: '10px 0' }}>TORNEOS</div>
                {(!isUsuario && !isPublic) && (
                    <>
                        <button
                            onClick={handleFullSync}
                            disabled={syncingAll}
                            className="glass-button"
                            style={{ marginLeft: 'auto', background: 'rgba(0, 135, 81, 0.1)', borderColor: 'var(--primary)', color: 'var(--primary)', padding: '10px 15px' }}
                        >
                            <RefreshCw size={18} className={syncingAll ? 'animate-spin' : ''} /> {syncingAll ? 'SINCRONIZANDO...' : 'TRAER TODO'}
                        </button>
                    </>
                )}
            </div>

            {activeTab === 'torneos' && (
                <div className="torneos-grid">
                    {(!isUsuario && !isPublic) && (
                        <div className="add-card-glass" onClick={() => setShowNewTournament(true)}>
                            <Plus size={32} />
                            <span>NUEVO TORNEO</span>
                        </div>
                    )}

                    {tournaments.map(t => (
                        <div
                            key={t.id}
                            className={`tournament-card-glass ${selectedTournament?.id === t.id ? 'selected' : ''}`}
                            onClick={() => setSelectedTournament(t)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '5px' }}>{t.category.toUpperCase()}</div>
                                    <h3 style={{ margin: 0 }}>{t.name}</h3>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <span className="status-badge" style={{ background: t.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)', color: t.status === 'active' ? '#4ade80' : 'inherit' }}>
                                            {t.status === 'active' ? 'VIGENTE' : 'FINALIZADO'}
                                        </span>
                                    </div>
                                </div>
                                {(!isUsuario && !isPublic) && (
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingTournament(t); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', opacity: 0.6, padding: '5px' }}><Edit2 size={16} /></button>
                                        <button onClick={(e) => handleDeleteTournament(e, t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, padding: '5px' }}><Trash2 size={16} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedTournament && (
                <div style={{ marginTop: '30px' }}>
                    <div className="glass-panel" style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Gestión de {selectedTournament.name}</h2>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '5px' }}>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>Administra partidos y registra jugadores directamente</p>
                                    <span style={{ fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '5px', color: 'var(--primary)' }}>{selectedTournament.category}</span>
                                </div>
                            </div>
                            {(!isUsuario && !isPublic) && (
                                <button onClick={() => setShowNewMatch(true)} className="glass-button" style={{ background: 'var(--success)', fontSize: '0.8rem' }}><Plus size={18} /> Agregar Encuentro</button>
                            )}
                        </div>
                        <MatchList tournamentId={selectedTournament.id} onQuickRegister={handleOpenQuickRegister} userRole={userRole} />
                    </div>
                </div>
            )}

            {/* Modals */}
            {showNewTournament && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '30px', maxWidth: '500px', width: '100%', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                        <h2>Nuevo Torneo</h2>
                        <form onSubmit={handleCreateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                            <input className="premium-input" placeholder="Nombre del Torneo" value={newTournament.name} onChange={e => setNewTournament({ ...newTournament, name: e.target.value })} required />
                            <input className="premium-input" placeholder="Categoría (ej: Masculino A)" value={newTournament.category} onChange={e => setNewTournament({ ...newTournament, category: e.target.value })} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowNewTournament(false)} className="glass-button button-secondary" style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" disabled={isCreatingTournament} className="glass-button" style={{ flex: 1 }}>{isCreatingTournament ? 'Creando...' : 'Crear'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showNewMatch && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '30px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                        <h2>Nuevo Partido</h2>
                        <form onSubmit={handleCreateMatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <select className="premium-input" value={newMatch.teamA} onChange={e => setNewMatch({ ...newMatch, teamA: e.target.value })} required>
                                    <option value="" disabled>Equipo Local</option>
                                    {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select className="premium-input" value={newMatch.teamB} onChange={e => setNewMatch({ ...newMatch, teamB: e.target.value })} required>
                                    <option value="" disabled>Equipo Visitante</option>
                                    {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <input type="date" className="premium-input" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} required />
                                <input type="time" className="premium-input" value={newMatch.time} onChange={e => setNewMatch({ ...newMatch, time: e.target.value })} required />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button type="button" onClick={() => setShowNewMatch(false)} className="glass-button button-secondary" style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" disabled={isCreating} className="glass-button" style={{ flex: 1 }}>{isCreating ? 'Creando...' : 'Crear Partido'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingTournament && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="glass-panel" style={{ padding: '30px', maxWidth: '500px', width: '100%' }}>
                        <h2>Editar Torneo</h2>
                        <form onSubmit={handleUpdateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                            <input className="premium-input" value={editingTournament.name} onChange={e => setEditingTournament({ ...editingTournament, name: e.target.value })} required />
                            <input className="premium-input" value={editingTournament.category || ''} onChange={e => setEditingTournament({ ...editingTournament, category: e.target.value })} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setEditingTournament(null)} className="glass-button button-secondary" style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="glass-button" style={{ flex: 1 }}>Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showQuickRegister && (
                <QuickRegisterModal
                    data={quickRegisterData}
                    onClose={() => setShowQuickRegister(false)}
                />
            )}
        </div>
    );
};

interface MatchListProps {
    tournamentId: string;
    onQuickRegister: (team: string, category: string) => void;
    userRole?: string;
}

const MatchList = ({ tournamentId, onQuickRegister, userRole }: MatchListProps) => {
    const isUsuario = userRole === 'usuario';
    const isPublic = userRole === 'public';
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);

    useEffect(() => {
        const load = async () => {
            const data = await getMatches(tournamentId);
            setMatches(data);
            setLoading(false);
        };
        load();

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
        });

        return () => unsubTeams();
    }, [tournamentId]);

    const calculateMinute = (match: Match) => {
        if (match.status !== 'live' || !match.liveStartTime) return null;
        const elapsed = Math.floor((Date.now() - match.liveStartTime) / 60000);
        return (match.accumulatedTime || 0) + elapsed;
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Cargando...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matches.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: 'var(--header-bg)', borderRadius: '20px', color: 'var(--text-muted)', border: '1px dashed var(--glass-border-light)' }}>
                    No hay partidos programados para este torneo aún.
                </div>
            ) : (
                matches.map(m => (
                    <div
                        key={m.id}
                        className="glass-panel"
                        style={{ padding: '15px 20px', display: 'grid', gridTemplateColumns: 'minmax(100px, auto) 1fr minmax(120px, auto)', alignItems: 'center', gap: '20px', border: '1px solid var(--glass-border-light)', background: 'var(--header-bg)', overflowX: 'auto' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{
                                background: m.status === 'live' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                color: m.status === 'live' ? '#ef4444' : 'var(--text-muted)',
                                fontWeight: '700',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                {m.status === 'live' ? (
                                    <span style={{ fontSize: '1.1rem', fontWeight: '900' }}>{calculateMinute(m)}'</span>
                                ) : (
                                    <span>{m.time} HS</span>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '15px', flex: 1, minWidth: 0 }}>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamA?.name || 'Equipo A'}</div>
                                        <div className="hexagon-bg-logo team-logo-thumb" style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {(() => {
                                                const tA = teamsMetadata.find(t => t.name === (m.teamA?.name || ''));
                                                const logoUrl = tA?.logoUrl || getAdccImageUrl(m.teamA?.logo || undefined);
                                                return logoUrl ? <img src={logoUrl} alt="L" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : <ImageIcon size={14} opacity={0.2} />;
                                            })()}
                                        </div>
                                    </div>
                                    {(!isUsuario && !isPublic) && (
                                        <button
                                            onClick={() => onQuickRegister(m.teamA?.name || '', m.category || 'Principal')}
                                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}
                                        >
                                            + REGISTRAR JUGADOR
                                        </button>
                                    )}
                                </div>
                                <span style={{ opacity: 0.2, fontWeight: '900', fontSize: '1rem', padding: '0 10px' }}>VS</span>
                                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="hexagon-bg-logo team-logo-thumb" style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {(() => {
                                                const tB = teamsMetadata.find(t => t.name === (m.teamB?.name || ''));
                                                const logoUrl = tB?.logoUrl || getAdccImageUrl(m.teamB?.logo || undefined);
                                                return logoUrl ? <img src={logoUrl} alt="V" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : <ImageIcon size={14} opacity={0.2} />;
                                            })()}
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamB?.name || 'Equipo B'}</div>
                                    </div>
                                    {(!isUsuario && !isPublic) && (
                                        <button
                                            onClick={() => onQuickRegister(m.teamB?.name || '', m.category || 'Principal')}
                                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}
                                        >
                                            + REGISTRAR JUGADOR
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Event Summary */}
                        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '0.65rem', opacity: 0.5 }}>
                            <div style={{ flex: 1, textAlign: 'right' }}>
                                {(m.events || []).filter((e: any) => (e.teamSide === 'A' || e.team === m.teamA?.name) && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                                    <span key={e.id || e.eventId} style={{ marginLeft: '8px' }}>{e.player || e.playerName} ({e.time || e.minute}')</span>
                                ))}
                            </div>
                            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ flex: 1 }}>
                                {(m.events || []).filter((e: any) => (e.teamSide === 'B' || e.team === m.teamB?.name) && (e.type === 'goal' || e.type.includes('card'))).map((e: any) => (
                                    <span key={e.id || e.eventId} style={{ marginRight: '8px' }}>{e.player || e.playerName} ({e.time || e.minute}')</span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '5px' }}>{m.category}</span>
                            <div className="status-badge" style={{
                                fontSize: '0.7rem',
                                background: (m.status === 'live') ? 'rgba(239, 68, 68, 0.2)' : (m.status === 'finished' ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                                color: (m.status === 'live') ? '#ef4444' : (m.status === 'finished' ? '#9ca3af' : '#60a5fa')
                            }}>{(m.status || 'PROGRAMADO').toUpperCase()}</div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default Equipos;
