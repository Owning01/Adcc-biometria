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
    updateUser,
    updateUserCategories,
} from "../services/db";
import { subscribeToMatches } from "../services/matchesService";
import { subscribeToTeams, Team } from "../services/teamsService";
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
        } catch (error) {
            alert("Error al eliminar en el servidor");
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
                <div className="bento-grid">
                    {/* Panel 1: Estado Global (Radial Chart) - Top Left */}
                    <div className="panel-premium panel-radial-status">
                        <div className="panel-decoration-blob"></div>
                        <h3 className="panel-label text-center" style={{ marginBottom: '1rem' }}>Estado Global</h3>
                        <div className="radial-progress-container">
                            <svg className="radial-progress-svg">
                                <circle className="radial-progress-bg" cx="70" cy="70" r="64" />
                                <circle
                                    className="radial-progress-bar"
                                    cx="70" cy="70" r="64"
                                    strokeDasharray="402"
                                    strokeDashoffset={402 - (402 * (users.filter(u => u.photo).length / Math.max(users.length, 1)))}
                                />
                            </svg>
                            <div className="loading-status-stack" style={{ position: 'absolute' }}>
                                <span className="stat-value-large">{Math.round((users.filter(u => u.photo).length / Math.max(users.length, 1)) * 100)}%</span>
                                <span className="panel-label">BIOMETRIC</span>
                            </div>
                        </div>
                        <div className="radial-stat-group">
                            <div className="stat-item">
                                <span className="stat-label-muted">Total Jugadores</span>
                                <span className="stat-value-highlight">{users.length}</span>
                            </div>
                            <div className="stat-divider"></div>
                            <div className="stat-item">
                                <span className="stat-label-muted">Pendientes</span>
                                <span className="stat-value-primary">{users.filter(u => !u.photo).length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: Equipos (Hexagons) - Center Content */}
                    <div className="panel-premium panel-teams-management">
                        <div className="panel-header">
                            <div className="panel-title-group">
                                <h3>Gestión de Planteles</h3>
                                <p>Equipos ADCC</p>
                            </div>
                            {userRole !== 'usuario' && (
                                <button
                                    onClick={() => { setModalInput(""); setShowTeamModal(true); }}
                                    className="btn-panel-header"
                                >
                                    <Plus size={24} />
                                </button>
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
                        <div className="teams-list-full custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px 16px' }}>
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

                    {/* Panel 3: Timeline de Resultados (Últimos Partidos) - Top Right */}
                    <div className="panel-premium panel-matches-timeline">
                        <div className="panel-title-container">
                            <div className="card-icon-wrapper">
                                <Shield size={14} className="text-highlight" />
                            </div>
                            <h3 className="panel-label">Últimos Partidos</h3>
                        </div>
                        <div className="timeline-scroll-area custom-scrollbar">
                            <div className="timeline-list">
                                {matches.filter(m => m.status === "finished").slice(0, 15).map(match => {
                                    const teamALogo = (teamsMetadata as Team[]).find(t => t.name === match.teamA.name)?.logoUrl;
                                    const teamBLogo = (teamsMetadata as Team[]).find(t => t.name === match.teamB.name)?.logoUrl;
                                    return (
                                        <div key={match.id} className="match-log-entry" onClick={() => navigate(`/partido/${match.id}`)}>
                                            <div className="match-log-dot"></div>
                                            <span className="match-meta text-highlight uppercase font-black" style={{ fontSize: '8px' }}>{match.category} · {match.date}</span>

                                            <div className="match-teams-list">
                                                <div className="match-team-row">
                                                    {teamALogo ? (
                                                        <img src={teamALogo} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '6px' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=T')} />
                                                    ) : match.teamA.logo ? (
                                                        <img src={getAdccImageUrl(match.teamA.logo)} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '6px' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=T')} />
                                                    ) : (
                                                        <div style={{ width: '16px', height: '16px', marginRight: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                                    )}
                                                    <span className="match-team-name">{match.teamA.name}</span>
                                                    <div className="score-badge">
                                                        <span className="text-10px font-black text-primary">{match.score.a}</span>
                                                    </div>
                                                </div>
                                                <div className="match-team-row">
                                                    {teamBLogo ? (
                                                        <img src={teamBLogo} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '6px' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=T')} />
                                                    ) : match.teamB.logo ? (
                                                        <img src={getAdccImageUrl(match.teamB.logo)} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '6px' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=T')} />
                                                    ) : (
                                                        <div style={{ width: '16px', height: '16px', marginRight: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                                    )}
                                                    <span className="match-team-name">{match.teamB.name}</span>
                                                    <div className="score-badge">
                                                        <span className="text-10px font-black text-primary">{match.score.b}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={() => navigate('/partidos')} className="button-full-width">
                            Historial Completo
                        </button>
                    </div>

                    {userRole !== 'usuario' && (
                        <div
                            className="panel-premium panel-scanner-shortcut"
                            onClick={() => navigate('/alta')}
                        >
                            <div className="panel-decoration-blob" style={{ right: 0, top: 0, left: 'auto', width: '12rem', height: '12rem', opacity: 0.5 }}></div>

                            <div className="icon-box-large">
                                <QrCode size={32} className="text-highlight" />
                            </div>

                            <div className="scanner-text-content">
                                <h4 className="text-display-medium text-white">
                                    ESCANEAR<br />
                                    <span className="text-highlight">Biometric</span>
                                </h4>
                                <p className="scanner-description">
                                    Inicia el proceso de validación facial para nuevos ingresos.
                                </p>
                            </div>

                            <div className="scanner-action-arrow">
                                <ArrowRight size={24} />
                            </div>
                        </div>
                    )}

                    {/* Panel 5: Últimos Registros - Bottom Left */}
                    {userRole !== 'usuario' && (
                        <div className="panel-premium panel-records-list">
                            <div className="panel-decoration-blob" style={{ right: 0, top: 0, left: 'auto', width: '12rem', height: '12rem' }}></div>
                            <div className="panel-header records-header-group">
                                <div className="panel-title-group">
                                    <h3 className="panel-label opacity-60 mobile-hidden">Control de Ingresos</h3>
                                    <p className="records-display-title">Últimos registros</p>
                                </div>
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="btn-history-toggle"
                                >
                                    Ver Historial Completo
                                </button>
                            </div>

                            <div className="records-scroll-container custom-scrollbar">
                                {users.slice().reverse().slice(0, 20).map((u) => (
                                    <div key={u.id} className="record-item group" onClick={() => { setPreviewImage(u.photo); }}>
                                        <div className="record-avatar-wrapper">
                                            <div className="record-avatar">
                                                {u.photo ? (
                                                    <img src={getAdccImageUrl(u.photo)} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={`Foto de ${u.name || 'Usuario'}`} onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Jugador')} />
                                                ) : (
                                                    <div className="w-full h-full user-avatar-placeholder-bg">
                                                        <UserCircle size={32} className="user-avatar-placeholder-icon" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="record-status-check">
                                                <SuccessIcon size={12} />
                                            </div>
                                        </div>
                                        <span className="record-name-label">{u.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                                                {searchTerm && <th className="table-premium-header-cell">Equipo</th>}
                                                <th className="table-premium-header-cell text-center">No.</th>
                                                <th className="table-premium-header-cell">DNI</th>
                                                <th className="table-premium-header-cell">Categorías</th>
                                                <th className="table-premium-header-cell">Rol</th>
                                                <th className="table-premium-header-cell">Estado</th>
                                                <th className="table-premium-header-cell text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map((u) => (
                                                <tr key={u.id} className="table-premium-row">
                                                    <td className="table-premium-cell">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="user-avatar-small cursor-pointer"
                                                                onClick={() => u.photo && setPreviewImage(u.photo)}
                                                            >
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
                                                        <td className="table-premium-cell">
                                                            <span className="stat-label-muted text-primary">{u.team}</span>
                                                        </td>
                                                    )}
                                                    <td className="table-premium-cell text-center">
                                                        <input
                                                            type="text"
                                                            defaultValue={u.number || ""}
                                                            onBlur={async (e) => {
                                                                if (e.target.value !== u.number) {
                                                                    await updateUser(u.id, { number: e.target.value });
                                                                }
                                                            }}
                                                            className="input-premium-small"
                                                            disabled={!isAdminOrDev}
                                                        />
                                                    </td>
                                                    <td className="table-premium-cell text-xs text-slate-400 font-mono">{(userRole === 'usuario' || userRole === 'referee') ? '********' : u.dni}</td>
                                                    <td className="table-premium-cell">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(Array.isArray(u.categories) ? u.categories : [u.category || '']).filter(Boolean).map((c: string) => (
                                                                <span key={c} className="badge-premium-category">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="table-premium-cell">
                                                        {isAdminOrDev ? (
                                                            <select
                                                                value={u.role || 'usuario'}
                                                                onChange={async (e) => {
                                                                    await updateUser(u.id, { role: e.target.value });
                                                                }}
                                                                className="select-premium-small"
                                                            >
                                                                <option value="usuario">Usuario</option>
                                                                <option value="admin">Admin</option>
                                                                <option value="referee">Árbitro</option>
                                                                <option value="dev">Dev</option>
                                                            </select>
                                                        ) : (
                                                            <span className="stat-label-muted opacity-40">{u.role || 'usuario'}</span>
                                                        )}
                                                    </td>
                                                    <td className="table-premium-cell text-center">
                                                        <StatusBadge
                                                            status={selectedCategory ? (u.categoryStatuses?.[selectedCategory] || u.status) : u.status}
                                                            onClick={() => isAdminOrDev && handleToggleStatus(u, selectedCategory)}
                                                        />
                                                    </td>
                                                    <td className="table-premium-cell text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {isAdminOrDev && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setCategoryControl({ open: true, user: u, currentCat: selectedCategory || "" })}
                                                                        className="btn-action-warning"
                                                                        title="Gestión de Categorías"
                                                                    >
                                                                        <ArrowRightLeft size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteModal({ open: true, userId: u.id, userName: u.name })}
                                                                        className="btn-action-danger"
                                                                        title="Eliminar Jugador"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
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

        </div >
    );
};

export default Home;
