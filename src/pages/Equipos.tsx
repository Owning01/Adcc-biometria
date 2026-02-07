import React, { useState, useEffect } from 'react';
import { saveTournament, getTournaments, subscribeToTournaments, saveMatch, getMatches, deleteMatch, deleteTournament, updateTournament } from '../services/matchesService';
import { Trophy, Plus, Calendar, Clock, Users, Trash2, ChevronRight, Edit2, Save, X, Settings2, RefreshCw, ShieldAlert, Square, ArrowRightLeft, UserPlus } from 'lucide-react';
import { getUsers, subscribeToUsers, updateTeamName, updateTeamCategory, saveUser, checkDniExists, updateUser, updateUserCategories } from '../services/db';
import { useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { getFaceDataLocal } from '../services/faceServiceLocal';
import { createMatcher } from '../services/faceService';

const Equipos = () => {
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showNewTournament, setShowNewTournament] = useState(false);
    const [showNewMatch, setShowNewMatch] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [availableTeams, setAvailableTeams] = useState([]);
    const [teamCategories, setTeamCategories] = useState({}); // { TeamName: [Cat1, Cat2] }
    const [allUsers, setAllUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('torneos'); // 'torneos' or 'equipos'
    const [expandedCategory, setExpandedCategory] = useState(null); // { team, category }
    const [editingTournament, setEditingTournament] = useState(null);
    const [editingTeam, setEditingTeam] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [tempCategories, setTempCategories] = useState({}); // { TeamName: [NewCat1, NewCat2] }
    const [tempTeams, setTempTeams] = useState([]); // [NewTeam1, NewTeam2]
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterData, setQuickRegisterData] = useState({ name: '', dni: '', team: '', category: '' });
    const [isCreatingTournament, setIsCreatingTournament] = useState(false);

    // Modales modernos rápidos
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState({ open: false, team: '' });
    const [renameModal, setRenameModal] = useState({ open: false, type: '', oldName: '', teamName: '', newValue: '' });
    const [modalInput, setModalInput] = useState('');
    const [categoryControl, setCategoryControl] = useState({ open: false, user: null, currentCat: '' });

    const [newTournament, setNewTournament] = useState({ name: '', category: '' });
    const [newMatch, setNewMatch] = useState({
        teamA: '',
        teamB: '',
        date: '',
        time: '',
        gameTime: '45',
        restTime: '15',
        category: ''
    });

    useEffect(() => {
        setLoading(true);
        // 1. Suscripción a Torneos
        const unsubTournaments = subscribeToTournaments((data) => {
            setTournaments(data);
            setLoading(false);
        });

        // 2. Suscripción a Usuarios (para Equipos y Categorías)
        const unsubUsers = subscribeToUsers((users) => {
            setAllUsers(users);
            const teams = [...new Set(users.map(u => u.team))].filter(Boolean).sort();
            setAvailableTeams(teams);

            // Organizar categorías por equipo
            const catMap = {};
            users.forEach(u => {
                const cats = Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category];
                cats.forEach(c => {
                    if (u.team && c) {
                        if (!catMap[u.team]) catMap[u.team] = new Set();
                        catMap[u.team].add(c);
                    }
                });
            });
            const finalMap = {};
            Object.keys(catMap).forEach(team => {
                finalMap[team] = [...catMap[team]].sort();
            });
            setTeamCategories(finalMap);

            // AUTO-CLEAN temporales
            setTempTeams(prev => prev.filter(t => !teams.includes(t)));
            setTempCategories(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(team => {
                    if (finalMap[team]) {
                        next[team] = next[team].filter(c => !finalMap[team].includes(c));
                        if (next[team].length === 0) delete next[team];
                    }
                });
                return next;
            });
        });

        return () => {
            unsubTournaments();
            unsubUsers();
        };
    }, []);

    const handleUpdateTournament = async (e) => {
        e.preventDefault();
        try {
            await updateTournament(editingTournament.id, {
                name: editingTournament.name,
                category: editingTournament.category
            });
            setEditingTournament(null);
            alert("Torneo actualizado");
        } catch (error) {
            alert("Error al actualizar torneo");
        }
    };

    const handleRenameTeam = (team) => {
        setRenameModal({
            open: true,
            type: 'team',
            oldName: team,
            teamName: '',
            newValue: team
        });
    };

    const handleRenameCategory = (team, oldCat) => {
        setRenameModal({
            open: true,
            type: 'category',
            oldName: oldCat,
            teamName: team,
            newValue: oldCat
        });
    };

    const confirmRename = async () => {
        const { type, oldName, teamName, newValue } = renameModal;
        const normalized = newValue.trim();
        if (!normalized || normalized === oldName) {
            setRenameModal({ open: false, type: '', oldName: '', teamName: '', newValue: '' });
            return;
        }

        try {
            setLoading(true);
            if (type === 'team') {
                await updateTeamName(oldName, normalized);
                alert("Equipo renombrado con éxito");
            } else {
                await updateTeamCategory(teamName, oldName, normalized);
                alert("Categoría renombrada con éxito");
            }
            setRenameModal({ open: false, type: '', oldName: '', teamName: '', newValue: '' });
        } catch (error) {
            alert("Error al renombrar: " + error.message);
            setLoading(false);
        }
    };

    const handleAddCategory = (team) => {
        setModalInput('');
        setShowCategoryModal({ open: true, team });
    };

    const handleConfirmAddCategory = () => {
        const newCat = modalInput.trim();
        if (!newCat) return;
        const team = showCategoryModal.team;

        // Verificar si ya existe
        const existing = [...(teamCategories[team] || []), ...(tempCategories[team] || [])];
        if (existing.includes(newCat)) {
            alert("La categoría ya existe");
            return;
        }

        setTempCategories(prev => ({
            ...prev,
            [team]: [...new Set([...(prev[team] || []), newCat])]
        }));
        setShowCategoryModal({ open: false, team: '' });
    };

    const handleOpenQuickRegister = (team, category) => {
        setQuickRegisterData({ name: '', dni: '', team, category });
        setShowQuickRegister(true);
    };

    const handleCreateNewTeam = () => {
        setModalInput('');
        setShowTeamModal(true);
    };

    const handleConfirmAddTeam = () => {
        const normalized = modalInput.trim();
        if (!normalized) return;

        const allTeams = [...availableTeams, ...tempTeams];
        if (allTeams.some(t => t.toLowerCase() === normalized.toLowerCase())) {
            alert("El equipo ya existe");
            return;
        }

        setTempTeams(prev => [...prev, normalized]);
        setActiveTab('equipos');
        setShowTeamModal(false);
    };

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        try {
            setIsCreatingTournament(true);
            await saveTournament(newTournament);
            setNewTournament({ name: '', category: '' });
            setShowNewTournament(false);
        } catch (error) {
            alert("Error al crear torneo");
        } finally {
            setIsCreatingTournament(false);
        }
    };

    const handleCreateMatch = async (e) => {
        e.preventDefault();
        if (isCreating) return;
        setIsCreating(true);
        try {
            await saveMatch({
                ...newMatch,
                tournamentId: selectedTournament.id,
                teamA: { name: newMatch.teamA, logo: null },
                teamB: { name: newMatch.teamB, logo: null },
            });
            setNewMatch({ teamA: '', teamB: '', date: '', time: '', gameTime: '45', restTime: '15', category: '' });
            setShowNewMatch(false);
            alert("Partido creado con éxito");
        } catch (error) {
            alert("Error al crear partido");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteTournament = async (e, id) => {
        e.stopPropagation();
        const code = prompt("Ingrese el código 777 para eliminar el torneo y sus partidos:");
        if (code === '777') {
            if (confirm("¿Seguro? Se borrarán todos los partidos de este torneo.")) {
                try {
                    const matchesToDel = await getMatches(id);
                    for (const m of matchesToDel) {
                        await deleteMatch(m.id);
                    }
                    await deleteTournament(id);
                    if (selectedTournament?.id === id) setSelectedTournament(null);
                } catch (error) {
                    alert("Error al eliminar torneo");
                }
            }
        }
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '5px' }}>Gestión de <span style={{ color: 'var(--primary)' }}>Torneos</span></h1>
                        <p style={{ color: 'var(--text-muted)' }}>Crea y gestiona tus torneos, equipos y categorías</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowNewTournament(true)} className="glass-button btn-primary" style={{ padding: '10px 20px' }}><Plus size={20} /> Nuevo Torneo</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button onClick={() => setActiveTab('torneos')} className={`tab-button ${activeTab === 'torneos' ? 'active' : ''}`}><Trophy size={18} /> TORNEOS</button>
                    <button onClick={() => setActiveTab('equipos')} className={`tab-button ${activeTab === 'equipos' ? 'active' : ''}`}><Users size={18} /> EQUIPOS Y JUGADORES</button>
                    <button onClick={handleCreateNewTeam} className="glass-button" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--success)', color: 'var(--success)', padding: '10px 15px', flex: '0 0 auto' }}><Plus size={18} /> <span style={{ fontSize: '0.7rem' }}>EQUIPO</span></button>
                </div>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>Cargando datos...</div>
            ) : activeTab === 'torneos' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {tournaments.map(t => (
                        <div key={t.id} className="glass-panel" style={{ padding: '20px', cursor: 'pointer', border: selectedTournament?.id === t.id ? '2px solid var(--primary)' : '1px solid var(--glass-border-light)', background: 'var(--header-bg)' }} onClick={() => setSelectedTournament(t)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary)' }}><Trophy size={28} /></div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{t.name}</h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.category || 'Sin categoría'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingTournament(t); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', opacity: 0.6, padding: '5px' }}><Edit2 size={16} /></button>
                                    <button onClick={(e) => handleDeleteTournament(e, t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, padding: '5px' }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {[...availableTeams, ...tempTeams].length === 0 ? (
                        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                            <Users size={48} style={{ opacity: 0.1, marginBottom: '20px' }} /><p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No hay equipos registrados aún.</p>
                            <button onClick={handleCreateNewTeam} className="glass-button" style={{ margin: '0 auto' }}><Plus size={18} /> CREAR MI PRIMER EQUIPO</button>
                        </div>
                    ) : (
                        [...availableTeams, ...tempTeams].map(team => (
                            <div key={team} className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={24} color="var(--primary)" /><h3 style={{ margin: 0, letterSpacing: '1px' }}>{team.toUpperCase()}</h3></div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleAddCategory(team)} className="glass-button" style={{ padding: '5px 15px', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--primary)' }}><Plus size={12} /> NUEVA CATEGORÍA</button>
                                        <button onClick={() => handleRenameTeam(team)} className="glass-button" style={{ padding: '5px 15px', fontSize: '0.7rem', opacity: 0.6 }}><Edit2 size={12} /></button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {[...new Set([...(teamCategories[team] || []), ...(tempCategories[team] || [])])].length === 0 ? (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '5px 0' }}>Sin categorías. Agregue una para registrar jugadores.</p>
                                    ) : (
                                        [...new Set([...(teamCategories[team] || []), ...(tempCategories[team] || [])])].map(cat => (
                                            <div key={cat} style={{ position: 'relative' }}>
                                                <div className="glass-panel" style={{ padding: '10px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', background: 'var(--header-bg)', border: '1px solid var(--glass-border-light)' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setExpandedCategory(expandedCategory?.team === team && expandedCategory?.category === cat ? null : { team, category: cat })}>
                                                        {cat} {expandedCategory?.team === team && expandedCategory?.category === cat ? '▾' : '▸'}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '10px', marginLeft: '5px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
                                                        <button onClick={() => handleOpenQuickRegister(team, cat)} className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 10px' }}><Plus size={14} /> JUGADOR</button>
                                                        <button onClick={() => handleRenameCategory(team, cat)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 0, opacity: 0.3 }}><Edit2 size={12} /></button>
                                                    </div>
                                                </div>

                                                {/* Player List Inline */}
                                                {(expandedCategory?.team === team && expandedCategory?.category === cat) && (
                                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '15px', marginTop: '5px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxHeight: '300px', width: '250px', overflowY: 'auto' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                            <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: 0 }}>Jugadores</h4>
                                                            <button onClick={() => setExpandedCategory(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                                                        </div>
                                                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                                                    <th style={{ padding: '5px', opacity: 0.5 }}>NOMBRE</th>
                                                                    <th style={{ padding: '5px', opacity: 0.5 }}>NUM</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {allUsers.filter(u => {
                                                                    const cats = Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category];
                                                                    return u.team === team && cats.includes(cat);
                                                                }).map(u => (
                                                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                                        <td style={{ padding: '5px', fontWeight: 'bold' }}>{u.name}</td>
                                                                        <td style={{ padding: '5px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                                <input type="text" defaultValue={u.number || ''} onBlur={async (e) => { if (e.target.value !== u.number) await updateUser(u.id, { number: e.target.value }); }} style={{ width: '30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--primary)', fontWeight: 'bold', textAlign: 'center', padding: '2px' }} />
                                                                                <button onClick={() => setCategoryControl({ open: true, user: u, currentCat: cat })} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', opacity: 0.7, padding: '2px' }} title="Mover/Añadir categoría"><ArrowRightLeft size={12} /></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {allUsers.filter(u => {
                                                                    const cats = Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category];
                                                                    return u.team === team && cats.includes(cat);
                                                                }).length === 0 && (
                                                                        <tr><td colSpan="2" style={{ padding: '10px', textAlign: 'center', opacity: 0.5 }}>No hay jugadores</td></tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {selectedTournament && (
                <div style={{ marginTop: '30px' }}>
                    <div className="glass-panel" style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Gestión de {selectedTournament.name}</h2>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '5px' }}>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Administra partidos y registra jugadores directamente</p>
                                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '5px', color: 'var(--primary)' }}>{selectedTournament.category}</span>
                                </div>
                                {selectedTournament.winner ? (
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontWeight: 'bold' }}>
                                        <Trophy size={16} /> CAMPEÓN: {selectedTournament.winner.toUpperCase()}
                                        <button onClick={() => {
                                            if (confirm("¿Quitar campeón?")) updateTournament(selectedTournament.id, { winner: null });
                                        }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.6rem', cursor: 'pointer' }}>[X]</button>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '10px' }}>
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value && confirm(`¿Confirmar a ${e.target.value} como campeón?`)) {
                                                    updateTournament(selectedTournament.id, { winner: e.target.value });
                                                }
                                            }}
                                            style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', color: '#fbbf24', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            <option value="">+ ASIGNAR CAMPEÓN</option>
                                            {[...availableTeams, ...tempTeams].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowNewMatch(true)} className="glass-button" style={{ background: 'var(--success)', fontSize: '0.8rem' }}><Plus size={18} /> Agregar Encuentro</button>
                        </div>
                        <MatchList tournamentId={selectedTournament.id} onQuickRegister={handleOpenQuickRegister} />
                    </div>
                </div>
            )}

            {/* Modales */}
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

            {showTeamModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '30px', maxWidth: '400px', width: '100%', borderTop: '2px solid var(--primary)', borderRadius: '24px', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
                        <h3>Nuevo Equipo</h3>
                        <input autoFocus className="premium-input" placeholder="Nombre" value={modalInput} onChange={e => setModalInput(e.target.value)} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowTeamModal(false)} className="glass-button button-secondary" style={{ flex: 1 }}>Cerrar</button>
                            <button onClick={handleConfirmAddTeam} className="glass-button" style={{ flex: 1 }}>Agregar</button>
                        </div>
                    </div>
                </div>
            )}

            {showCategoryModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '30px', maxWidth: '400px', width: '100%', borderTop: '2px solid var(--primary)', borderRadius: '24px', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
                        <h3>Nueva Categoría</h3>
                        <input autoFocus className="premium-input" placeholder="Ej: Libre" value={modalInput} onChange={e => setModalInput(e.target.value)} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowCategoryModal({ open: false, team: '' })} className="glass-button button-secondary" style={{ flex: 1 }}>Cerrar</button>
                            <button onClick={handleConfirmAddCategory} className="glass-button" style={{ flex: 1 }}>Agregar</button>
                        </div>
                    </div>
                </div>
            )}

            {renameModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="glass-panel" style={{ padding: '30px', maxWidth: '400px', width: '100%', borderTop: '2px solid #fbbf24' }}>
                        <h3>Renombrar</h3>
                        <input autoFocus className="premium-input" value={renameModal.newValue} onChange={e => setRenameModal({ ...renameModal, newValue: e.target.value })} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setRenameModal({ ...renameModal, open: false })} className="glass-button button-secondary" style={{ flex: 1 }}>Cerrar</button>
                            <button onClick={confirmRename} className="glass-button" style={{ flex: 1, background: '#fbbf24', color: 'black' }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Control de Categorías */}
            {categoryControl.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 7000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '25px', maxWidth: '400px', width: '100%', borderTop: '3px solid var(--primary)', borderRadius: '24px', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Gestionar Categorías</h3>
                            <button onClick={() => setCategoryControl({ open: false, user: null, currentCat: '' })} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', opacity: 0.7 }}>Jugador:</p>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>{categoryControl.user?.name}</div>
                        </div>

                        <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ArrowRightLeft size={14} /> MOVER CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Cambiar "{categoryControl.currentCat}" por:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(teamCategories[categoryControl.user?.team] || []).filter(c => c !== categoryControl.currentCat).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={async () => {
                                            try {
                                                await updateUserCategories(categoryControl.user.id, categoryControl.currentCat, cat, 'move');
                                                setCategoryControl({ open: false, user: null, currentCat: '' });
                                            } catch (error) {
                                                alert("Error al mover categoría: " + error.message);
                                            }
                                        }}
                                        style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(96, 165, 250, 0.3)', background: 'rgba(96, 165, 250, 0.1)', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '15px', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={14} /> AÑADIR A OTRA CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Mantener actual y agregar:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(teamCategories[categoryControl.user?.team] || []).filter(c => {
                                    const userCats = Array.isArray(categoryControl.user?.categories) ? categoryControl.user.categories : [categoryControl.user?.category];
                                    return !userCats.includes(c);
                                }).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={async () => {
                                            try {
                                                await updateUserCategories(categoryControl.user.id, null, cat, 'add');
                                                setCategoryControl({ open: false, user: null, currentCat: '' });
                                            } catch (error) {
                                                alert("Error al añadir categoría: " + error.message);
                                            }
                                        }}
                                        style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', color: 'white', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Plus size={12} /> {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '12px', marginTop: '15px' }}>
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={14} /> ELIMINAR DE ESTA CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Quitar a este jugador de "{categoryControl.currentCat}":</p>
                            <button
                                onClick={async () => {
                                    if (window.confirm(`¿Seguro que quieres quitar a este jugador de la categoría ${categoryControl.currentCat}?`)) {
                                        try {
                                            await updateUserCategories(categoryControl.user.id, categoryControl.currentCat, null, 'remove');
                                            setCategoryControl({ open: false, user: null, currentCat: '' });
                                        } catch (error) {
                                            alert("Error al eliminar categoría: " + error.message);
                                        }
                                    }
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <X size={14} /> QUITAR DE {categoryControl.currentCat.toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const QuickRegisterModal = ({ data, onClose }) => {
    const webcamRef = useRef(null);
    const [formData, setFormData] = useState(data);
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelsReady, setModelsReady] = useState(false);
    const [qualityError, setQualityError] = useState('');
    const [qualityCode, setQualityCode] = useState('');
    const [faceBox, setFaceBox] = useState(null);

    const initModels = async () => {
        setStatus('Iniciando IA...');
        const res = await initHybridEngine();
        if (res.success) {
            setModelsReady(true);
            setStatus('Sistema listo');
        } else {
            setStatus('Error: ' + res.error);
        }
    };

    const handleCapture = async () => {
        if (!webcamRef.current && !uploadedImage) return;
        setLoading(true);
        setStatus('Procesando...');
        try {
            const imageSrc = webcamRef.current.getScreenshot();
            const img = new Image();
            img.src = imageSrc;
            await new Promise((res) => img.onload = res);
            const canvas = document.createElement('canvas');
            canvas.width = 400; canvas.height = 400; // Calidad mejorada
            const ctx = canvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
            const photoUrl = canvas.toDataURL('image/jpeg', 0.8);

            const faceData = await getFaceDataLocal(webcamRef.current.video);
            if (!faceData) throw new Error("No se detecta rostro");

            await saveUser({
                ...formData,
                descriptor: Array.from(faceData.descriptor),
                photo: photoUrl,
                status: 'habilitado',
                createdAt: new Date().toISOString()
            });
            setStatus('¡Éxito!');
            setTimeout(onClose, 1000);
        } catch (error) {
            alert(error.message);
            setStatus('Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (step === 2) {
            if (!modelsReady) initModels();
            interval = setInterval(async () => {
                if (!webcamRef.current?.video || !modelsReady) return;
                const video = webcamRef.current.video;
                try {
                    const mp = await detectFaceMediaPipe(video);
                    if (!mp) {
                        setQualityError('Buscando rostro...');
                        setFaceBox(null);
                    } else {
                        const quality = checkFaceQuality(mp, video);
                        setQualityError(quality.ok ? '¡Listo!' : quality.reason);
                        setQualityCode(quality.ok ? 'OK' : 'ERR');
                        const { originX, originY, width, height } = mp.boundingBox;
                        setFaceBox({ x: (originX / video.videoWidth) * 100, y: (originY / video.videoHeight) * 100, w: (width / video.videoWidth) * 100, h: (height / video.videoHeight) * 100 });
                    }
                } catch (e) { }
            }, 200);
        }
        return () => clearInterval(interval);
    }, [step, modelsReady]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ padding: '30px', maxWidth: '450px', width: '100%', position: 'relative' }}>
                <h2>Registro Rápido</h2>
                {step === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input className="premium-input" placeholder="Nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="premium-input" placeholder="DNI" value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} />
                        <button className="glass-button" onClick={() => setStep(2)}>Siguiente</button>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width="100%" height="300px" style={{ borderRadius: '15px', objectFit: 'cover' }} />
                        <p style={{ margin: '15px 0', color: qualityCode === 'OK' ? '#4ade80' : '#fbbf24' }}>{qualityError}</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="glass-button button-secondary" onClick={() => setStep(1)}>Atrás</button>
                            <button className="glass-button" style={{ background: 'var(--success)' }} onClick={handleCapture} disabled={loading || qualityCode !== 'OK'}>Registrar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MatchList = ({ tournamentId, onQuickRegister }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await getMatches(tournamentId);
            setMatches(data);
            setLoading(false);
        };
        load();
    }, [tournamentId]);

    const calculateMinute = (match) => {
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
                        style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--glass-border-light)', background: 'var(--header-bg)' }}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{m.teamA?.name || 'Equipo A'}</div>
                                    <button
                                        onClick={() => onQuickRegister(m.teamA?.name, m.category || 'Principal')}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                                    >
                                        + REGISTRAR JUGADOR
                                    </button>
                                </div>
                                <span style={{ opacity: 0.2, fontWeight: '900', fontSize: '1.2rem' }}>VS</span>
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{m.teamB?.name || 'Equipo B'}</div>
                                    <button
                                        onClick={() => onQuickRegister(m.teamB?.name, m.category || 'Principal')}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                                    >
                                        + REGISTRAR JUGADOR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Event Summary */}
                        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '0.65rem', opacity: 0.5 }}>
                            <div style={{ flex: 1, textAlign: 'right' }}>
                                {(m.events || []).filter(e => e.teamSide === 'A' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                    <span key={e.id} style={{ marginLeft: '8px' }}>{e.player} ({e.time})</span>
                                ))}
                            </div>
                            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ flex: 1 }}>
                                {(m.events || []).filter(e => e.teamSide === 'B' && (e.type === 'goal' || e.type.includes('card'))).map(e => (
                                    <span key={e.id} style={{ marginRight: '8px' }}>{e.player} ({e.time})</span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '5px' }}>{m.category}</span>
                            <div className="status-badge" style={{
                                fontSize: '0.7rem',
                                background: (m.status || 'programado') === 'programado' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                color: (m.status || 'programado') === 'programado' ? '#60a5fa' : '#4ade80'
                            }}>{(m.status || 'PROGRAMADO').toUpperCase()}</div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default Equipos;
