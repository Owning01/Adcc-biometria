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
} from "../services/db";
import { subscribeToMatches } from "../services/matchesService";
import { subscribeToTeams, Team, deleteTeam } from "../services/teamsService";
import { syncADCCData } from "../services/syncService";
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

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, color, icon }) => (
    <div className="stat-card-premium" style={{ '--accent-color': color } as React.CSSProperties}>
        <div className="stat-card-icon-wrapper">
            {icon}
        </div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{title}</div>
    </div>
);

interface StatusBadgeProps {
    status: string;
    onClick?: (e: React.MouseEvent) => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onClick }) => {
    const isEnabled = status?.toLowerCase() === "habilitado";
    return (
        <span
            onClick={onClick}
            style={{
                padding: "3px 8px",
                borderRadius: "20px",
                fontSize: "0.6rem",
                fontWeight: "800",
                background: isEnabled
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                color: isEnabled ? "#10b981" : "#f87171",
                border: `1px solid ${isEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                cursor: onClick ? "pointer" : "default",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textTransform: "uppercase",
            }}
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
};


// ============================================================================
// 2. MAIN COMPONENT & STATE
// ============================================================================
/**
 * Componente principal Home.
 * Renderiza el dashboard administrativo y la tabla de gestión de usuarios.
 */
const Home = ({ userRole }: { userRole?: string }) => {
    // --- ESTADOS PRINCIPALES ---
    const [users, setUsers] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [teamsMetadata, setTeamsMetadata] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
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

    // ============================================================================
    // 3. DATA PROCESSING (Hoisted for use in handlers)
    // ============================================================================
    const teams = [...new Set(users.map((u: any) => u.team))].filter(Boolean).sort() as string[];

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

        // Suscripción a cambios en tiempo real de la colección de usuarios
        const unsubUsers = subscribeToUsers((data: any[]) => {
            setUsers(data || []);
            setLoading(false);
        });

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

        return () => {
            unsubUsers();
            unsubMatches();
            unsubTeams();
        };
    }, []);

    // ============================================================================
    // 4. ACTION HANDLERS (CRUD, Modals)
    // ============================================================================

    /**
     * Ejecuta la eliminación de un usuario específico.
     * @returns {Promise<void>}
     */
    const execDelete = async () => {
        const id = deleteModal.userId;
        setDeleteModal({ open: false, userId: null, userName: "" });

        try {
            if (id) await deleteUser(id);
            // La actualización visual ocurre sola vía subscribeToUsers
        } catch (error: any) {
            console.error("Delete Error:", error);
            alert("Error al eliminar en el servidor: " + (error.message || String(error)));
        }
    };

    /**
     * Alterna el estado de un jugador (habilitado/deshabilitado).
     * Puede aplicar a una categoría específica o al estado global del usuario.
     * @param {Object} user - Usuario a modificar.
     * @param {string|null} categoryOverride - Categoría específica (opcional).
     * @returns {Promise<void>}
     */
    const handleToggleStatus = async (user: any, categoryOverride: string | null = null) => {
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
    };



    /**
     * Confirma y crea un nuevo equipo.
     * Valida que el nombre no esté duplicado.
     * @returns {void}
     */
    const handleConfirmAddTeam = () => {
        const teamName = modalInput.trim();
        if (!teamName) return;
        if (teams.some((t) => t.toLowerCase() === teamName.toLowerCase())) {
            alert("El equipo ya existe");
            return;
        }
        setSelectedTeam(teamName);
        setShowTeamModal(false);
        setModalInput("");
    };

    /**
     * Confirma y crea una nueva categoría.
     * @returns {void}
     */
    const handleConfirmAddCategory = () => {
        const catName = modalInput.trim();
        if (!catName) return;
        setSelectedCategory(catName);
        setShowCategoryModal({ open: false, team: "" });
        setModalInput("");
    };

    /**
     * Abre el modal de registro rápido con los datos de equipo y categoría pre-rellenados.
     * @param {string} team - Nombre del equipo.
     * @param {string} category - Nombre de la categoría.
     * @returns {void}
     */
    const handleOpenQuickRegister = (team: string, category: string) => {
        setQuickRegisterData({ name: "", dni: "", team, category });
        setShowQuickRegister(true);
    };

    // ============================================================================
    // 5. DATA PROCESSING & FILTERING
    // ============================================================================

    // --- LÓGICA DE FILTRADO Y PROCESAMIENTO DE DATOS ---
    const categoriesForTeam = selectedTeam
        ? [
            ...new Set([
                ...users
                    .filter((u) => u.team === selectedTeam)
                    .flatMap((u) => {
                        const cats =
                            Array.isArray(u.categories) && u.categories.length > 0
                                ? u.categories
                                : [u.category];
                        return cats;
                    }),
                selectedCategory, // Asegurar que la categoría actual (incluso si está vacía) esté en la lista
            ]),
        ]
            .filter(Boolean)
            .sort()
        : [];

    // Filtrar usuarios según búsqueda, equipo seleccionado y categoría
    const filteredUsers = users.filter((u) => {
        const searchLower = searchTerm.toLowerCase();
        const cats =
            Array.isArray(u.categories) && u.categories.length > 0
                ? u.categories
                : [u.category];

        if (searchTerm) {
            return (
                (u.name && u.name.toLowerCase().includes(searchLower)) ||
                (u.dni && String(u.dni).toLowerCase().includes(searchLower)) ||
                (u.team && u.team.toLowerCase().includes(searchLower)) ||
                cats.some((c: string) => c && String(c).toLowerCase().includes(searchLower))
            );
        }

        if (u.team !== selectedTeam) return false;
        return cats.includes(selectedCategory);
    });

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

                <div className="header-actions">
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
                            {playerSearch.trim().length >= 2 && (() => {
                                const q = playerSearch.trim().toLowerCase();
                                const results = users.filter(u =>
                                    u.name?.toLowerCase().includes(q) ||
                                    u.dni?.toString().includes(q)
                                ).slice(0, 5);
                                return results.length > 0 ? (
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
                                                    <img src={u.photo} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => (e.currentTarget.src = 'https://placehold.co/30x30?text=?')} />
                                                ) : (
                                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <UsersIcon size={14} style={{ opacity: 0.5 }} />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.55 }}>{u.team} · {u.category} {isUsuario ? '' : `· DNI: ${u.dni}`}</div>
                                                </div>
                                                <ArrowRight size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '6px', padding: '10px 14px', fontSize: '0.75rem', opacity: 0.5, textAlign: 'center' }}>
                                        Sin resultados
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="teams-list-full hide-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px 16px' }}>
                            {teams.map(team => {
                                const teamData = (teamsMetadata as Team[]).find(t => t.name === team || t.id === team.toLowerCase().replace(/\s+/g, '-'));
                                return (
                                    <div
                                        key={team}
                                        onClick={() => setSelectedTeam(team)}
                                        className="team-card-rectangular-premium"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '16px',
                                            padding: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div className="team-logo-wrapper" style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', flexShrink: 0 }}>
                                            {teamData?.logoUrl ? (
                                                <img src={teamData.logoUrl} alt={team} style={{ width: '45px', height: '45px', objectFit: 'contain' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Team')} />
                                            ) : teamData?.adccLogoUrl ? (
                                                <img src={getAdccImageUrl(teamData.adccLogoUrl)} alt={team} style={{ width: '45px', height: '45px', objectFit: 'contain' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Team')} />
                                            ) : (
                                                <UsersIcon size={30} className="text-muted opacity-40" />
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{team}</h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-highlight)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                                                    {users.filter(u => u.team === team).length} JUGADORES
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
                                                            try {
                                                                setLoading(true);
                                                                const count = await deletePlayersByTeam(team);
                                                                const teamId = teamData?.id || team.toLowerCase().replace(/\s+/g, '-');
                                                                await deleteTeam(teamId);
                                                                alert(`Equipo "${team}" eliminado correctamente. Se eliminaron ${count} jugadores.`);
                                                                window.location.reload(); // Recarga simple para limpiar estado global
                                                            } catch (error: any) {
                                                                alert("Error al eliminar equipo: " + error.message);
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        }
                                                    } else if (password !== null) {
                                                        alert("Contraseña incorrecta");
                                                    }
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                                title="Eliminar Equipo y Jugadores"
                                                style={{ marginLeft: 'auto', zIndex: 10 }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            <div
                                onClick={() => setSelectedTeam(null)}
                                className="team-card-rectangular-premium"
                                style={{
                                    width: '100%',
                                    background: 'rgba(var(--primary-rgb), 0.05)',
                                    border: '1px dashed rgba(var(--primary-rgb), 0.2)',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    color: 'var(--text-highlight)'
                                }}
                            >
                                <LayoutGrid size={20} />
                                <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>Ver Todos los Jugadores</span>
                            </div>
                        </div>
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
                                        className="add-card-glass min-h-0 py-4 flex-row justify-center"
                                        style={{ marginTop: '10px' }}
                                    >
                                        <Plus size={20} />
                                        <span className="ml-2">NUEVA CATEGORÍA</span>
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
            {
                deleteModal.open && (
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
                                ¿Deseas eliminar a <strong>{deleteModal.userName}</strong>?
                            </p>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={() =>
                                        setDeleteModal({ open: false, userId: null, userName: "" })
                                    }
                                    className="glass-button"
                                    style={{ flex: 1, background: "rgba(255,255,255,0.05)" }}
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={execDelete}
                                    className="glass-button"
                                    style={{ flex: 1, background: "#ef4444" }}
                                >
                                    ELIMINAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modales de Gestión Rápida */}
            {
                showTeamModal && (
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
                                    onClick={() => setShowTeamModal(false)}
                                    className="glass-button button-secondary"
                                    style={{ flex: 1 }}
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handleConfirmAddTeam}
                                    className="glass-button"
                                    style={{ flex: 1 }}
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showCategoryModal.open && (
                    <div className="modal-premium-overlay" onClick={() => setShowCategoryModal({ open: false, team: "" })}>
                        <div className="modal-premium-card" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-premium-header">
                                <h3 className="modal-premium-title">Nueva Categoría</h3>
                                <button className="btn-close-modal" onClick={() => setShowCategoryModal({ open: false, team: "" })}>
                                    <X size={20} />
                                </button>
                            </div>
                            <p className="modal-premium-subtitle">Equipo: {showCategoryModal.team}</p>
                            <input
                                autoFocus
                                className="premium-input-full"
                                placeholder="Nombre (ej: Libre)"
                                value={modalInput}
                                onChange={(e) => setModalInput(e.target.value)}
                            />
                            <div className="btn-group-modal">
                                <button
                                    onClick={() => setShowCategoryModal({ open: false, team: "" })}
                                    className="glass-button button-secondary flex-1"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handleConfirmAddCategory}
                                    className="glass-button flex-1"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <LazyMotion features={domAnimation}>
                <AnimatePresence mode="wait">
                    {
                        showQuickRegister && (
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
                        )
                    }

                    {
                        previewImage && (
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="modal-premium-overlay overlay-dark"
                                onClick={() => setPreviewImage(null)}
                            >
                                <m.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="modal-preview-card"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button className="btn-close-modal-overlap" onClick={() => setPreviewImage(null)}>
                                        <X size={20} />
                                    </button>
                                    <img
                                        src={previewImage || ""}
                                        alt="Preview"
                                        className="img-preview"
                                    />
                                </m.div>
                            </m.div>
                        )
                    }
                </AnimatePresence>
            </LazyMotion>

            {/* Modal de Control de Cambio de Equipo */}
            {
                movePlayerControl.open && (
                    <div className="modal-premium-overlay" style={{ zIndex: 7000 }}>
                        <div className="modal-premium-card" style={{ maxWidth: "450px" }}>
                            <div className="modal-premium-header">
                                <h3 className="modal-premium-title uppercase">Reasignar Equipo</h3>
                                <button
                                    className="btn-close-modal"
                                    onClick={() => {
                                        setMovePlayerControl({ open: false, user: null });
                                        setMoveTargetTeam("");
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-user-info">
                                <p className="modal-user-label">Jugador a reasignar</p>
                                <div className="modal-user-name">
                                    {(movePlayerControl.user as any)?.name}
                                </div>
                                <div className="modal-user-dni text-slate-400">
                                    DNI: {(movePlayerControl.user as any)?.dni}
                                    <br />
                                    Actual: {(movePlayerControl.user as any)?.team} / {(movePlayerControl.user as any)?.category}
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
                                    {/* En caso de que haya equipos sin metadata */}
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
                                                                if (!movePlayerControl.user) return;
                                                                await updateUser((movePlayerControl.user as any).id, {
                                                                    team: moveTargetTeam,
                                                                    category: cat,
                                                                    categories: [cat]
                                                                });
                                                                setMovePlayerControl({ open: false, user: null });
                                                                setMoveTargetTeam("");
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
                )
            }

            {/* Modal de Control de Categorías */}
            {
                categoryControl.open && (
                    <div className="modal-premium-overlay" style={{ zIndex: 7000 }}>
                        <div className="modal-premium-card" style={{ maxWidth: "450px" }}>
                            <div className="modal-premium-header">
                                <h3 className="modal-premium-title uppercase">Gestionar Categorías</h3>
                                <button
                                    className="btn-close-modal"
                                    onClick={() =>
                                        setCategoryControl({
                                            open: false,
                                            user: null,
                                            currentCat: "",
                                        })
                                    }
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-user-info">
                                <p className="modal-user-label">Jugador</p>
                                <div className="modal-user-name">
                                    {(categoryControl.user as any)?.name}
                                </div>
                                <div className="modal-user-dni">
                                    DNI: {(categoryControl.user as any)?.dni}
                                </div>
                            </div>

                            <div className="management-section">
                                <h4 className="management-label management-label-blue">
                                    <ArrowRightLeft size={14} /> MOVER CATEGORÍA
                                </h4>
                                <p className="management-action-subtitle">
                                    Cambiar "{categoryControl.currentCat}" por:
                                </p>
                                <div className="flex-gap-2">
                                    {categoriesForTeam
                                        .filter((c) => c !== categoryControl.currentCat)
                                        .map((cat) => (
                                            <button
                                                key={cat}
                                                className="category-pill category-pill-move"
                                                onClick={async () => {
                                                    try {
                                                        if (!categoryControl.user) return;
                                                        await updateUserCategories(
                                                            (categoryControl.user as any).id,
                                                            categoryControl.currentCat,
                                                            cat,
                                                            "move",
                                                        );
                                                        setCategoryControl({
                                                            open: false,
                                                            user: null,
                                                            currentCat: "",
                                                        });
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
                                            const userCats = Array.isArray((categoryControl.user as any)?.categories)
                                                ? (categoryControl.user as any).categories
                                                : [(categoryControl.user as any)?.category];
                                            return !userCats.includes(c);
                                        })
                                        .map((cat) => (
                                            <button
                                                key={cat}
                                                className="category-pill category-pill-add"
                                                onClick={async () => {
                                                    try {
                                                        if (!categoryControl.user) return;
                                                        await updateUserCategories(
                                                            (categoryControl.user as any).id,
                                                            "",
                                                            cat,
                                                            "add",
                                                        );
                                                        setCategoryControl({
                                                            open: false,
                                                            user: null,
                                                            currentCat: "",
                                                        });
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
                                    Quitar a este jugador de "{categoryControl.currentCat}":
                                </p>
                                <button
                                    className="category-pill category-pill-remove"
                                    onClick={async () => {
                                        if (
                                            window.confirm(
                                                `¿Seguro que quieres quitar a este jugador de la categoría ${categoryControl.currentCat}?`,
                                            )
                                        ) {
                                            try {
                                                if (!categoryControl.user) return;
                                                await updateUserCategories(
                                                    (categoryControl.user as any).id,
                                                    categoryControl.currentCat || "",
                                                    "",
                                                    "remove",
                                                );
                                                setCategoryControl({
                                                    open: false,
                                                    user: null,
                                                    currentCat: "",
                                                });
                                            } catch (error: any) {
                                                alert("Error al eliminar categoría: " + (error?.message || "Error desconocido"));
                                            }
                                        }
                                    }}
                                >
                                    <X size={12} /> QUITAR DE{" "}
                                    {categoryControl.currentCat?.toUpperCase() || ""}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Detalles del Jugador */}
            {playerDetails.open && playerDetails.user && (
                <div className="modal-premium-overlay" style={{ zIndex: 6000 }} onClick={() => setPlayerDetails({ open: false, user: null })}>
                    <div className="modal-premium-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-premium-header">
                            <h3 className="modal-premium-title uppercase">Detalles del Jugador</h3>
                            <button
                                className="btn-close-modal"
                                onClick={() => setPlayerDetails({ open: false, user: null })}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-6">
                            <div
                                className="user-avatar-large mb-4 cursor-pointer relative group"
                                onClick={() => playerDetails.user.photo && setPreviewImage(playerDetails.user.photo)}
                            >
                                {playerDetails.user.photo ? (
                                    <img src={playerDetails.user.photo} alt="" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                        <UserCircle size={60} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Search size={20} className="text-white" />
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-white text-center">{playerDetails.user.name}</h2>
                            <p className="text-sm text-primary font-medium">{playerDetails.user.team} - {playerDetails.user.category}</p>
                        </div>

                        <div className="space-y-4">
                            {/* DNI */}
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
                                                defaultValue={playerDetails.user.dni}
                                                className="bg-transparent text-right text-sm font-mono text-white outline-none border-b border-white/10 focus:border-primary px-1"
                                                onBlur={async (e) => {
                                                    if (e.target.value !== playerDetails.user.dni) {
                                                        await updateUser(playerDetails.user.id, { dni: e.target.value });
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span className="text-sm font-mono text-white">********</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                        <span className="text-xs text-slate-400">Dorsal</span>
                                        <input
                                            type="text"
                                            defaultValue={playerDetails.user.number || ""}
                                            className="bg-transparent text-right text-sm font-mono text-white outline-none border-b border-white/10 focus:border-primary px-1 w-12"
                                            placeholder="N/A"
                                            disabled={!isAdminOrDev}
                                            onBlur={async (e) => {
                                                if (e.target.value !== playerDetails.user.number) {
                                                    await updateUser(playerDetails.user.id, { number: e.target.value });
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ESTADO Y ROL */}
                            <div className="management-section">
                                <h4 className="management-label management-label-emerald flex items-center gap-2">
                                    <Shield size={14} /> ESTADO Y ACCESO
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                        <span className="text-xs text-slate-400">Estado en {selectedCategory || playerDetails.user.category}</span>
                                        <StatusBadge
                                            status={selectedCategory ? (playerDetails.user.categoryStatuses?.[selectedCategory] || playerDetails.user.status) : playerDetails.user.status}
                                            onClick={() => isAdminOrDev && handleToggleStatus(playerDetails.user, selectedCategory)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                        <span className="text-xs text-slate-400">Rol en la Web</span>
                                        {isAdminOrDev ? (
                                            <select
                                                value={playerDetails.user.role || 'usuario'}
                                                onChange={async (e) => {
                                                    await updateUser(playerDetails.user.id, { role: e.target.value });
                                                }}
                                                className="bg-transparent text-right text-sm text-white outline-none"
                                            >
                                                <option value="usuario" className="bg-slate-900">Usuario</option>
                                                <option value="admin" className="bg-slate-900">Admin</option>
                                                <option value="referee" className="bg-slate-900">Árbitro</option>
                                                <option value="dev" className="bg-slate-900">Dev</option>
                                            </select>
                                        ) : (
                                            <span className="text-sm text-slate-400 uppercase">{playerDetails.user.role || 'usuario'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* GESTIÓN DE EQUIPO */}
                            {isAdminOrDev && (
                                <div className="management-section">
                                    <h4 className="management-label management-label-amber flex items-center gap-2">
                                        <ArrowRightLeft size={14} /> GESTIÓN DE PLANTEL
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2"
                                            onClick={() => {
                                                setMovePlayerControl({ open: true, user: playerDetails.user });
                                                setMoveTargetTeam(playerDetails.user.team || "");
                                                setPlayerDetails({ open: false, user: null });
                                            }}
                                        >
                                            <UserPlus size={14} /> REASIGNAR EQUIPO
                                        </button>
                                        <button
                                            className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2"
                                            onClick={() => {
                                                setCategoryControl({ open: true, user: playerDetails.user, currentCat: selectedCategory || playerDetails.user.category || "" });
                                                setPlayerDetails({ open: false, user: null });
                                            }}
                                        >
                                            <ArrowRightLeft size={14} /> GESTIONAR CATS
                                        </button>
                                        <button
                                            className="glass-button text-[0.7rem] py-2 flex items-center justify-center gap-2 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 col-span-2"
                                            onClick={() => {
                                                setDeleteModal({ open: true, userId: playerDetails.user.id, userName: playerDetails.user.name });
                                                setPlayerDetails({ open: false, user: null });
                                            }}
                                        >
                                            <Trash2 size={14} /> ELIMINAR JUGADOR PERMANENTEMENTE
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
};

export default Home;
