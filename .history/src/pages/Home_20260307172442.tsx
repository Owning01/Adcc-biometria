/**
 * @file Home.jsx
 * @description Componente principal de la aplicación. Gestiona la vista del dashboard,
 * listado de usuarios, visualización de partidos, gestión de equipos/categorías
 * y registro rápido con reconocimiento facial.
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import QuickRegisterModal from "../components/QuickRegisterModal";
import {
    getUsers,
    deleteUser,
    clearAllUsers,
    updateUserStatus,
    subscribeToUsers,
    saveUser,
    checkDniExists,
    updateTeamName,
    updateTeamCategory,
    deletePlayersByTeam,
    updateUser,
    updateUserCategories,
    subscribeToUsersByTeam,
    subscribeToUsersByCategory,
    searchUsersServerSide,
    getUserCount,
} from "../services/db";
import { subscribeToMatches } from "../services/matchesService";
import { subscribeToTeams, Team, deleteTeam } from "../services/teamsService";
import { syncADCCData, syncMatchDayData } from "../services/syncService";
import { getAdccImageUrl } from "../utils/imageUtils";
import Webcam from "react-webcam";
import {
    initHybridEngine,
    checkFaceQuality,
} from "../services/hybridFaceService";
import { detectFaceMediaPipe } from "../services/mediapipeService";
import { getFaceDataLocal } from "../services/faceServiceLocal";
import { createMatcher } from "../services/faceService";
import {
    Trash2,
    ShieldCheck,
    Users as UsersIcon,
    Shield,
    CreditCard,
    ChevronRight,
    LayoutGrid,
    HardDrive,
    AlertCircle,
    ArrowLeft,
    Filter,
    ShieldAlert,
    RefreshCw as RefreshIcon,
    Search,
    UserMinus,
    AlertCircle as WarningIcon,
    X as CloseIcon,
    Check as SuccessIcon,
    UserCircle,
    Zap,
    Plus,
    RefreshCw,
    X,
    ArrowRightLeft,
    UserPlus,
    Calendar,
    Clock,
    Activity,
    SwitchCamera,
    Lightbulb,
    Camera,
    Upload,
    Download,
    ArrowRight,
    ScanFace,
    QrCode
} from "lucide-react";
import releaseInfo from '../release.json';
import adccLogo from "../Applogo.webp";

// ============================================================================
// 1. HELPER COMPONENTS (Cards, Badges)
// ============================================================================

interface DashboardCardProps {
    title: string;
    value: string | number;
    color: string;
    icon: React.ReactNode;
}

const DashboardCard = React.memo(({ title, value, color, icon }: DashboardCardProps) => (
    <div className="stat-card-premium" style={{ '--accent-color': color } as React.CSSProperties}>
        <div className="stat-card-icon-wrapper">
            {icon}
        </div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{title}</div>
    </div>
));

interface StatusBadgeProps {
    status: string;
    onClick?: (e: React.MouseEvent) => void;
}

const StatusBadge = React.memo(({ status, onClick }: StatusBadgeProps) => {
    const isEnabled = status?.toLowerCase() === "habilitado";
    return (
        <span
            onClick={onClick}
            className={isEnabled ? "status-badge-isEnabled" : "status-badge-isDisabled"}
            style={{ cursor: onClick ? "pointer" : "default" }}
        >
            {isEnabled ? (
                <>
                    <ShieldCheck size={10} /> HABILITADO
                </>
            ) : (
                <>
                    <ShieldAlert size={10} /> BLOQUEADO
                </>
            )}
        </span>
    );
});

const TeamCard = React.memo(({ team, teamsMetadata, isAdminOrDev, onSelect, onDelete }: {
    team: string,
    teamsMetadata: Team[],
    isAdminOrDev: boolean,
    onSelect: () => void,
    onDelete: (name: string, id: string) => Promise<void>
}) => {
    const teamData = teamsMetadata.find(t => t.name === team || t.id === team.toLowerCase().replace(/\s+/g, '-'));
    return (
        <div
            onClick={onSelect}
            className="team-card-rectangular-premium"
        >
            <div className="team-logo-wrapper">
                {teamData?.logoUrl ? (
                    <img src={getAdccImageUrl(teamData.logoUrl)} alt={team} className="team-logo-img" onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Team')} />
                ) : teamData?.adccLogoUrl ? (
                    <img src={getAdccImageUrl(teamData.adccLogoUrl)} alt={team} className="team-logo-img" onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Team')} />
                ) : (
                    <div className="text-primary opacity-60">
                        <UsersIcon size={30} />
                    </div>
                )}
            </div>
            <div style={{ flex: 1 }}>
                <h4 className="team-info-name">{team}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className="team-tag-view">
                        VER JUGADORES
                    </span>
                </div>
            </div>
            <ChevronRight size={20} className="text-muted opacity-30" />

            {isAdminOrDev && (
                <button
                    onClick={async (e) => {
                        e.stopPropagation();
                        const password = window.prompt("Ingrese contraseña para eliminar el equipo y todos sus jugadores:");
                        if (password === "44583") {
                            if (window.confirm(`¿Está ABSOLUTAMENTE SEGURO de eliminar el equipo "${team}" y todos sus jugadores registrados? Esta acción no se puede deshacer.`)) {
                                const teamId = teamData?.id || team.toLowerCase().replace(/\s+/g, '-');
                                await onDelete(team, teamId);
                            }
                        } else if (password !== null) {
                            alert("Contraseña incorrecta");
                        }
                    }}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors ml-auto"
                    title="Eliminar Equipo y Jugadores"
                    style={{ zIndex: 10 }}
                >
                    <Trash2 size={18} />
                </button>
            )}
        </div>
    );
});

const PlayerSearchResults = React.memo(({ playerSearch, setPlayerSearch, users, setSelectedTeam, isUsuario }: {
    playerSearch: string,
    setPlayerSearch: (val: string) => void,
    users: any[],
    setSelectedTeam: (val: string | null) => void,
    isUsuario: boolean
}) => {
    if (playerSearch.trim().length < 2) return null;
    const q = playerSearch.trim().toLowerCase();
    const results = users.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.dni?.toString().includes(q)
    ).slice(0, 5);

    if (results.length === 0) {
        return (
            <div style={{ marginTop: '6px', padding: '10px 14px', fontSize: '0.75rem', opacity: 0.5, textAlign: 'center' }}>
                Sin resultados
            </div>
        );
    }

    return (
        <div style={{
            marginTop: '6px',
            background: 'rgba(10,10,20,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'absolute',
            left: '16px', right: '16px',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
            {results.map(u => (
                <div
                    key={u.id}
                    onClick={() => { setSelectedTeam(u.team); setPlayerSearch(''); }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    {u.photo ? (
                        <img src={getAdccImageUrl(u.photo)} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => (e.currentTarget.src = 'https://placehold.co/30x30?text=?')} />
                    ) : (
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UsersIcon size={14} style={{ opacity: 0.5 }} />
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.55 }}>{u.team} · {u.category} {isUsuario ? '' : `· DNI: ${u.dni}`}</div>
                    </div>
                </div>
            ))}
        </div>
    );
});

const HOME_TEAMS_PAGE_SIZE = 10;

const TeamGrid = React.memo(({ teams, teamsMetadata, isAdminOrDev, onSelectTeam, onDeleteTeam, onSelectAll }: {
    teams: string[],
    teamsMetadata: Team[],
    isAdminOrDev: boolean,
    onSelectTeam: (team: string) => void,
    onDeleteTeam: (name: string, id: string) => Promise<void>,
    onSelectAll: () => void
}) => {
    const [visibleCount, setVisibleCount] = useState(HOME_TEAMS_PAGE_SIZE);

    // Resetear cuando cambia la lista de equipos
    React.useEffect(() => { setVisibleCount(HOME_TEAMS_PAGE_SIZE); }, [teams]);

    const visibleTeams = teams.slice(0, visibleCount);
    const remaining = teams.length - visibleCount;

    return (
        <div className="teams-list-full hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            <div className="grid-responsive">
                {visibleTeams.map(team => (
                    <TeamCard
                        key={team}
                        team={team}
                        teamsMetadata={teamsMetadata}
                        isAdminOrDev={isAdminOrDev}
                        onSelect={() => onSelectTeam(team)}
                        onDelete={onDeleteTeam}
                    />
                ))}

                <div
                    onClick={onSelectAll}
                    className="team-card-rectangular-premium"
                    style={{
                        background: 'rgba(var(--primary-rgb), 0.05)',
                        border: '1px dashed rgba(var(--primary-rgb), 0.2)',
                        justifyContent: 'center',
                        color: 'var(--text-highlight)'
                    }}
                >
                    <LayoutGrid size={20} />
                    <span className="text-extrabold text-sm text-uppercase">Ver Todos los Jugadores</span>
                </div>
            </div>
            {remaining > 0 && (
                <button
                    onClick={() => setVisibleCount(c => c + HOME_TEAMS_PAGE_SIZE)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        margin: '12px auto 0 auto', padding: '8px 22px',
                        background: 'rgba(var(--primary-rgb), 0.10)', border: '1px solid rgba(var(--primary-rgb), 0.25)',
                        borderRadius: '99px', color: 'var(--primary)', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600
                    }}
                >
                    + Cargar más ({remaining} equipos)
                </button>
            )}
        </div>
    );
});

const HistoryView = React.memo(({
    searchTerm,
    setSearchTerm,
    users,
    userRole,
    onBack,
    onPreviewImage,
    onNavigateToRegistration
}: {
    searchTerm: string,
    setSearchTerm: (val: string) => void,
    users: any[],
    userRole: string | undefined,
    onBack: () => void,
    onPreviewImage: (photo: any) => void,
    onNavigateToRegistration: (id: string) => void
}) => {
    const filteredHistory = React.useMemo(() => {
        return users
            .filter(u =>
                (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (u.dni && String(u.dni).includes(searchTerm)) ||
                (u.team && u.team.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .slice()
            .reverse();
    }, [users, searchTerm]);

    return (
        <div className="panel-premium overflow-hidden animate-fade-in-up">
            <div className="panel-view-header">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="btn-back">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="brand-title uppercase">Historial de Registros</h2>
                        <p className="brand-subtitle flex items-center gap-2">
                            <SuccessIcon size={10} className="text-primary" />
                            Listado cronológico de jugadores habilitados
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="premium-search-container md:w-80">
                        <Search size={14} className="premium-search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar en el historial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="premium-input w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="table-premium">
                    <thead>
                        <tr className="bg-black/20">
                            <th>Jugador</th>
                            <th>DNI</th>
                            <th>Equipo / Cat</th>
                            <th className="text-center">Estado</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHistory.map((u) => (
                            <tr key={u.id} className="group transition-colors">
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="user-avatar-small">
                                            {u.photo ? (
                                                <img src={u.photo} alt={`Foto de ${u.name || 'Usuario'}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                                    <UserCircle size={20} className="text-slate-700" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-200 uppercase tracking-tight">{u.name}</div>
                                            <div className="text-9px text-slate-500 uppercase">Registrado hace poco</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="font-mono text-xs text-primary">{userRole === 'usuario' ? '********' : u.dni}</td>
                                <td>
                                    <div className="text-xs font-bold uppercase">{u.team}</div>
                                    <div className="text-9px text-slate-500 uppercase">{u.category}</div>
                                </td>
                                <td>
                                    <div className="flex justify-center">
                                        <span className={`status-badge ${u.status === 'habilitado' ? 'status-active' : 'status-disabled'}`}>
                                            {u.status}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <div className="table-row-actions">
                                        <button onClick={() => onPreviewImage(u.photo)} className="btn-action-small">
                                            <Camera size={14} />
                                        </button>
                                        <button onClick={() => onNavigateToRegistration(u.id)} className="btn-action-primary">
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const TeamView = React.memo(({
    selectedTeam,
    selectedCategory,
    setSelectedTeam,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    filteredUsers,
    categoriesForTeam,
    users,
    userRole,
    onBack,
    onOpenQuickRegister,
    onShowCategoryModal,
    onPlayerDetails
}: {
    selectedTeam: string | null,
    selectedCategory: string | null,
    setSelectedTeam: (team: string | null) => void,
    setSelectedCategory: (cat: string | null) => void,
    searchTerm: string,
    setSearchTerm: (val: string) => void,
    filteredUsers: any[],
    categoriesForTeam: (string | null)[],
    users: any[],
    userRole: string | undefined,
    onBack: () => void,
    onOpenQuickRegister: (team: string, cat: string) => void,
    onShowCategoryModal: (team: string) => void,
    onPlayerDetails: (u: any) => void
}) => (
    <div className="panel-premium overflow-hidden animate-fade-in-up">
        <div className="panel-view-header">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="btn-back">
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {searchTerm ? "Resultados de búsqueda" : selectedTeam?.toUpperCase()}
                        {selectedCategory && <span className="text-primary text-sm ml-2">/ {selectedCategory}</span>}
                    </h2>
                    <p className="brand-subtitle mt-0">
                        {filteredUsers.length} Jugadores encontrados
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="premium-search-container md:w-80">
                    <Search size={14} className="premium-search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="premium-input w-full"
                    />
                </div>
            </div>
        </div>

        <div className="p-6">
            {(!selectedCategory && !searchTerm) ? (
                <div className="category-list-scroll">
                    {categoriesForTeam.map((cat) => (
                        <div
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className="category-list-item group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="cat-name">{cat}</div>
                                <div className="cat-count">
                                    {users.filter(u => u.team === selectedTeam && (u.categories?.includes(cat) || u.category === cat)).length} Jugadores
                                </div>
                            </div>
                            {userRole !== 'usuario' && cat && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenQuickRegister(selectedTeam || "", cat);
                                    }}
                                    className="btn-quick-add"
                                >
                                    Registrar
                                </button>
                            )}
                        </div>
                    ))}
                    {userRole !== 'usuario' && (
                        <button
                            onClick={() => onShowCategoryModal(selectedTeam || "")}
                            className="btn-add-category-compact"
                        >
                            <Plus size={12} />
                            <span>NUEVA</span>
                        </button>
                    )}
                </div>
            ) : (
                <div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="table-premium-header-cell">Jugador</th>
                                    {searchTerm && <th className="table-premium-header-cell text-right">Equipo</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="table-premium-row cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => onPlayerDetails(u)}
                                    >
                                        <td className="table-premium-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="user-avatar-small">
                                                    {u.photo ? (
                                                        <img src={u.photo} alt={`Foto de ${u.name || 'Usuario'}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                                            <UserCircle size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-bold text-sm text-slate-200">{u.name}</div>
                                            </div>
                                        </td>
                                        {searchTerm && (
                                            <td className="table-premium-cell text-right">
                                                <span className="stat-label-muted text-primary text-xs">{u.team}</span>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={() => { setSelectedCategory(null); if (!selectedTeam) setSearchTerm(""); }}
                        className="glass-button w-full mt-8"
                    >
                        <ArrowLeft size={14} /> {searchTerm ? 'VOLVER A RESULTADOS' : 'VOLVER A CATEGORÍAS'}
                    </button>
                </div>
            )}
            <button
                onClick={() => setSelectedTeam(null)}
                className="glass-button col-span-full mt-8"
            >
                <ArrowLeft size={14} /> VOLVER A EQUIPOS
            </button>
        </div>
    </div>
));

// ============================================================================
// 1.1 MODAL COMPONENTS (Memoized)
// ============================================================================

const DeletePlayerModal = React.memo(({
    isOpen,
    userName,
    onClose,
    onConfirm
}: {
    isOpen: boolean,
    userName: string,
    onClose: () => void,
    onConfirm: () => void
}) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <AlertCircle
                    size={32}
                    color="#f87171"
                    style={{ marginBottom: "15px" }}
                />
                <h3 style={{ margin: "0 0 10px 0" }}>Eliminar Jugador</h3>
                <p
                    style={{
                        fontSize: "1rem",
                        opacity: 0.7,
                        marginBottom: "20px",
                    }}
                >
                    ¿Deseas eliminar a <strong>{userName}</strong>?
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        onClick={onClose}
                        className="glass-button"
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)" }}
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={onConfirm}
                        className="glass-button"
                        style={{ flex: 1, background: "#ef4444" }}
                    >
                        ELIMINAR
                    </button>
                </div>
            </div>
        </div>
    );
});

const NewTeamModal = React.memo(({
    isOpen,
    onClose,
    onConfirm,
    modalInput,
    setModalInput
}: {
    isOpen: boolean,
    onClose: () => void,
    onConfirm: () => void,
    modalInput: string,
    setModalInput: (val: string) => void
}) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
            <div
                className="modal-card"
                style={{ borderTop: "2px solid var(--primary)" }}
            >
                <h3 style={{ marginBottom: "20px" }}>Nuevo Equipo</h3>
                <input
                    autoFocus
                    className="premium-input"
                    placeholder="Nombre"
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                />
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button
                        onClick={onClose}
                        className="glass-button button-secondary"
                        style={{ flex: 1 }}
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="glass-button"
                        style={{ flex: 1 }}
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
});

const NewCategoryModal = React.memo(({
    isOpen,
    team,
    onClose,
    onConfirm,
    modalInput,
    setModalInput
}: {
    isOpen: boolean,
    team: string,
    onClose: () => void,
    onConfirm: () => void,
    modalInput: string,
    setModalInput: (val: string) => void
}) => {
    if (!isOpen) return null;
    return (
        <div className="modal-premium-overlay" onClick={onClose}>
            <div className="modal-premium-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-premium-header">
                    <h3 className="modal-premium-title">Nueva Categoría</h3>
                    <button className="btn-close-modal" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <p className="modal-premium-subtitle">Equipo: {team}</p>
                <input
                    autoFocus
                    className="premium-input-full"
                    placeholder="Nombre (ej: Libre)"
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                />
                <div className="btn-group-modal">
                    <button
                        onClick={onClose}
                        className="glass-button button-secondary flex-1"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="glass-button flex-1"
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
});

const ImagePreviewModal = React.memo(({
    image,
    onClose
}: {
    image: string | null,
    onClose: () => void
}) => {
    if (!image) return null;
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-premium-overlay overlay-dark"
            onClick={onClose}
            style={{ zIndex: 10000 }}
        >
            <m.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="modal-preview-card"
                onClick={(e) => e.stopPropagation()}
            >
                <button className="btn-close-modal-overlap" onClick={onClose}>
                    <X size={20} />
                </button>
                <img
                    src={image}
                    alt="Preview"
                    className="img-preview"
                />
            </m.div>
        </m.div>
    );
});

const ReassignTeamModal = React.memo(({
    isOpen,
    user,
    teamsMetadata,
    teams,
    moveTargetTeam,
    setMoveTargetTeam,
    onClose,
    onUpdateUser
}: {
    isOpen: boolean,
    user: any | null,
    teamsMetadata: Team[],
    teams: string[],
    moveTargetTeam: string,
    setMoveTargetTeam: (val: string) => void,
    onClose: () => void,
    onUpdateUser: (id: string, data: any) => Promise<void>
}) => {
    if (!isOpen || !user) return null;
    return (
        <div className="modal-premium-overlay" style={{ zIndex: 7000 }}>
            <div className="modal-premium-card" style={{ maxWidth: "450px" }}>
                <div className="modal-premium-header">
                    <h3 className="modal-premium-title uppercase">Reasignar Equipo</h3>
                    <button
                        className="btn-close-modal"
                        onClick={onClose}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-user-info">
                    <p className="modal-user-label">Jugador a reasignar</p>
                    <div className="modal-user-name">
                        {user.name}
                    </div>
                    <div className="modal-user-dni text-slate-400">
                        DNI: {user.dni}
                        <br />
                        Actual: {user.team} / {user.category}
                    </div>
                </div>

                <div className="management-section">
                    <h4 className="management-label management-label-blue">
                        <Activity size={14} /> 1. SELECCIONAR NUEVO EQUIPO
                    </h4>
                    <select
                        className="premium-input w-full mb-4"
                        value={moveTargetTeam}
                        onChange={(e) => setMoveTargetTeam(e.target.value)}
                    >
                        <option value="">Seleccione Equipo...</option>
                        {teamsMetadata.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                        {teams.filter(t => !teamsMetadata.find(tm => tm.name === t)).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    {moveTargetTeam && (
                        <>
                            <h4 className="management-label management-label-emerald mt-4">
                                <ArrowRightLeft size={14} /> 2. ASIGNAR A CATEGORÍA
                            </h4>
                            <div className="flex-gap-2">
                                {teamsMetadata
                                    .find(t => t.name === moveTargetTeam)?.categories?.map((cat: string) => (
                                        <button
                                            key={cat}
                                            className="category-pill category-pill-move"
                                            onClick={async () => {
                                                try {
                                                    await onUpdateUser(user.id, {
                                                        team: moveTargetTeam,
                                                        category: cat,
                                                        categories: [cat]
                                                    });
                                                    onClose();
                                                } catch (error: any) {
                                                    alert("Error al cambiar equipo y categoría: " + error.message);
                                                }
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

const ManageCategoriesModal = React.memo(({
    isOpen,
    user,
    currentCat,
    categoriesForTeam,
    onClose,
    onUpdateUserCategories
}: {
    isOpen: boolean,
    user: any | null,
    currentCat: string,
    categoriesForTeam: (string | null)[],
    onClose: () => void,
    onUpdateUserCategories: (id: string, oldCat: string, newCat: string, mode: string) => Promise<void>
}) => {
    if (!isOpen || !user) return null;
    return (
        <div className="modal-premium-overlay" style={{ zIndex: 7000 }}>
            <div className="modal-premium-card" style={{ maxWidth: "450px" }}>
                <div className="modal-premium-header">
                    <h3 className="modal-premium-title uppercase">Gestionar Categorías</h3>
                    <button
                        className="btn-close-modal"
                        onClick={onClose}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-user-info">
                    <p className="modal-user-label">Jugador</p>
                    <div className="modal-user-name">
                        {user.name}
                    </div>
                    <div className="modal-user-dni">
                        DNI: {user.dni}
                    </div>
                </div>

                <div className="management-section">
                    <h4 className="management-label management-label-blue">
                        <ArrowRightLeft size={14} /> MOVER CATEGORÍA
                    </h4>
                    <p className="management-action-subtitle">
                        Cambiar "{currentCat}" por:
                    </p>
                    <div className="flex-gap-2">
                        {categoriesForTeam
                            .filter((c) => c !== currentCat)
                            .map((cat) => (
                                <button
                                    key={cat}
                                    className="category-pill category-pill-move"
                                    onClick={async () => {
                                        try {
                                            await onUpdateUserCategories(
                                                user.id,
                                                currentCat,
                                                cat || "",
                                                "move",
                                            );
                                            onClose();
                                        } catch (error: any) {
                                            alert("Error al mover categoría: " + error.message);
                                        }
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                    </div>
                </div>

                <div className="management-section">
                    <h4 className="management-label management-label-emerald">
                        <UserPlus size={14} /> AÑADIR A OTRA CATEGORÍA
                    </h4>
                    <p className="management-action-subtitle">
                        Mantener actual y agregar:
                    </p>
                    <div className="flex-gap-2">
                        {categoriesForTeam
                            .filter((c) => {
                                const userCats = Array.isArray(user.categories)
                                    ? user.categories
                                    : [user.category];
                                return !userCats.includes(c);
                            })
                            .map((cat) => (
                                <button
                                    key={cat}
                                    className="category-pill category-pill-add"
                                    onClick={async () => {
                                        try {
                                            await onUpdateUserCategories(
                                                user.id,
                                                "",
                                                cat || "",
                                                "add",
                                            );
                                            onClose();
                                        } catch (error: any) {
                                            alert("Error al añadir categoría: " + (error?.message || "Error desconocido"));
                                        }
                                    }}
                                >
                                    <Plus size={12} /> {cat}
                                </button>
                            ))}
                    </div>
                </div>

                <div className="management-section">
                    <h4 className="management-label management-label-red">
                        <Trash2 size={14} /> ELIMINAR DE ESTA CATEGORÍA
                    </h4>
                    <p className="management-action-subtitle">
                        Quitar a este jugador de "{currentCat}":
                    </p>
                    <button
                        className="category-pill category-pill-remove"
                        onClick={async () => {
                            if (
                                window.confirm(
                                    `¿Seguro que quieres quitar a este jugador de la categoría ${currentCat}?`,
                                )
                            ) {
                                try {
                                    await onUpdateUserCategories(
                                        user.id,
                                        currentCat || "",
                                        "",
                                        "remove",
                                    );
                                    onClose();
                                } catch (error: any) {
                                    alert("Error al eliminar categoría: " + (error?.message || "Error desconocido"));
                                }
                            }
                        }}
                    >
                        <X size={12} /> QUITAR DE{" "}
                        {currentCat?.toUpperCase() || ""}
                    </button>
                </div>
            </div>
        </div>
    );
});

const PlayerDetailsModal = React.memo(({
    isOpen,
    user,
    onClose,
    isAdminOrDev,
    onPreviewImage,
    selectedCategory,
    onUpdateUser,
    onToggleStatus,
    onReassignTeam,
    onManageCategories,
    onDeletePlayer
}: {
    isOpen: boolean,
    user: any | null,
    onClose: () => void,
    isAdminOrDev: boolean,
    onPreviewImage: (url: string) => void,
    selectedCategory: string | null,
    onUpdateUser: (id: string, data: any) => Promise<void>,
    onToggleStatus: (user: any, cat: string | null) => void,
    onReassignTeam: (user: any) => void,
    onManageCategories: (user: any, cat: string) => void,
    onDeletePlayer: (user: any) => void
}) => {
    if (!isOpen || !user) return null;

    const u = user;
    const name = u.name || (u.nombre && u.apellido ? `${u.nombre} ${u.apellido}` : (u.nombre || u.apellido || 'Sin nombre'));
    const photo = u.photo || u.photoURL || u.imagen_url || u.imagen;

    return (
        <div className="modal-premium-overlay" style={{ zIndex: 6000 }} onClick={onClose}>
            <div className="modal-premium-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-premium-header">
                    <h3 className="modal-premium-title uppercase">Detalles del Jugador</h3>
                    <button className="btn-close-modal" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-6">
                    <div
                        className="user-avatar-large mb-4 cursor-pointer relative group"
                        onClick={() => photo && onPreviewImage(photo)}
                    >
                        {photo ? (
                            <img src={photo} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                                <UserCircle size={60} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Search size={20} className="text-white" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 text-center">{name}</h2>
                    <p className="text-sm text-primary font-medium">{u.team} - {u.category}</p>
                </div>

                <div className="space-y-4">
                    <div className="management-section no-margin-top">
                        <h4 className="management-label management-label-blue flex items-center gap-2">
                            <CreditCard size={14} /> INFORMACIÓN PERSONAL
                        </h4>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-xs text-slate-400">DNI</span>
                                {isAdminOrDev ? (
                                    <input
                                        type="text"
                                        defaultValue={u.dni}
                                        className="bg-transparent text-right text-sm font-mono text-slate-200 outline-none border-b border-white/10 focus:border-primary px-1"
                                        onBlur={async (e) => {
                                            if (e.target.value !== u.dni) {
                                                await onUpdateUser(u.id, { dni: e.target.value });
                                            }
                                        }}
                                    />
                                ) : (
                                    <span className="text-sm font-mono text-slate-200">********</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-xs text-slate-400">Dorsal</span>
                                <input
                                    type="text"
                                    defaultValue={u.number || ""}
                                    className="bg-transparent text-right text-sm font-mono text-slate-200 outline-none border-b border-white/10 focus:border-primary px-1 w-12"
                                    placeholder="N/A"
                                    disabled={!isAdminOrDev}
                                    onBlur={async (e) => {
                                        if (e.target.value !== u.number) {
                                            await onUpdateUser(u.id, { number: e.target.value });
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="management-section">
                        <h4 className="management-label management-label-emerald flex items-center gap-2">
                            <Shield size={14} /> ESTADO Y ACCESO
                        </h4>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-xs text-slate-400">Estado en {selectedCategory || u.category}</span>
                                <StatusBadge
                                    status={selectedCategory ? (u.categoryStatuses?.[selectedCategory] || u.status) : u.status}
                                    onClick={() => isAdminOrDev && onToggleStatus(u, selectedCategory)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-xs text-slate-400">Rol en la Web</span>
                                {isAdminOrDev ? (
                                    <select
                                        value={u.role || 'usuario'}
                                        onChange={async (e) => {
                                            await onUpdateUser(u.id, { role: e.target.value });
                                        }}
                                        className="bg-transparent text-right text-sm text-slate-200 outline-none"
                                    >
                                        <option value="usuario" className="bg-slate-900">Usuario</option>
                                        <option value="admin" className="bg-slate-900">Admin</option>
                                        <option value="referee" className="bg-slate-900">Árbitro</option>
                                        <option value="dev" className="bg-slate-900">Dev</option>
                                    </select>
                                ) : (
                                    <span className="text-sm text-slate-400 uppercase">{u.role || 'usuario'}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {isAdminOrDev && (
                        <div className="management-section">
                            <h4 className="management-label management-label-amber flex items-center gap-2">
                                <ArrowRightLeft size={14} /> GESTIÓN DE PLANTEL
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2"
                                    onClick={() => onReassignTeam(u)}
                                >
                                    <UserPlus size={14} /> REASIGNAR EQUIPO
                                </button>
                                <button
                                    className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2"
                                    onClick={() => onManageCategories(u, selectedCategory || u.category || "")}
                                >
                                    <ArrowRightLeft size={14} /> GESTIONAR CATS
                                </button>
                                <button
                                    className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 col-span-2"
                                    onClick={() => onDeletePlayer(u)}
                                >
                                    <Trash2 size={14} /> ELIMINAR JUGADOR PERMANENTEMENTE
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});


// ===========================================
// 2. MAIN COMPONENT & STATE
// ===========================================
/**
 * Componente principal Home.
 * Renderiza el dashboard administrativo y la tabla de gestión de usuarios.
 */
