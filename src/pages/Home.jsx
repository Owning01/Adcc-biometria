import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getUsers, deleteUser, clearAllUsers, updateUserStatus, subscribeToUsers, saveUser, checkDniExists, updateTeamName, updateTeamCategory, updateUser, updateUserCategories } from '../services/db';
import Webcam from 'react-webcam';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { getFaceDataLocal } from '../services/faceServiceLocal';
import { createMatcher } from '../services/faceService';
import {
    Trash2, ShieldCheck, Users as UsersIcon, Trophy, CreditCard,
    ChevronRight, LayoutGrid, HardDrive, AlertCircle, ArrowLeft,
    Filter, ShieldAlert, RefreshCw as RefreshIcon, Search, UserMinus,
    AlertCircle as WarningIcon, X as CloseIcon, Check as SuccessIcon,
    UserCircle, Zap, Plus, RefreshCw, X, ArrowRightLeft, UserPlus
} from 'lucide-react';
import adccLogo from '../Applogo.png';

const Home = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [remoteVersion, setRemoteVersion] = useState('...');
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modales
    const [deleteModal, setDeleteModal] = useState({ open: false, userId: null, userName: '' });
    const [nuclearModal, setNuclearModal] = useState(false);
    const [nuclearConfirm, setNuclearConfirm] = useState('');

    // Modales de Gestión Rápida
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState({ open: false, team: '' });
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterData, setQuickRegisterData] = useState({ name: '', dni: '', team: '', category: '' });
    const [modalInput, setModalInput] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [categoryControl, setCategoryControl] = useState({ open: false, user: null, currentCat: '' });

    useEffect(() => {
        // Fetch version para el boton
        fetch('https://recofacial-7cea1.web.app/version.json?t=' + Date.now())
            .then(res => res.json())
            .then(data => setRemoteVersion(data.android.version))
            .catch(() => setRemoteVersion('Error'));

        setLoading(true);
        const unsubscribe = subscribeToUsers((data) => {
            setUsers(data || []);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const execDelete = async () => {
        const id = deleteModal.userId;
        setDeleteModal({ open: false, userId: null, userName: '' });

        try {
            await deleteUser(id);
            // La actualización visual ocurre sola vía subscribeToUsers
        } catch (error) {
            alert("Error al eliminar en el servidor");
        }
    };

    const handleToggleStatus = async (user, categoryOverride = null) => {
        // Determinamos para qué categoría estamos cambiando el estado
        const cat = categoryOverride || selectedCategory || (Array.isArray(user.categories) && user.categories.length > 0 ? user.categories[0] : user.category);

        // Obtenemos el estado actual para esa categoría específica
        const currentStatus = (user.categoryStatuses && user.categoryStatuses[cat]) || user.status || 'habilitado';
        const newStatus = currentStatus === 'habilitado' ? 'deshabilitado' : 'habilitado';

        try {
            await updateUserStatus(user.id, newStatus, cat);
        } catch (error) {
            alert("Error al actualizar estado");
        }
    };

    const execNuclearDelete = async () => {
        if (nuclearConfirm === 'ELIMINAR') {
            setLoading(true);
            setNuclearModal(false);
            setNuclearConfirm('');
            try {
                await clearAllUsers();
                setUsers([]);
                setSelectedTeam(null);
                setSelectedCategory(null);
            } catch (error) {
                alert("Error masivo");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleConfirmAddTeam = () => {
        const teamName = modalInput.trim();
        if (!teamName) return;
        if (teams.some(t => t.toLowerCase() === teamName.toLowerCase())) {
            alert("El equipo ya existe");
            return;
        }
        setSelectedTeam(teamName);
        setShowTeamModal(false);
        setModalInput('');
    };

    const handleConfirmAddCategory = () => {
        const catName = modalInput.trim();
        if (!catName) return;
        setSelectedCategory(catName);
        setShowCategoryModal({ open: false, team: '' });
        setModalInput('');
    };

    const handleOpenQuickRegister = (team, category) => {
        setQuickRegisterData({ name: '', dni: '', team, category });
        setShowQuickRegister(true);
    };

    const teams = [...new Set(users.map(u => u.team))].filter(Boolean).sort();
    const categoriesForTeam = selectedTeam
        ? [...new Set([
            ...users.filter(u => u.team === selectedTeam).flatMap(u => {
                const cats = Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category];
                return cats;
            }),
            selectedCategory // Asegurar que la categoría actual (incluso si está vacía) esté en la lista
        ])].filter(Boolean).sort()
        : [];
    const filteredUsers = users.filter(u => {
        const searchLower = searchTerm.toLowerCase();
        const cats = Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category];

        if (searchTerm) {
            return (
                u.name.toLowerCase().includes(searchLower) ||
                (u.dni && u.dni.toLowerCase().includes(searchLower)) ||
                (u.team && u.team.toLowerCase().includes(searchLower)) ||
                cats.some(c => c && c.toLowerCase().includes(searchLower))
            );
        }

        if (u.team !== selectedTeam) return false;
        return cats.includes(selectedCategory);
    });

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '30px', textAlign: 'center', position: 'relative' }}>
                <img src={adccLogo} alt="ADCC" style={{ width: '80px', marginBottom: '10px' }} />
                <h1 style={{ fontSize: '2.2rem', margin: 0, fontWeight: '800' }}>
                    ADCC <span style={{ color: 'var(--primary)' }}>Biometría</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gestión de accesos y registros</p>

                <button onClick={() => setNuclearModal(true)} className="nuclear-btn-minimal">
                    <Trash2 size={12} /> REINICIAR TODO
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                <StatCard title="Total Registros" value={users.length} color="#3b82f6" icon={<UsersIcon />} />
                <StatCard title="Clubes" value={teams.length} color="#10b981" icon={<Trophy />} />
                <StatCard title="Observados" value={users.filter(u => (u.status === 'deshabilitado' || (u.categoryStatuses && Object.values(u.categoryStatuses).includes('deshabilitado')))).length} color="#ef4444" icon={<ShieldAlert />} />
            </div>



            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LayoutGrid size={14} color="var(--primary)" />
                        <span onClick={() => { setSelectedTeam(null); setSelectedCategory(null); }} style={{ cursor: 'pointer', color: !selectedTeam ? 'var(--primary)' : 'inherit', fontWeight: !selectedTeam ? '800' : 'normal' }}>Equipos / Categoría / Jugadores</span>
                        {selectedTeam && (
                            <>
                                <ChevronRight size={12} opacity={0.5} />
                                <span onClick={() => setSelectedCategory(null)} style={{ cursor: 'pointer', color: !selectedCategory ? 'var(--primary)' : 'inherit', fontWeight: !selectedCategory ? '800' : 'normal' }}>{selectedTeam.toUpperCase()}</span>
                            </>
                        )}
                        {selectedCategory && (
                            <>
                                <ChevronRight size={12} opacity={0.5} />
                                <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{selectedCategory.toUpperCase()}</span>
                            </>
                        )}
                    </div>
                    {!selectedTeam && (
                        <button
                            onClick={() => { setModalInput(''); setShowTeamModal(true); }}
                            className="glass-button"
                            style={{ padding: '5px 12px', fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--success)' }}
                        >
                            <Plus size={14} /> NUEVO EQUIPO
                        </button>
                    )}
                </div>

                <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        <input
                            type="text"
                            placeholder="Buscar por Nombre, DNI, Equipo o Categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '10px 12px 10px 35px',
                                color: 'white',
                                fontSize: '0.85rem',
                                outline: 'none'
                            }}
                        />
                        {searchTerm && (
                            <X size={14} onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.6 }} />
                        )}
                    </div>
                </div>

                <div style={{ padding: '20px', minHeight: '300px' }}>
                    {searchTerm ? (
                        /* BÚSQUEDA ACTIVA: Mostrar tabla directamente */
                        <div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>JUGADOR</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>EQUIPO</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>NO.</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>DNI</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>CATEGORÍAS</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>ESTADO</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5, textAlign: 'right' }}>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        {u.photo ? (
                                                            <div
                                                                onClick={() => setPreviewImage(u.photo)}
                                                                style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}
                                                            >
                                                                <img src={u.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : (
                                                            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                                <UserCircle size={22} opacity={0.2} />
                                                            </div>
                                                        )}
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>{u.name}</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px', fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{u.team?.toUpperCase()}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <input
                                                        type="text"
                                                        defaultValue={u.number || ''}
                                                        placeholder="--"
                                                        onBlur={async (e) => {
                                                            const newNum = e.target.value;
                                                            if (newNum !== u.number) {
                                                                await updateUser(u.id, { number: newNum });
                                                            }
                                                        }}
                                                        style={{
                                                            width: '40px',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '5px',
                                                            color: 'var(--primary)',
                                                            textAlign: 'center',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '800',
                                                            padding: '4px'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', fontSize: '0.85rem', opacity: 0.7 }}>{u.dni}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {(Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category]).map(c => {
                                                            const catStatus = (u.categoryStatuses && u.categoryStatuses[c]) || u.status || 'habilitado';
                                                            const isDeshabilitado = catStatus === 'deshabilitado';
                                                            return (
                                                                <span
                                                                    key={c}
                                                                    onClick={() => handleToggleStatus(u, c)}
                                                                    style={{
                                                                        fontSize: '0.65rem',
                                                                        background: isDeshabilitado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                        color: isDeshabilitado ? '#f87171' : '#60a5fa',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        border: `1px solid ${isDeshabilitado ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isDeshabilitado ? '#ef4444' : '#60a5fa' }}></div>
                                                                    {c}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <StatusBadge
                                                        status={selectedCategory ? ((u.categoryStatuses && u.categoryStatuses[selectedCategory]) || u.status || 'habilitado') : (u.status || 'habilitado')}
                                                        onClick={() => handleToggleStatus(u)}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => setCategoryControl({ open: true, user: u, currentCat: selectedCategory })}
                                                            className="category-manage-btn"
                                                            title="Mover o añadir categoría"
                                                        >
                                                            <ArrowRightLeft size={16} />
                                                        </button>
                                                        <button onClick={() => setDeleteModal({ open: true, userId: u.id, userName: u.name })} className="delete-row-btn">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredUsers.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No se encontraron resultados para "{searchTerm}"
                                </div>
                            )}
                        </div>
                    ) : !selectedTeam ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                            {teams.map(team => (
                                <div key={team} className="admin-nav-item" style={{ position: 'relative' }}>
                                    <div onClick={() => setSelectedTeam(team)}>
                                        <Trophy size={28} color="var(--primary)" />
                                        <div style={{ marginTop: '10px', fontWeight: '800', fontSize: '0.9rem' }}>{team.toUpperCase()}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{users.filter(u => u.team === team).length} Jugadores</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setModalInput(''); setShowCategoryModal({ open: true, team }); }}
                                        style={{ marginTop: '15px', width: '100%', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '5px', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        + CATEGORÍA
                                    </button>
                                </div>
                            ))}
                            {teams.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay datos registrados aún.</p>}
                        </div>
                    ) : !selectedCategory ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
                            {categoriesForTeam.map(cat => (
                                <div key={cat} className="admin-nav-item" style={{ borderColor: 'var(--primary)', background: 'rgba(59, 130, 246, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div onClick={() => setSelectedCategory(cat)} style={{ cursor: 'pointer' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--primary)' }}>{cat}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '5px' }}>CATEGORÍA</div>
                                    </div>
                                    <button
                                        onClick={() => handleOpenQuickRegister(selectedTeam, cat)}
                                        style={{ marginTop: '15px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        + JUGADOR
                                    </button>
                                </div>
                            ))}
                            <div className="admin-nav-item" style={{ borderStyle: 'dashed', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setModalInput(''); setShowCategoryModal({ open: true, team: selectedTeam }); }}>
                                <Plus size={24} />
                                <div style={{ fontSize: '0.7rem', fontWeight: '700', marginTop: '5px' }}>NUEVA CATEGORÍA</div>
                            </div>
                            <button onClick={() => setSelectedTeam(null)} className="glass-button" style={{ gridColumn: '1/-1', marginTop: '10px' }}>
                                <ArrowLeft size={14} /> VOLVER A EQUIPOS
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>JUGADOR</th>
                                            {searchTerm && <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>EQUIPO</th>}
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>NO.</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>DNI</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>CATEGORÍAS</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>ESTADO</th>
                                            <th style={{ padding: '10px', fontSize: '0.7rem', opacity: 0.5, textAlign: 'right' }}>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        {u.photo ? (
                                                            <div
                                                                onClick={() => setPreviewImage(u.photo)}
                                                                style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}
                                                            >
                                                                <img src={u.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : (
                                                            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                                <UserCircle size={22} opacity={0.2} />
                                                            </div>
                                                        )}
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>{u.name}</div>
                                                    </div>
                                                </td>
                                                {searchTerm && <td style={{ padding: '10px', fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{u.team?.toUpperCase()}</td>}
                                                <td style={{ padding: '10px' }}>
                                                    <input
                                                        type="text"
                                                        defaultValue={u.number || ''}
                                                        placeholder="--"
                                                        onBlur={async (e) => {
                                                            const newNum = e.target.value;
                                                            if (newNum !== u.number) {
                                                                await updateUser(u.id, { number: newNum });
                                                            }
                                                        }}
                                                        style={{
                                                            width: '40px',
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '5px',
                                                            color: 'var(--primary)',
                                                            textAlign: 'center',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '800',
                                                            padding: '4px'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', fontSize: '0.85rem', opacity: 0.7 }}>{u.dni}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {(Array.isArray(u.categories) && u.categories.length > 0 ? u.categories : [u.category]).map(c => {
                                                            const catStatus = (u.categoryStatuses && u.categoryStatuses[c]) || u.status || 'habilitado';
                                                            const isDeshabilitado = catStatus === 'deshabilitado';
                                                            return (
                                                                <span
                                                                    key={c}
                                                                    onClick={() => handleToggleStatus(u, c)}
                                                                    style={{
                                                                        fontSize: '0.65rem',
                                                                        background: isDeshabilitado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                        color: isDeshabilitado ? '#f87171' : '#60a5fa',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        border: `1px solid ${isDeshabilitado ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isDeshabilitado ? '#ef4444' : '#60a5fa' }}></div>
                                                                    {c}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <StatusBadge
                                                        status={selectedCategory ? ((u.categoryStatuses && u.categoryStatuses[selectedCategory]) || u.status || 'habilitado') : (u.status || 'habilitado')}
                                                        onClick={() => handleToggleStatus(u)}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => setCategoryControl({ open: true, user: u, currentCat: selectedCategory })}
                                                            className="category-manage-btn"
                                                            title="Mover o añadir categoría"
                                                        >
                                                            <ArrowRightLeft size={16} />
                                                        </button>
                                                        <button onClick={() => setDeleteModal({ open: true, userId: u.id, userName: u.name })} className="delete-row-btn">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button onClick={() => setSelectedCategory(null)} className="glass-button" style={{ marginTop: '20px', width: '100%' }}>
                                <ArrowLeft size={14} /> VOLVER A CATEGORÍAS
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modales Profesionales */}
            {
                deleteModal.open && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <WarningIcon size={32} color="#f87171" style={{ marginBottom: '15px' }} />
                            <h3 style={{ margin: '0 0 10px 0' }}>Eliminar Jugador</h3>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '20px' }}>¿Deseas eliminar a <strong>{deleteModal.userName}</strong>?</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setDeleteModal({ open: false, userId: null, userName: '' })} className="glass-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>CANCELAR</button>
                                <button onClick={execDelete} className="glass-button" style={{ flex: 1, background: '#ef4444' }}>ELIMINAR</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                nuclearModal && (
                    <div className="modal-overlay">
                        <div className="modal-card" style={{ maxWidth: '380px' }}>
                            <Trash2 size={40} color="#ef4444" style={{ marginBottom: '15px' }} />
                            <h3 style={{ margin: '0 0 5px 0', color: '#ef4444' }}>RESET TOTAL</h3>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '15px' }}>Escribe <strong>'ELIMINAR'</strong> para confirmar el borrado total de la base de datos:</p>
                            <input value={nuclearConfirm} onChange={(e) => setNuclearConfirm(e.target.value.toUpperCase())} className="premium-input" style={{ textAlign: 'center', marginBottom: '20px' }} autoFocus />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setNuclearModal(false)} className="glass-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>SALIR</button>
                                <button onClick={execNuclearDelete} disabled={nuclearConfirm !== 'ELIMINAR'} className="glass-button" style={{ flex: 1, background: '#ef4444', opacity: nuclearConfirm === 'ELIMINAR' ? 1 : 0.3 }}>CONFIRMAR</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modales de Gestión Rápida */}
            {showTeamModal && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-card" style={{ borderTop: '2px solid var(--primary)' }}>
                        <h3 style={{ marginBottom: '20px' }}>Nuevo Equipo</h3>
                        <input autoFocus className="premium-input" placeholder="Nombre" value={modalInput} onChange={e => setModalInput(e.target.value)} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowTeamModal(false)} className="glass-button button-secondary" style={{ flex: 1 }}>Cerrar</button>
                            <button onClick={handleConfirmAddTeam} className="glass-button" style={{ flex: 1 }}>Agregar</button>
                        </div>
                    </div>
                </div>
            )}

            {showCategoryModal.open && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-card" style={{ borderTop: '2px solid var(--primary)' }}>
                        <h3 style={{ marginBottom: '5px' }}>Nueva Categoría</h3>
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '15px' }}>Equipo: {showCategoryModal.team}</p>
                        <input autoFocus className="premium-input" placeholder="Nombre (ej: Libre)" value={modalInput} onChange={e => setModalInput(e.target.value)} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowCategoryModal({ open: false, team: '' })} className="glass-button button-secondary" style={{ flex: 1 }}>Cerrar</button>
                            <button onClick={handleConfirmAddCategory} className="glass-button" style={{ flex: 1 }}>Agregar</button>
                        </div>
                    </div>
                </div>
            )}

            {showQuickRegister && (
                <QuickRegisterModal
                    data={quickRegisterData}
                    onClose={() => setShowQuickRegister(false)}
                />
            )}

            {/* Modal de Previsualización de Imagen */}
            {previewImage && (
                <div
                    className="modal-overlay"
                    style={{ zIndex: 6000, background: 'rgba(0,0,0,0.95)' }}
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        style={{
                            position: 'relative',
                            maxWidth: '90vw',
                            maxHeight: '80vh',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            background: '#000'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewImage(null)}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <CloseIcon size={20} />
                        </button>
                        <img
                            src={previewImage}
                            alt="Preview"
                            style={{
                                display: 'block',
                                width: '100%',
                                height: 'auto',
                                maxHeight: '80vh',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Control de Categorías */}
            {categoryControl.open && (
                <div className="modal-overlay" style={{ zIndex: 7000 }}>
                    <div className="modal-card" style={{ maxWidth: '400px', borderTop: '3px solid var(--primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Gestionar Categorías</h3>
                            <button onClick={() => setCategoryControl({ open: false, user: null, currentCat: '' })} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', opacity: 0.7 }}>Jugador:</p>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>{categoryControl.user?.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>DNI: {categoryControl.user?.dni}</div>
                        </div>

                        <div className="category-control-section">
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ArrowRightLeft size={14} /> MOVER CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Cambiar "{categoryControl.currentCat}" por:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {categoriesForTeam.filter(c => c !== categoryControl.currentCat).map(cat => (
                                    <button
                                        key={cat}
                                        className="cat-pill-btn move"
                                        onClick={async () => {
                                            try {
                                                await updateUserCategories(categoryControl.user.id, categoryControl.currentCat, cat, 'move');
                                                setCategoryControl({ open: false, user: null, currentCat: '' });
                                            } catch (error) {
                                                alert("Error al mover categoría: " + error.message);
                                            }
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="category-control-section" style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={14} /> AÑADIR A OTRA CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Mantener actual y agregar:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {categoriesForTeam.filter(c => {
                                    const userCats = Array.isArray(categoryControl.user?.categories) ? categoryControl.user.categories : [categoryControl.user?.category];
                                    return !userCats.includes(c);
                                }).map(cat => (
                                    <button
                                        key={cat}
                                        className="cat-pill-btn add"
                                        onClick={async () => {
                                            try {
                                                await updateUserCategories(categoryControl.user.id, null, cat, 'add');
                                                setCategoryControl({ open: false, user: null, currentCat: '' });
                                            } catch (error) {
                                                alert("Error al añadir categoría: " + error.message);
                                            }
                                        }}
                                    >
                                        <Plus size={12} /> {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="category-control-section" style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={14} /> ELIMINAR DE ESTA CATEGORÍA
                            </h4>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>Quitar a este jugador de "{categoryControl.currentCat}":</p>
                            <button
                                className="cat-pill-btn remove-current"
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
                            >
                                <X size={12} /> QUITAR DE {categoryControl.currentCat.toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .admin-nav-item {
                    padding: 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.08);
                    background: rgba(255,255,255,0.02); text-align: center; cursor: pointer; transition: none;
                }
                .admin-nav-item:hover { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
                
                .nuclear-btn-minimal {
                    position: absolute; top: 0; right: 0; padding: 6px 12px; font-size: 0.65rem; font-weight: 800;
                    background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; cursor: pointer;
                    display: flex; alignItems: center; gap: 5px;
                }
                
                .delete-row-btn {
                    padding: 8px; border-radius: 8px; border: none; background: rgba(239, 68, 68, 0.1); color: #f87171; cursor: pointer; transition: none;
                }
                .category-manage-btn {
                    padding: 8px; border-radius: 8px; border: none; background: rgba(59, 130, 246, 0.1); color: #60a5fa; cursor: pointer; transition: none;
                }
                .category-manage-btn:hover { background: rgba(59, 130, 246, 0.2); }
                
                .cat-pill-btn {
                    padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
                    color: white; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
                    display: flex; alignItems: center; gap: 5px;
                }
                .cat-pill-btn.move:hover { border-color: #60a5fa; background: rgba(96, 165, 250, 0.1); color: #60a5fa; }
                .cat-pill-btn.add:hover { border-color: #10b981; background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .cat-pill-btn.remove-current { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); color: #f87171; width: 100%; justify-content: center; }
                .cat-pill-btn.remove-current:hover { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }

                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(2, 6, 23, 0.85);
                    display: flex; align-items: center; justify-content: center; z-index: 2000;
                }
                .modal-card {
                    background: #0f172a; border: 1px solid rgba(255,255,255,0.1); padding: 25px; border-radius: 20px; text-align: center; width: 90%; max-width: 320px;
                }
                
                .animate-fade-in { animation: none; opacity: 1; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .animate-spin { animation: spin 2s linear infinite; }
            `}</style>
        </div >
    );
};

const StatCard = ({ title, value, color, icon }) => (
    <div className="glass-panel" style={{ padding: '15px 20px', borderLeft: `3px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'none' }}>
        <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h4>
            <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900' }}>{value}</p>
        </div>
        <div style={{ color, opacity: 0.3 }}>{React.cloneElement(icon, { size: 24 })}</div>
    </div>
);

const QuickRegisterModal = ({ data, onClose }) => {
    const webcamRef = useRef(null);
    const [formData, setFormData] = useState(data);
    const [step, setStep] = useState(1); // 1: Form, 2: Camera
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
        if (!webcamRef.current) return;

        if (!formData.name || !formData.dni) {
            alert("Completa nombre y DNI");
            return;
        }

        const dniExists = await checkDniExists(formData.dni);
        if (dniExists) {
            alert(`El DNI ${formData.dni} ya está registrado.`);
            return;
        }

        setLoading(true);
        setStatus('Procesando...');

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) throw new Error("No hay imagen");

            const img = new Image();
            img.src = imageSrc;
            await new Promise((res) => img.onload = res);

            const canvas = document.createElement('canvas');
            canvas.width = 400; canvas.height = 400;
            const ctx = canvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
            const photoUrl = canvas.toDataURL('image/jpeg', 0.8);

            const faceData = await getFaceDataLocal(webcamRef.current.video);
            if (!faceData) throw new Error("No se detecta rostro claramente");

            const allUsers = await getUsers(true);
            if (allUsers.length > 0) {
                const matcher = createMatcher(allUsers);
                if (matcher) {
                    const bestMatch = matcher.findBestMatch(new Float32Array(faceData.descriptor));
                    if (bestMatch.label !== 'unknown') {
                        const matched = allUsers.find(u => u.id === bestMatch.label);
                        throw new Error(`Ya registrado como: ${matched.name}`);
                    }
                }
            }

            await saveUser({
                ...formData,
                descriptor: Array.from(faceData.descriptor),
                photo: photoUrl,
                status: 'habilitado',
                categoryStatuses: { [formData.category]: 'habilitado' },
                createdAt: new Date().toISOString()
            });

            setStatus('¡Registrado con éxito!');
            setTimeout(onClose, 1200);
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
                if (video.readyState !== 4) return;

                try {
                    const mp = await detectFaceMediaPipe(video);
                    if (!mp) {
                        setQualityError('Buscando rostro...');
                        setQualityCode('NO_FACE');
                        setFaceBox(null);
                    } else {
                        const quality = checkFaceQuality(mp, video);
                        setQualityError(quality.ok ? '¡Rostro listo!' : quality.reason);
                        setQualityCode(quality.ok ? 'OK' : quality.code);

                        const { originX, originY, width, height } = mp.boundingBox;
                        setFaceBox({
                            x: (originX / video.videoWidth) * 100,
                            y: (originY / video.videoHeight) * 100,
                            w: (width / video.videoWidth) * 100,
                            h: (height / video.videoHeight) * 100
                        });
                    }
                } catch (e) {
                    console.error("Error en loop de detección:", e);
                }
            }, 200);
        }
        return () => clearInterval(interval);
    }, [step, modelsReady]);

    return (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.92)', zIndex: 5000, padding: '10px' }}>
            <div className="modal-card" style={{ maxWidth: '400px', width: '100%', position: 'relative', padding: '25px' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'white', opacity: 0.5 }}>
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Registro Rápido</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    {formData.team} | <span style={{ color: 'var(--primary)' }}>{formData.category}</span>
                </p>

                {step === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input className="premium-input" placeholder="Nombre y Apellido" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="premium-input" type="number" placeholder="DNI" value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} />
                        <button className="glass-button" style={{ background: 'var(--primary)' }} onClick={() => setStep(2)} disabled={!formData.name || !formData.dni}>CONTINUAR</button>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '15px', overflow: 'hidden', background: '#000', marginBottom: '15px', border: `2px solid ${qualityCode === 'OK' ? '#22c55e' : qualityCode === 'NO_FACE' ? 'rgba(255,255,255,0.1)' : '#f59e0b'}` }}>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                width="100%"
                                height="100%"
                                videoConstraints={{ facingMode: 'user' }}
                                style={{ objectFit: 'cover' }}
                            />
                            {faceBox && (
                                <div className="face-box-overlay">
                                    <div
                                        className={`face-box ${qualityCode !== 'OK' ? 'invalid' : ''} ${loading ? 'processing' : ''}`}
                                        style={{
                                            left: `${faceBox.x}%`,
                                            top: `${faceBox.y}%`,
                                            width: `${faceBox.w}%`,
                                            height: `${faceBox.h}%`
                                        }}
                                    >
                                        <div className="face-box-corner tl"></div>
                                        <div className="face-box-corner tr"></div>
                                        <div className="face-box-corner bl"></div>
                                        <div className="face-box-corner br"></div>
                                        {qualityCode === 'OK' && !loading && <div className="face-box-scan-line"></div>}
                                    </div>
                                </div>
                            )}
                            {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><RefreshCw className="animate-spin" size={32} /></div>}
                        </div>
                        <div style={{
                            padding: '12px',
                            borderRadius: '12px',
                            background: qualityCode === 'OK' ? 'rgba(34, 197, 94, 0.15)' : qualityCode === 'NO_FACE' ? 'rgba(255,255,255,0.05)' : 'rgba(245, 158, 11, 0.15)',
                            color: qualityCode === 'OK' ? '#4ade80' : qualityCode === 'NO_FACE' ? '#94a3b8' : '#fbbf24',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            marginBottom: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            border: `1px solid ${qualityCode === 'OK' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)'}`
                        }}>
                            {qualityCode === 'OK' && <SuccessIcon size={16} />}
                            {qualityCode === 'DISTANCE_TOO_FAR' && <Zap size={16} />}
                            {qualityCode === 'DISTANCE_TOO_CLOSE' && <AlertCircle size={16} />}
                            {status === '¡Registrado con éxito!' ? status : (qualityCode === 'DISTANCE_TOO_FAR' ? 'Acércate más a la cámara' : qualityError)}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="glass-button button-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>ATRÁS</button>
                            <button className="glass-button" style={{
                                flex: 2,
                                background: qualityCode === 'OK' ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                                borderColor: qualityCode === 'OK' ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                                color: qualityCode === 'OK' ? 'white' : 'rgba(255,255,255,0.3)',
                                opacity: qualityCode === 'OK' ? 1 : 0.6
                            }} onClick={handleCapture} disabled={loading || qualityCode !== 'OK'}>
                                {loading ? 'PROCESANDO...' : 'REGISTRAR'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusBadge = ({ status, onClick }) => (
    <span
        onClick={onClick}
        style={{
            padding: '3px 8px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '800',
            background: status === 'habilitado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: status === 'habilitado' ? '#10b981' : '#f87171',
            border: `1px solid ${status === 'habilitado' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase'
        }}
    >
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: status === 'habilitado' ? '#10b981' : '#f87171' }}></div>
        {status}
    </span>
);

export default Home;