// ============================================================
// CONSTANTS: Caché claves localStorage
// ============================================================
const CACHE_KEY_HOME_USERS = 'adcc_cache_home_users';
const CACHE_KEY_HOME_TEAMS_META = 'adcc_cache_home_teams_meta';

const Home = ({ userRole }: { userRole?: string }) => {
    // --- ESTADOS PRINCIPALES ---
    const [users, setUsers] = useState<any[]>(() => {
        try { const c = localStorage.getItem(CACHE_KEY_HOME_USERS); return c ? JSON.parse(c) : []; } catch { return []; }
    });
    const [history, setHistory] = useState<any[]>([]);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>(() => {
        try { const c = localStorage.getItem(CACHE_KEY_HOME_TEAMS_META); return c ? JSON.parse(c) : []; } catch { return []; }
    });
    const [loading, setLoading] = useState(() => {
        try { return !localStorage.getItem(CACHE_KEY_HOME_USERS); } catch { return true; }
    });
    const [remoteData, setRemoteData] = useState<any>(null);
    const [remoteVersion, setRemoteVersion] = useState("...");
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [matches, setMatches] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const navigate = useNavigate();
    const isAdminOrDev = userRole === 'admin' || userRole === 'dev';
    const isReferee = userRole === 'referee';
    const isUsuario = userRole === 'usuario';
    const [playerSearch, setPlayerSearch] = useState('');

    // Modales
    const [deleteModal, setDeleteModal] = useState({ open: false, userId: null, userName: "" });
    const [nuclearModal, setNuclearModal] = useState(false);
    const [nuclearConfirm, setNuclearConfirm] = useState("");
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState({ open: false, team: "" });
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterData, setQuickRegisterData] = useState({ name: "", dni: "", team: "", category: "" });
    const [modalInput, setModalInput] = useState("");
    const [previewImage, setPreviewImage] = useState(null);
    const [categoryControl, setCategoryControl] = useState({ open: false, user: null, currentCat: "" });
    const [movePlayerControl, setMovePlayerControl] = useState({ open: false, user: null });
    const [moveTargetTeam, setMoveTargetTeam] = useState("");
    const [playerDetails, setPlayerDetails] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState("");

    // Statistics state
    const [totalPlayers, setTotalPlayers] = useState<number | string>("...");

    // ============================================================================
    // 3. DATA PROCESSING (Hoisted for use in handlers)
    // ============================================================================
    const teams = React.useMemo(() =>
        Array.from(new Set(teamsMetadata.map(t => t.name))).sort(),
        [teamsMetadata]
    );

    // ============================================================================
    // 4. EFFECT HOOKS (Data Fetching & Subscriptions)
    // ============================================================================

    useEffect(() => {
        // Fetch version para el boton
        fetch("https://adccbiometric.web.app/version.json?t=" + Date.now())
            .then((res) => res.json())
            .then((data) => {
                if (data && data.android) {
                    setRemoteData(data.android);
                    setRemoteVersion(data.android.version || "Error");
                }
            })
            .catch((err) => {
                setRemoteVersion("Error");
            });

        // ✅ OPTIMIZACIÓN: Ya no suscribimos a TODOS los usuarios por defecto.
        // La carga de usuarios será perezosa (por equipo o búsqueda).
        const unsubUsers = () => { }; // Placeholder
        setLoading(false);

        // Suscripción a cambios en partidos (para mostrar live events y resultados)
        const unsubMatches = subscribeToMatches((data: any[]) => {
            // Ordenar por fecha y hora descendente (más nuevos arriba)
            const sorted = [...(data || [])].sort((a, b) => {
                const dateA = new Date(`${a.date} ${a.time}`).getTime();
                const dateB = new Date(`${b.date} ${b.time}`).getTime();
                return dateB - dateA;
            });
            setMatches(sorted);
        });

        const unsubTeams = subscribeToTeams((data) => {
            setTeamsMetadata(data);
        });

        // Cargar contador de jugadores
        const fetchPlayerCount = async () => {
            const count = await getUserCount();
            setTotalPlayers(count);
        };
        fetchPlayerCount();

        return () => {
            unsubMatches();
            unsubTeams();
        };
    }, []);

    // --- EFECTO: CARGA PEREZOSA DE USUARIOS POR EQUIPO/BUSQUEDA ---
    useEffect(() => {
        let unsubUsers = () => { };

        if (selectedTeam) {
            // Cargar solo los usuarios del equipo seleccionado
            unsubUsers = subscribeToUsersByTeam(selectedTeam, (data) => {
                setUsers(data);
            });
        } else if (searchTerm && searchTerm.length >= 3) {
            // Búsqueda en el servidor si no hay equipo seleccionado
            const performSearch = async () => {
                const results = await searchUsersServerSide(searchTerm);
                setUsers(results);
            };
            const timeout = setTimeout(performSearch, 500);
            return () => clearTimeout(timeout);
        } else {
            // Si no hay filtro ni equipo, vaciamos la lista local (o mostramos vacio)
            setUsers([]);
        }

        return () => unsubUsers();
    }, [selectedTeam, searchTerm]);

    // ============================================================================
    // 4. ACTION HANDLERS (CRUD, Modals)
    // ============================================================================

    /**
     * Ejecuta la eliminación de un usuario específico.
     * @returns {Promise<void>}
     */
    const execDelete = useCallback(async () => {
        const id = deleteModal.userId;
        setDeleteModal({ open: false, userId: null, userName: "" });

        try {
            if (id) await deleteUser(id);
            // La actualización visual ocurre sola vía subscribeToUsers
        } catch (error: any) {
            console.error("Delete Error:", error);
            alert("Error al eliminar en el servidor: " + (error.message || String(error)));
        }
    }, [deleteModal.userId]);

    const handleToggleStatus = useCallback(async (user: any, categoryOverride: string | null = null) => {
        try {
            const currentStatus = categoryOverride
                ? (user.categoryStatuses && user.categoryStatuses[categoryOverride]) || user.status
                : user.status;

            const newStatus = currentStatus === "habilitado" ? "deshabilitado" : "habilitado";
            const updateData: any = {};

            if (categoryOverride) {
                updateData.categoryStatuses = {
                    ...(user.categoryStatuses || {}),
                    [categoryOverride]: newStatus,
                };
            } else {
                updateData.status = newStatus;
            }

            await updateUser(user.id, updateData);
        } catch (error) {
            alert("No se pudo actualizar el estado");
        }
    }, []);

    const handleConfirmAddTeam = useCallback(() => {
        const teamName = modalInput.trim();
        if (!teamName) return;
        if (teams.some((t) => t.toLowerCase() === teamName.toLowerCase())) {
            alert("El equipo ya existe");
            return;
        }
        setSelectedTeam(teamName);
        setShowTeamModal(false);
        setModalInput("");
    }, [modalInput, teams]);

    const handleConfirmAddCategory = useCallback(() => {
        const catName = modalInput.trim();
        if (!catName) return;
        setSelectedCategory(catName);
        setShowCategoryModal({ open: false, team: "" });
        setModalInput("");
    }, [modalInput]);

    const handleOpenQuickRegister = useCallback((team: string, category: string) => {
        setQuickRegisterData({ name: "", dni: "", team, category });
        setShowQuickRegister(true);
    }, []);

    const handleSyncMatchDay = useCallback(async () => {
        setIsSyncing(true);
        setSyncProgress("Iniciando...");
        try {
            await syncMatchDayData({
                onProgress: (msg) => setSyncProgress(msg)
            });
            alert("Sincronización de partidos y biometría finalizada.");
        } catch (error: any) {
            console.error("Sync Error:", error);
            alert("Error en la sincronización: " + (error.message || String(error)));
        } finally {
            setIsSyncing(false);
            setSyncProgress("");
        }
    }, []);

    const handleDeleteTeamAndPlayers = useCallback(async (teamName: string, teamId: string) => {
        const count = await deletePlayersByTeam(teamName);
        await deleteTeam(teamId);
        alert(`Equipo "${teamName}" eliminado correctamente. Se eliminaron ${count} jugadores.`);
        window.location.reload();
    }, []);

    // ============================================================================
    // 5. DATA PROCESSING & FILTERING
    // ============================================================================

    // --- LÓGICA DE FILTRADO Y PROCESAMIENTO DE DATOS ---
    const categoriesForTeam = React.useMemo(() => {
        if (!selectedTeam) return [];
        return [
            ...new Set([
                ...(teamsMetadata.find(t => t.name === selectedTeam)?.categories || []),
                ...users
                    .filter((u) => u.team === selectedTeam)
                    .flatMap((u) => {
                        const cats =
                            Array.isArray(u.categories) && u.categories.length > 0
                                ? u.categories
                                : [u.category];
                        return cats;
                    }),
                selectedCategory,
            ]),
        ]
            .filter(Boolean)
            .sort();
    }, [selectedTeam, teamsMetadata, users, selectedCategory]);

    // Filtrar usuarios según búsqueda, equipo seleccionado y categoría
    const filteredUsers = React.useMemo(() => {
        return users.filter((u) => {
            // Si hay búsqueda, ya viene filtrado del servidor o por el hook, 
            // pero aplicamos filtros locales adicionales si es necesario.
            const cats =
                Array.isArray(u.categories) && u.categories.length > 0
                    ? u.categories
                    : [u.category];

            if (selectedTeam && u.team !== selectedTeam) return false;
            if (selectedCategory && !cats.includes(selectedCategory)) return false;

            return true;
        });
    }, [users, selectedTeam, selectedCategory]);

    // ============================================================================
    // 6. RENDER UI
    // ============================================================================

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;

    return (
        <div className="home-container animate-fade-in">
            {/* Header / Top Bar */}
            <header className="home-header">
                <div>
                    <div className="header-brand">
                        <img src={adccLogo} alt="Logo de ADCC" className="logo-small drop-shadow-primary" />
                        <div>
                            <h1 className="brand-title">ADCC <span className="text-highlight primary-glow">BIOMETRIC</span></h1>
                            <p className="brand-subtitle">Gestión de Acceso de Alto Rendimiento</p>
                        </div>
                    </div>
                </div>

                <div className="stats-header-container" style={{ display: 'flex', gap: '15px', marginLeft: 'auto', marginRight: '20px' }}>
                    <div className="stat-circle" style={{ backgroundColor: '#008751', border: 'none', transition: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: 1 }}>{totalPlayers}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Jugadores</span>
                    </div>
                    <div className="stat-circle" style={{ backgroundColor: '#0051a2', border: 'none', transition: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: 1 }}>{teamsMetadata.length}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: '600', textTransform: 'uppercase', marginTop: '2px' }}>Equipos</span>
                    </div>
                </div>

                <div className="header-actions">
                    {/* Sinc. adcc button removed */}
                    {userRole !== 'usuario' && (
                        <button
                            onClick={() => navigate('/register')}
                            className="btn-register-main"
                        >
                            + Registrar Jugador
                        </button>
                    )}
                    {releaseInfo?.downloadUrl && (
                        <div className="apk-badge-wrapper">
                            <a
                                href={remoteData?.downloadUrl || releaseInfo.downloadUrl}
                                className={`apk-badge-link ${remoteVersion !== "..." && remoteVersion !== releaseInfo.version ? 'ring-active' : ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Download size={14} className={remoteVersion !== "..." && remoteVersion !== releaseInfo.version ? "animate-bounce" : ""} />
                                APK ANDROID
                            </a>

                            {remoteVersion !== "..." && remoteVersion !== "Error" && remoteVersion !== releaseInfo.version && (
                                <div className="apk-notification-container">
                                    <span className="notification-ping"></span>
                                    <span className="notification-dot">
                                        <div className="w-1-5 h-1-5 bg-black rounded-full animate-heartbeat"></div>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>


            {/* Dashboard Content */}
            {isSyncing && (
                <div style={{
                    padding: '10px 20px',
                    background: 'rgba(var(--primary-rgb), 0.1)',
                    borderBottom: '1px solid rgba(var(--primary-rgb), 0.2)',
                    fontSize: '0.8rem',
                    color: 'var(--text-highlight)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{syncProgress}</span>
                </div>
            )}
            {!searchTerm && !selectedTeam && !showHistory ? (
                <div className="single-column-layout">
                    {/* Panel: Equipos (Planteles) - Vista Principal Única */}
                    <div className="panel-premium panel-teams-management" style={{ width: '100%', minHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="panel-header">
                            <div className="panel-title-group">
                                <h3>Gestión de Planteles</h3>
                                <p>Equipos ADCC</p>
                            </div>
                            {userRole !== 'usuario' && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => navigate('/partidos')}
                                        className="btn-panel-header"
                                        title="Partidos"
                                    >
                                        <Shield size={20} />
                                    </button>
                                    <button
                                        onClick={() => { setModalInput(""); setShowTeamModal(true); }}
                                        className="btn-panel-header"
                                    >
                                        <Plus size={24} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Buscador de Jugadores */}
                        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar jugador por nombre o DNI..."
                                    value={playerSearch}
                                    onChange={e => setPlayerSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        padding: '8px 12px 8px 34px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.78rem',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            <PlayerSearchResults
                                playerSearch={playerSearch}
                                setPlayerSearch={setPlayerSearch}
                                users={users}
                                setSelectedTeam={setSelectedTeam}
                                isUsuario={isUsuario}
                            />
                        </div>
                        <TeamGrid
                            teams={teams}
                            teamsMetadata={teamsMetadata}
                            isAdminOrDev={isAdminOrDev}
                            onSelectTeam={setSelectedTeam}
                            onDeleteTeam={handleDeleteTeamAndPlayers}
                            onSelectAll={() => setSelectedTeam(null)}
                        />
                    </div>
                </div>
            ) : showHistory ? (
                /* HISTORIAL DE REGISTROS VIEW */
                <div className="panel-premium overflow-hidden animate-fade-in-up">
                    <div className="panel-view-header">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowHistory(false)}
                                className="btn-back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <h2 className="brand-title uppercase">Historial de Registros</h2>
                                <p className="brand-subtitle flex items-center gap-2">
                                    <SuccessIcon size={10} className="text-primary" />
                                    Listado cronológico de jugadores habilitados
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="premium-search-container md:w-80">
                                <Search size={14} className="premium-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar en el historial..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="premium-input w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-premium">
                            <thead>
                                <tr className="bg-black/20">
                                    <th>Jugador</th>
                                    <th>DNI</th>
                                    <th>Equipo / Cat</th>
                                    <th className="text-center">Estado</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users
                                    .filter(u =>
                                        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                        (u.dni && String(u.dni).includes(searchTerm)) ||
                                        (u.team && u.team.toLowerCase().includes(searchTerm.toLowerCase()))
                                    )
                                    .slice()
                                    .reverse()
                                    .map((u) => (
                                        <tr key={u.id} className="group transition-colors">
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="user-avatar-small">
                                                        {u.photo ? (
                                                            <img src={u.photo} alt={`Foto de ${u.name || 'Usuario'}`} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                                                <UserCircle size={20} className="text-slate-700" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-200 uppercase tracking-tight">{u.name}</div>
                                                        <div className="text-9px text-slate-500 uppercase">Registrado hace poco</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="font-mono text-xs text-primary">{userRole === 'usuario' ? '********' : u.dni}</td>
                                            <td>
                                                <div className="text-xs font-bold uppercase">{u.team}</div>
                                                <div className="text-9px text-slate-500 uppercase">{u.category}</div>
                                            </td>
                                            <td>
                                                <div className="flex justify-center">
                                                    <span className={`status-badge ${u.status === 'habilitado' ? 'status-active' : 'status-disabled'}`}>
                                                        {u.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="table-row-actions">
                                                    <button onClick={() => setPreviewImage(u.photo)} className="btn-action-small">
                                                        <Camera size={14} />
                                                    </button>
                                                    <button onClick={() => navigate(`/registro/${u.id}`)} className="btn-action-primary">
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* MANAGEMENT VIEW (Table) - Shown when searching or team selected */
                <div className="panel-premium overflow-hidden animate-fade-in-up">
                    <div className="panel-view-header">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setSelectedTeam(null); setSelectedCategory(null); setSearchTerm(""); }}
                                className="btn-back"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    {searchTerm ? "Resultados de búsqueda" : selectedTeam?.toUpperCase()}
                                    {selectedCategory && <span className="text-primary text-sm ml-2">/ {selectedCategory}</span>}
                                </h2>
                                <p className="brand-subtitle mt-0">
                                    {filteredUsers.length} Jugadores encontrados
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="premium-search-container md:w-80">
                                <Search size={14} className="premium-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="premium-input w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {(!selectedCategory && !searchTerm) ? (
                            /* Categorías del equipo */
                            <div className="category-list-scroll">
                                {categoriesForTeam.map((cat) => (
                                    <div
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className="category-list-item group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="cat-name">{cat}</div>
                                            <div className="cat-count">
                                                {users.filter(u => u.team === selectedTeam && (u.categories?.includes(cat) || u.category === cat)).length} Jugadores
                                            </div>
                                        </div>
                                        {userRole !== 'usuario' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenQuickRegister(selectedTeam || "", cat);
                                                }}
                                                className="btn-quick-add"
                                            >
                                                Registrar
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {userRole !== 'usuario' && (
                                    <button
                                        onClick={() => {
                                            setModalInput("");
                                            setShowCategoryModal({ open: true, team: selectedTeam || "" });
                                        }}
                                        className="btn-add-category-compact"
                                    >
                                        <Plus size={12} />
                                        <span>NUEVA</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Lista de usuarios (Tabla) */
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="table-premium-header-cell">Jugador</th>
                                                {searchTerm && <th className="table-premium-header-cell text-right">Equipo</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map((u) => (
                                                <tr
                                                    key={u.id}
                                                    className="table-premium-row cursor-pointer hover:bg-white/5 transition-colors"
                                                    onClick={() => setPlayerDetails({ open: true, user: u })}
                                                >
                                                    <td className="table-premium-cell">
                                                        <div className="flex items-center gap-3">
                                                            <div className="user-avatar-small">
                                                                {u.photo ? (
                                                                    <img src={u.photo} alt={`Foto de ${u.name || 'Usuario'}`} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                                                        <UserCircle size={20} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="font-bold text-sm text-slate-200">{u.name}</div>
                                                        </div>
                                                    </td>
                                                    {searchTerm && (
                                                        <td className="table-premium-cell text-right">
                                                            <span className="stat-label-muted text-primary text-xs">{u.team}</span>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button
                                    onClick={() => { setSelectedCategory(null); if (!selectedTeam) setSearchTerm(""); }}
                                    className="glass-button w-full mt-8"
                                >
                                    <ArrowLeft size={14} /> {searchTerm ? 'VOLVER A RESULTADOS' : 'VOLVER A CATEGORÍAS'}
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => setSelectedTeam(null)}
                            className="glass-button col-span-full mt-8"
                        >
                            <ArrowLeft size={14} /> VOLVER A EQUIPOS
                        </button>
                    </div>
                </div>
            )}

            {/* Modales Profesionales */}
            <DeletePlayerModal
                isOpen={deleteModal.open}
                userName={deleteModal.userName}
                onClose={() => setDeleteModal({ open: false, userId: null, userName: "" })}
                onConfirm={execDelete}
            />

            <NewTeamModal
                isOpen={showTeamModal}
                onClose={() => setShowTeamModal(false)}
                onConfirm={handleConfirmAddTeam}
                modalInput={modalInput}
                setModalInput={setModalInput}
            />

            <NewCategoryModal
                isOpen={showCategoryModal.open}
                team={showCategoryModal.team}
                onClose={() => setShowCategoryModal({ open: false, team: "" })}
                onConfirm={handleConfirmAddCategory}
                modalInput={modalInput}
                setModalInput={setModalInput}
            />

            <LazyMotion features={domAnimation}>
                <AnimatePresence mode="wait">
                    {showQuickRegister && (
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <QuickRegisterModal
                                data={quickRegisterData}
                                onClose={() => setShowQuickRegister(false)}
                            />
                        </m.div>
                    )}

                    <ImagePreviewModal
                        image={previewImage}
                        onClose={() => setPreviewImage(null)}
                    />
                </AnimatePresence>
            </LazyMotion>

            <ReassignTeamModal
                isOpen={movePlayerControl.open}
                user={movePlayerControl.user}
                teamsMetadata={teamsMetadata}
                teams={teams}
                moveTargetTeam={moveTargetTeam}
                setMoveTargetTeam={setMoveTargetTeam}
                onClose={() => {
                    setMovePlayerControl({ open: false, user: null });
                    setMoveTargetTeam("");
                }}
                onUpdateUser={updateUser}
            />

            <ManageCategoriesModal
                isOpen={categoryControl.open}
                user={categoryControl.user}
                currentCat={categoryControl.currentCat}
                categoriesForTeam={categoriesForTeam}
                onClose={() => setCategoryControl({ open: false, user: null, currentCat: "" })}
                onUpdateUserCategories={updateUserCategories}
            />

            <PlayerDetailsModal
                isOpen={playerDetails.open}
                user={playerDetails.user}
                onClose={() => setPlayerDetails({ open: false, user: null })}
                isAdminOrDev={isAdminOrDev}
                onPreviewImage={setPreviewImage}
                selectedCategory={selectedCategory}
                onUpdateUser={updateUser}
                onToggleStatus={handleToggleStatus}
                onReassignTeam={(u: any) => {
                    setMovePlayerControl({ open: true, user: u });
                    setMoveTargetTeam(u.team || "");
                    setPlayerDetails({ open: false, user: null });
                }}
                onManageCategories={(u: any, cat: string) => {
                    setCategoryControl({ open: true, user: u, currentCat: cat });
                    setPlayerDetails({ open: false, user: null });
                }}
                onDeletePlayer={(u: any) => {
                    setDeleteModal({ open: true, userId: u.id, userName: u.name });
                    setPlayerDetails({ open: false, user: null });
                }}
            />
        </div>
    );
};

export default Home;
