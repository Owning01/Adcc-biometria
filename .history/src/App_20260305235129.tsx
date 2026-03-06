/**
 * @file App.jsx
 * @description Punto de entrada principal de la aplicación.
 * Maneja el enrutamiento, autenticación, control de versiones y lógica global de actualización.
 */
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import AuditLogs from './pages/AuditLogs';
import { loadModelsLocal } from './services/faceServiceLocal';
import Home from './pages/Home';
import HomePublic from './pages/HomePublic';
import HomeUser from './pages/HomeUser';
import Stats from './pages/Stats';
import Register from './pages/Register';
import AltaLocal from './pages/AltaLocal';
import Config from './pages/Config';
import DevTools from './pages/DevTools';
import Webcam from 'react-webcam';
import { getUsers, User } from './services/db';
import { createMatcher } from './services/faceService';
import { getFaceDataLocal } from './services/faceServiceLocal';
import { initHybridEngine, checkFaceQuality } from './services/hybridFaceService';
import { detectFaceMediaPipe } from './services/mediapipeService';

import { UserPlus, Home as HomeIcon, Search, RefreshCw, Zap, Lock, Unlock, LogIn, Settings, Globe, Terminal, Users, Moon, Sun, WifiOff, CloudOff, Sparkles, BarChart2, LayoutDashboard, Bell, UserRoundPlus, ScanFace, Shield, PieChart, Swords, Sliders, Code2, Palette, X, Mic, AlertCircle, ShieldAlert, XCircle, UserCircle, Pause, Play, ExternalLink, Activity } from 'lucide-react';
import adccLogo from './img/Logo ADCC.webp';
import eyeLogo from './adcc_eye_logo.png';
import loginBg from './img/1_abstracto_geomtrico.webp';
import Equipos from './pages/Equipos';
import Partidos from './pages/Partidos';
import MatchDetail from './pages/MatchDetail';
import NotFound from './pages/NotFound';
import { LazyMotion, domAnimation, m, motion, AnimatePresence } from 'framer-motion';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { logEvent } from './services/auditService';
import { useBatchProcessor } from './contexts/BatchProcessorContext';

// ============================================================================
// 1. CONSTANTS & CONFIG
// ============================================================================
const ADMIN_UIDS = ['N9vLq7NiGwOWsOkp5m9SUT4vzOw1']; // UID del Admin Principal
// Puedes agregar tu UID de desarrollador aquí si lo conoces, o mantener el email temporalmente para dev
const DEV_EMAILS = ['dev@admin.com', 'admin@admin.com'];
const DEV_UIDS = ['Tjl2THE3TmlHd09Xc09rcDVtOVNVVDR2ek93MQ==']; // UIDs de desarrolladores (Base64)
const REFEREE_EMAILS = ['arbitro@adcc.com', 'referee@adcc.com']; // Emails de ejemplo para Árbitros


// ============================================================================
// 2. MAIN APP COMPONENT
// ============================================================================
function App() {
  // --- STATE: AUTH & SYSTEM ---
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('public'); // public | admin | dev
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // --- STATE: UI THEME ---
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'dark');
  const [palette, setPalette] = useState<string>(localStorage.getItem('palette') || 'default');
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);

  // --- STATE: UPDATES & NETWORK ---
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // @ts-ignore
  const [updateRequired, setUpdateRequired] = useState<boolean>(false);
  const [updateUrl, setUpdateUrl] = useState<string>('');
  const [availableVersion, setAvailableVersion] = useState<string>('');

  // --- STATE: BIOMETRIC LOGIN ---
  const [showFaceLogin, setShowFaceLogin] = useState<boolean>(false);
  const [matchingFace, setMatchingFace] = useState<boolean>(false);
  const webcamRef = React.useRef<Webcam>(null);
  const VERSION = __APP_VERSION__;

  const compareVersions = (v1: string | undefined, v2: string | undefined): number => {
    if (!v1 || !v2) return 0;
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
      if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    }
    return 0;
  };

  // ============================================================================
  // 3. EFFECTS (LIFECYCLE)
  // ============================================================================
  useEffect(() => {
    // 1. Revisar actualizacion.
    const checkUpdate = async () => {
      try {
        const res = await fetch('https://adccbiometric.web.app/version.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          const latest = data.android.version;
          if (compareVersions(VERSION, latest) < 0) {
            setUpdateUrl(data.android.url);
            setAvailableVersion(latest);
            // setUpdateRequired(true); // Pausado por el momento
          }
        }
      } catch (e: any) {
        // No se pudo verificar actualizacion
      }
    };
    checkUpdate();

    // 2. Cargar modelos en BACKGROUND (sin bloquear la UI)
    // Los modelos se cargan después de que la UI ya está lista, para no hacer esperar al usuario.
    loadModelsLocal()
      .then((res) => {
        if (res.success) {
          setModelsLoaded(true);
        } else {
          setModelsError(res.error || "Error al cargar modelos");
          setModelsLoaded(true); // Permitir el uso de la app, pero con funciones biometricas limitadas
        }
      })
      .catch((err: any) => {
        setModelsError(err.message || String(err));
        setModelsLoaded(true); // Permitir el uso de la app de todas formas
      });

    // 3. Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const email = user.email?.toLowerCase() || '';

        const isAdmin = ADMIN_UIDS.includes(user.uid);
        const isDev = DEV_EMAILS.includes(email) || DEV_UIDS.includes(btoa(user.uid));
        const isReferee = REFEREE_EMAILS.includes(email);

        // console.log("[AuthDebug] UID:", user.uid);
        // console.log("[AuthDebug] Role detected:", isDev ? 'dev' : (isAdmin ? 'admin' : (isReferee ? 'referee' : 'usuario')));

        if (isAdmin || isDev) {
          // Si es dev, le damos también privilegios de admin si fuera necesario, 
          // pero el userRole 'dev' ya tiene acceso a todo.
          setUserRole(isDev ? 'dev' : 'admin');
        } else if (isReferee) {
          setUserRole('referee');
        } else {
          setUserRole('usuario');
        }

        // Registrar ingreso si es un cambio de estado a logueado
        if (user) {
          const role = isAdmin ? 'admin' : (isDev ? 'dev' : (isReferee ? 'referee' : 'usuario'));
          logEvent({
            type: 'access',
            user: { uid: user.uid, name: user.displayName || user.email || 'Usuario', role },
            description: `Ingreso al sistema: ${user.email}`
          });
        }
      } else {
        setUserRole('public');
      }
      setLoadingAuth(false);
    });

    // 4. Limpieza de caché forzada si hay cambio de versión
    // Esto asegura que los usuarios no se queden con datos obsoletos o esquemas viejos en localStorage
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion && storedVersion !== VERSION) {
      localStorage.removeItem('users_cache');
      localStorage.removeItem('matches_cache');
    }
    localStorage.setItem('app_version', VERSION);
    // 5. Network Listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [VERSION, theme, palette]); // Added palette dependency

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('palette', palette);
  }, [palette]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // ============================================================================
  // 4. HANDLERS (AUTH & LOGIC)
  // ============================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoadingAuth(true);
      // Intentamos login real con Firebase
      await signInWithEmailAndPassword(auth, loginForm.user, loginForm.pass);
    } catch (err: any) {
      let msg = "Error al iniciar sesión";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "Usuario o contraseña incorrectos";
      } else if (err.code === 'auth/invalid-email') {
        msg = "Formato de email inválido (ej: admin@adcc.com)";
      }
      alert(msg);
    } finally {
      setLoadingAuth(false);
    }
  };

  // ============================================================================
  // 5. BIOMETRIC LOGIN ENGINE
  // ============================================================================
  /* 
   * NEW STATE FOR BIOMETRIC LOGIN 
   */
  const [faceBox, setFaceBox] = useState<any>(null); // For UI overlay
  const [qualityError, setQualityError] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Escaneando...');
  const matcherRef = React.useRef<any>(null); // Usamos Ref para evitar problemas de closure en el intervalo
  const [tipIndex, setTipIndex] = useState(0);


  const tips = [
    { icon: <Zap size={20} color="#fbbf24" />, text: "Busca un lugar con buena iluminación" },
    { icon: <UserCircle size={20} color="#3b82f6" />, text: "Mira directo al centro de la cámara" },
    { icon: <ShieldAlert size={20} color="#f87171" />, text: "Rostro descubierto, sin gafas oscuras" },
    { icon: <Search size={20} color="#a855f7" />, text: "Acércate un poco más si no detecta" },
    { icon: <UserCircle size={20} color="#10b981" />, text: "Asegúrate de que tu cara ocupe buen espacio en el círculo" },
  ];

  // Effect for cycling tips
  useEffect(() => {
    if (!showFaceLogin) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [showFaceLogin]);

  // Effect for Detection Loop when Modal is Open
  useEffect(() => {
    if (!showFaceLogin) {
      setMatchingFace(false);
      setScanProgress(0);
      setFaceBox(null);
      return;
    }

    let interval: any;
    let isDeepProcessing = false;

    const runEffect = async () => {
      // Init Hybrid Engine if needed (though usually done at app start)
      await initHybridEngine();

      // Load users for matcher
      setStatusText('Cargando base de datos...');
      const currentUsers = await getUsers(true); // Forzar refresco para evitar cache vacío

      if (currentUsers.length > 0) {
        const newMatcher = createMatcher(currentUsers);
        matcherRef.current = newMatcher;
        setStatusText('Escaneando...');
      } else {
        // [FaceLogin] No se pudieron cargar usuarios.
        setQualityError('Base de datos vacía o protegida');
        setStatusText('Error de Base de Datos');
        return; // No iniciamos el intervalo si no hay matcher
      }

      interval = setInterval(async () => {
        if (!webcamRef.current || !webcamRef.current.video || isDeepProcessing) return;

        const video = webcamRef.current.video;
        if (video.readyState !== 4) return;

        // 1. Fast Detection (MediaPipe)
        const mpDetection = await detectFaceMediaPipe(video);

        if (!mpDetection) {
          setQualityError('No se detecta rostro');
          setScanProgress(0);
          setFaceBox(null);
          return;
        }

        // 2. Map coordinates for UI
        const { originX, originY, width, height } = mpDetection.boundingBox;
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;

        setFaceBox({
          x: (originX / videoW) * 100,
          y: (originY / videoH) * 100,
          w: (width / videoW) * 100,
          h: (height / videoH) * 100
        });

        // 3. Check Quality
        const quality = checkFaceQuality(mpDetection, video);
        if (!quality.ok) {
          setQualityError(quality.reason);
          setScanProgress(prev => Math.max(0, prev - 10));
          return;
        }

        setQualityError('');

        // 4. Update Progress or Trigger Login
        setScanProgress(prev => {
          const next = prev + 20; // Faster progress for login
          if (next >= 100) {
            performLogin(video);
            return 0; // Reset
          }
          return next;
        });

      }, 150);
    };

    const performLogin = async (video: HTMLVideoElement) => {
      if (isDeepProcessing) return;
      isDeepProcessing = true;
      setMatchingFace(true);
      setStatusText('Verificando...');

      try {
        const data = await getFaceDataLocal(video);
        if (data && matcherRef.current) {
          const { descriptor } = data;
          const bestMatch = matcherRef.current.findBestMatch(descriptor);

          // Umbral secundario: doble verificación de distancia para evitar falsos positivos.
          // face-api reporta 'unknown' si dist > 0.5, pero aquí también rechazamos cualquier match dudoso > 0.45.
          const STRICT_THRESHOLD = 0.45;
          if (bestMatch.label !== 'unknown' && bestMatch.distance < STRICT_THRESHOLD) {
            const users = await getUsers(true); // Refrescar para tener el objeto completo
            const matchedUser = users.find(u => u.id === bestMatch.label);

            if (matchedUser) {
              // Login exitoso vía Facial
              const detectedRole = matchedUser.role === 'admin' ? 'admin' : (matchedUser.role === 'dev' ? 'dev' : (matchedUser.role === 'referee' ? 'referee' : 'usuario'));
              setUserRole(detectedRole);
              setLoadingAuth(false);
              setShowFaceLogin(false);
              alert(`Bienvenido, ${matchedUser.name}`);
            }
          } else {
            // Mostrar qué tan cerca estuvo del umbral para diagnóstico
            const dist = bestMatch.distance.toFixed(2);
            setStatusText(`No reconocido (${dist})`);
            setTimeout(() => setStatusText('Escaneando...'), 2000);
          }
        } else if (!matcherRef.current) {
          // [FaceLogin] Matcher no listo al intentar login
          setStatusText('Reintentando BD...');
          const users = await getUsers(true);
          if (users.length > 0) matcherRef.current = createMatcher(users);
        }
      } catch (err) {
        // Error Login
        setStatusText('Error de validación');
      } finally {
        isDeepProcessing = false;
        setMatchingFace(false);
        setStatusText('Escaneando...');
      }
    };


    runEffect();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showFaceLogin]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Limpieza de caches locales
      const ver = localStorage.getItem('app_version');
      localStorage.clear();
      sessionStorage.clear();
      if (ver) localStorage.setItem('app_version', ver);
      window.location.href = '/';
    } catch (err: any) {
      // Error al salir
    }
  };

  /* 
  if (updateRequired) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white', padding: '20px', textAlign: 'center' }}>
        <Zap size={64} color="#10b981" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '10px' }}>Actualización Requerida</h1>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Existe una nueva versión de ADCC Biometric. Para continuar usándola, debes actualizar.</p>

        <a
          href={updateUrl}
          onClick={(e) => {
            e.preventDefault();
            window.open(updateUrl, '_system');
          }}
          className="glass-button"
          style={{ background: '#10b981', color: '#020617', padding: '15px 30px', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={20} fill="black" /> DESCARGAR ACTUALIZACIÓN
        </a>
        <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#10b981', fontWeight: 'bold' }}>Nueva Versión Disponible: v{availableVersion}</div>
        <div style={{ marginTop: '5px', fontSize: '0.7rem', opacity: 0.4 }}>Tu versión actual: v{VERSION}</div>
      </div>
    );
  }
  */

  // Solo bloqueamos con la pantalla de carga si auth está verificando
  // Los modelos de IA cargan en background SIN bloquear la UI
  if (loadingAuth) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#000000',
        color: 'white',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Outfit', sans-serif"
      }}>
        {/* Ambient Background Effects */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '40%',
          height: '40%',
          background: 'radial-gradient(circle, rgba(0, 135, 81, 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          borderRadius: '50%',
          animation: 'float-slow 20s infinite alternate'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(0, 51, 102, 0.05) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          animation: 'float-slow 25s infinite alternate-reverse'
        }}></div>

        {/* Central Core Loader */}
        <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' }}>
          {/* Outer Rotating Ring */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            border: '1px solid rgba(0, 135, 81, 0.1)',
            borderTop: '2px solid #008751',
            borderRadius: '50%',
            animation: 'spin 2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
            boxShadow: '0 0 20px rgba(0, 135, 81, 0.2)'
          }}></div>

          {/* Middle Counter-Rotating Ring */}
          <div style={{
            position: 'absolute',
            width: '85%',
            height: '85%',
            border: '1px solid rgba(0, 51, 102, 0.05)',
            borderBottom: '1px solid #008751',
            borderRadius: '50%',
            animation: 'spin 3s linear infinite reverse',
            opacity: 0.6
          }}></div>

          {/* Innermost Pulsing Ring */}
          <div style={{
            position: 'absolute',
            width: '70%',
            height: '70%',
            border: '2px solid rgba(0, 135, 81, 0.2)',
            borderRadius: '50%',
            animation: 'pulse-glow 2s ease-in-out infinite'
          }}></div>

          {/* Logo Center */}
          <div style={{
            zIndex: 10,
            animation: 'logo-float 4s ease-in-out infinite'
          }}>
            <img
              src={adccLogo}
              alt="Logotipo de ADCC"
              style={{
                width: '70px',
                filter: 'drop-shadow(0 0 15px var(--primary-glow)) brightness(1.1)'
              }}
            />
          </div>
        </div>

        {/* Text Content */}
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <div style={{ overflow: 'hidden' }}>
            <h1 style={{
              fontWeight: '900',
              letterSpacing: '8px',
              fontSize: '1.6rem',
              margin: 0,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              ADCC<span style={{ color: '#008751', marginLeft: '8px', textShadow: '0 0 20px rgba(0, 135, 81, 0.6)' }}>BIOMETRIC</span>
            </h1>
          </div>

          <div style={{
            marginTop: '40px',
            color: '#008751',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            background: 'rgba(0, 135, 81, 0.05)',
            padding: '10px 20px',
            borderRadius: '99px',
            border: '1px solid rgba(0, 135, 81, 0.1)',
            backdropFilter: 'blur(5px)'
          }}>
            <RefreshCw size={14} className="animate-spin" style={{ color: '#008751' }} />
            <span style={{ fontWeight: '700' }}>Verificando sesion...</span>
          </div>
        </div>

        {error && (
          <div className="glass-premium" style={{
            marginTop: '40px',
            background: 'rgba(239, 68, 68, 0.05)',
            color: '#f87171',
            fontSize: '11px',
            padding: '15px 25px',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            maxWidth: '80%',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            animation: 'shake 0.5s ease-in-out'
          }}>
            <AlertCircle size={18} style={{ marginBottom: '8px', color: '#f87171' }} />
            <br />
            <strong style={{ letterSpacing: '1px' }}>SYSTEM INITIALIZATION FAILED</strong>
            <div style={{ opacity: 0.7, marginTop: '4px' }}>{error}</div>
          </div>
        )}

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.3; border-color: rgba(0, 135, 81, 0.2); }
            50% { transform: scale(1.1); opacity: 0.8; border-color: rgba(0, 135, 81, 0.5); }
          }
          @keyframes float-slow {
            0% { transform: translate(0, 0); }
            100% { transform: translate(20px, 30px); }
          }
          @keyframes logo-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .animate-spin { animation: spin 2s linear infinite; }
        `}</style>
      </div>
    );
  }


  const BatchProcessorOverlay = () => {
    const { status, progress, currentPlayer, currentStep, startProcessing, pauseProcessing } = useBatchProcessor();
    const navigate = useNavigate();

    if (status === 'idle' || status === 'ready' || status === 'finished') return null;

    return (
      <div style={{
        position: 'fixed',
        bottom: '80px',
        right: '25px',
        zIndex: 1000,
        width: '280px',
        background: 'rgba(9, 9, 11, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--primary-glow)',
        borderRadius: '20px',
        padding: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: status === 'processing' ? '#10b981' : '#fbbf24',
              boxShadow: status === 'processing' ? '0 0 10px #10b981' : 'none',
              animation: status === 'processing' ? 'pulse 2s infinite' : 'none'
            }}></div>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)' }}>
              {status === 'loading_list' ? 'Cargando API' : (status === 'processing' ? 'Procesando' : 'En Pausa')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {status === 'processing' ? (
              <button onClick={(e) => { e.stopPropagation(); pauseProcessing(); }} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '4px' }}>
                <Pause size={16} />
              </button>
            ) : status === 'paused' ? (
              <button onClick={(e) => { e.stopPropagation(); startProcessing(); }} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px' }}>
                <Play size={16} />
              </button>
            ) : null}
            <button
              onClick={() => navigate('/dev')}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' }}
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {currentPlayer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: '#000' }}>
              <img src={currentPlayer.processed_foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentPlayer.nombre} {currentPlayer.apellido}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: '600' }}>{currentStep}</div>
            </div>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>
            <span>PROGRESO</span>
            <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${(progress.processed / progress.total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #008751, #0051a2)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px', fontSize: '0.6rem', fontWeight: '800' }}>
            <span style={{ color: '#10b981' }}>{progress.success} OK</span>
            <span style={{ color: '#ef4444' }}>{progress.failed} ERROR</span>
          </div>
        </div>
      </div>
    );
  };

  const isAdminOrDev = userRole === 'admin' || userRole === 'dev';

  return (
    <BrowserRouter>
      <div className="app-main-container">


        {/* Botón Flotante Tema */}
        <button
          onClick={toggleTheme}
          className="glass-button floating-theme-toggle"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>


        {/* Navigation bar - Only show for logged in users */}
        {userRole && userRole !== 'public' && (
          <Navigation userRole={userRole} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        )}
        <BatchProcessorOverlay />

        {/* Indicador de Modo Offline */}
        {!isOnline && (
          <div className="offline-indicator">
            <WifiOff size={16} /> MODO OFFLINE - Los cambios se sincronizarán al conectar
          </div>
        )}

        {/* Indicador de IA cargando en background */}
        {!modelsLoaded && (
          <div style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            background: 'rgba(0,0,0,0.92)',
            border: '1px solid rgba(0,135,81,0.3)',
            borderRadius: '99px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.7rem',
            color: '#008751',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}>
            <RefreshCw size={12} className="animate-spin" />
            Cargando motor biométrico...
          </div>
        )}
        {modelsError && modelsLoaded && (
          <div style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '99px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.7rem',
            color: '#f87171',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}>
            <AlertCircle size={12} />
            Biometric no disponible
          </div>
        )}

        <main className="container" style={{ paddingBottom: '120px', paddingTop: '40px' }}>
          <Routes>
            <Route path="/" element={userRole !== 'public' ? (
              userRole === 'usuario' ? <HomeUser /> : <Home userRole={userRole} />
            ) : (
              <HomePublic />
            )} />

            {/* Ruta Pública de Login */}
            <Route path="/login" element={
              userRole !== 'public' ? (
                <Navigate to="/" replace />
              ) : (
                <AdminLogin
                  handleLogin={handleLogin}
                  loginForm={loginForm}
                  setLoginForm={setLoginForm}
                  onFaceLogin={() => setShowFaceLogin(true)}
                />
              )
            } />

            {/* Rutas Protegidas (Solo Autenticados con Permisos) */}
            <Route path="/register" element={<ProtectedRoute isAllowed={isAdminOrDev || userRole === 'referee'}><Register /></ProtectedRoute>} />
            <Route path="/alta" element={<ProtectedRoute isAllowed={userRole === 'admin' || userRole === 'dev' || userRole === 'referee'}><AltaLocal /></ProtectedRoute>} />
            <Route path="/equipos" element={<Equipos userRole={userRole} />} />
            <Route path="/partidos" element={<Partidos userRole={userRole} />} />
            <Route path="/partido/:id" element={<MatchDetail userRole={userRole} />} />
            {/* Rutas de Desarrollador */}
            <Route path="/dev" element={<ProtectedRoute isAllowed={userRole === 'dev'}><DevTools /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute isAllowed={isAdminOrDev}><AuditLogs /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>



          <footer style={{ marginTop: '50px', textAlign: 'center', opacity: 0.3, fontSize: '0.7rem', paddingBottom: '20px' }}>
            2026 Gbro
          </footer>
        </main>

        {/* Modal de Login Facial */}
        {showFaceLogin && (
          <div className="facial-login-overlay animate-fade-in" style={{ zIndex: 9999 }}>
            <div className="glass-premium facial-login-card" style={{ maxWidth: '500px', width: '100%', padding: '20px' }}>
              <button
                onClick={() => setShowFaceLogin(false)}
                className="btn-close-modal"
                style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 300 }}
              >
                <X size={24} />
              </button>

              <div className="text-center" style={{ marginBottom: '1.5rem' }}>
                <h3 className="modal-premium-title" style={{ fontSize: '1.5rem' }}>Login Biométrico</h3>
                <p className="modal-premium-subtitle">Sistema de Acceso Seguro</p>
              </div>

              {/* Tips Section */}
              <div className="glass-panel" style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '15px', minHeight: '45px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ minWidth: '24px' }}>{tips[tipIndex].icon}</div>
                <span className="animate-fade-in" key={tipIndex} style={{ fontSize: '0.8rem' }}>
                  {tips[tipIndex].text}
                </span>
              </div>

              {/* Camera Wrapper - Same as AltaLocal */}
              <div className="webcam-wrapper" style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', border: '2px solid rgba(0, 135, 81, 0.3)', position: 'relative', borderRadius: '24px' }}>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  playsInline
                  muted
                  autoPlay
                  videoConstraints={{ facingMode: "user" }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Face Box Overlay */}
                {faceBox && (
                  <div className="face-box-overlay">
                    <div
                      className={`face-box ${qualityError ? 'invalid' : ''} ${matchingFace ? 'processing' : ''}`}
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
                    </div>
                  </div>
                )}

                {/* Status Badges Overlay */}
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', zIndex: 20 }}>
                  <div className="status-badge" style={{
                    background: qualityError ? 'rgba(239, 68, 68, 0.9)' : (matchingFace ? 'rgba(59, 130, 246, 0.9)' : 'rgba(34, 197, 94, 0.9)'),
                    color: '#fff',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '5px'
                  }}>
                    {matchingFace ? <RefreshCw className="animate-spin" size={12} /> : (qualityError ? <XCircle size={12} /> : <Zap size={12} />)}
                    {qualityError ? qualityError : statusText}
                  </div>

                  {!matchingFace && (
                    <div style={{ width: '100px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${scanProgress}%`, background: '#008751', transition: 'width 0.1s linear' }} />
                    </div>
                  )}
                </div>

                <div className="camera-mask"></div>
              </div>

              <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.7rem', marginTop: '15px' }}>
                Mantén tu rostro en el recuadro para ingresar
              </p>

            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

interface AdminLoginProps {
  handleLogin: (e: React.FormEvent) => void;
  loginForm: { user: string; pass: string };
  setLoginForm: React.Dispatch<React.SetStateAction<{ user: string; pass: string }>>;
  onFaceLogin: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ handleLogin, loginForm, setLoginForm, onFaceLogin }) => {
  const [showEmailForm, setShowEmailForm] = React.useState(false);

  return (
    <div className="full-bleed" style={{
      minHeight: '100vh', /* full height to cover screen */
      marginTop: '-40px', /* fix the padding top of main container */
      marginBottom: '-120px', /* fix the padding bottom of main container */
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: `url(${loginBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      {/* Overlay to ensure readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.75)', /* Slate-950 with 75% opacity */
        zIndex: 0
      }} />

      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(0, 135, 81, 0.2) 0%, transparent 70%)',
        filter: 'blur(70px)', pointerEvents: 'none', borderRadius: '50%', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '20%',
        width: '250px', height: '250px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none', borderRadius: '50%'
      }} />

      {/* Logo & branding */}
      <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '90px', height: '90px', borderRadius: '28px', margin: '0 auto 20px',
          background: 'linear-gradient(135deg, rgba(0, 51, 102, 0.15), rgba(0, 51, 102, 0.05))',
          border: '1px solid rgba(0, 135, 81, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0, 135, 81, 0.15)',
        }}>
          <img src={adccLogo} alt="Logo ADCC" style={{ width: '58px', filter: 'drop-shadow(0 0 12px rgba(0, 135, 81, 0.5))' }} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
          ADCC <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(0, 135, 81, 0.4)' }}>BIOMETRIC</span>
        </h1>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Sistema de Acceso Elite
        </p>
      </div>

      {/* Login card */}
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '28px 24px',
        backdropFilter: 'blur(20px)',
        position: 'relative', zIndex: 1,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>

        {/* Primary biometric button */}
        <button
          onClick={onFaceLogin}
          style={{
            width: '100%',
            padding: '18px',
            background: 'linear-gradient(135deg, rgba(0, 135, 81, 0.2), rgba(0, 135, 81, 0.08))',
            border: '1px solid rgba(0, 135, 81, 0.35)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            cursor: 'pointer',
            color: '#008751',
            fontFamily: "'Outfit', sans-serif",
            marginBottom: '16px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 20px rgba(0, 135, 81, 0.15)',
          }}
        >
          <ScanFace size={26} strokeWidth={1.5} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '800', fontSize: '0.95rem', lineHeight: 1 }}>Reconocimiento Facial</div>
            <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '3px' }}>Acceso biométrico seguro</div>
          </div>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', opacity: 0.35, fontWeight: '700', letterSpacing: '1px' }}>o continúa con email</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Collapsible email form */}
        {!showEmailForm ? (
          <button
            onClick={() => setShowEmailForm(true)}
            style={{
              width: '100%', padding: '14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: 'var(--text-muted)',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.82rem', fontWeight: '600',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <LogIn size={16} />
            Iniciar sesión con email
          </button>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email"
              placeholder="Email (ej: admin@adcc.com)"
              className="premium-input"
              value={loginForm.user}
              onChange={(e) => setLoginForm({ ...loginForm, user: e.target.value.toLowerCase() })}
              required
              style={{ fontSize: '16px' }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              className="premium-input"
              value={loginForm.pass}
              onChange={(e) => setLoginForm({ ...loginForm, pass: e.target.value })}
              style={{ fontSize: '16px' }}
            />
            <button type="submit" className="glass-button btn-primary" style={{ width: '100%', marginTop: '4px' }}>
              Ingresar <LogIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px' }}
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

interface NavigationProps {
  userRole: string;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ userRole, onLogout, theme, toggleTheme }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <>
      <nav className="app-nav">
        <div className="nav-brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src={adccLogo} alt="Logo ADCC" style={{ height: '35px', objectFit: 'contain' }} />
            <div className="hide-mobile" style={{ fontWeight: '800', letterSpacing: '-1px', color: 'var(--primary)', fontSize: '1.2rem', marginLeft: '5px' }}>ADCC</div>
          </Link>
        </div>

        {/* Desktop Menu - No Icons */}
        <div className="nav-items-center hide-mobile">
          {userRole !== 'public' && (
            <NavItem to="/" label="Inicio" active={location.pathname === "/"} />
          )}

          {/* Rutas Públicas */}
          <NavItem to="/partidos" label="Partidos" active={location.pathname === "/partidos" || location.pathname.startsWith('/partido')} />
          {userRole !== 'public' && userRole !== 'usuario' && (
            <NavItem to="/equipos" label="Torneos" active={location.pathname === "/equipos"} />
          )}

          {userRole !== 'public' && (
            <NavItem to="/estadisticas" label="Estadísticas" active={location.pathname === "/estadisticas"} />
          )}

          {userRole === 'public' && (
            <NavItem to="/login" label="Ingresar" active={location.pathname === "/login"} />
          )}

          {userRole !== 'public' && (
            <>
              {userRole !== 'usuario' && <NavItem to="/alta" label="Reconocimiento" active={location.pathname === "/alta"} />}
              {(userRole === 'admin' || userRole === 'dev' || userRole === 'referee') && <NavItem to="/register" label="Registro" active={location.pathname === "/register"} />}
              {userRole === 'dev' && (
                <NavItem to="/dev" label="Dev" active={location.pathname === "/dev"} />
              )}
            </>
          )}
        </div>

        {/* Desktop Logout Shortcut */}
        {userRole !== 'public' ? (
          <div onClick={onLogout} className="nav-item logout-item hide-mobile" style={{ cursor: 'pointer', color: '#f87171' }}>
            <div style={{ padding: '8px', borderRadius: '12px' }}>
              <span style={{ fontSize: '13px', marginTop: '2px', fontWeight: '800' }}>SALIR</span>
            </div>

          </div>
        ) : (
          <div className="nav-item logout-item hide-mobile" style={{ visibility: 'hidden' }}>
            <div style={{ padding: '8px' }}><Unlock size={20} /></div>
            <span style={{ fontSize: '10px' }}>Spacer</span>
          </div>
        )}

        {/* Bottom Navigation for Mobile */}
        <div className="show-mobile-flex bottom-nav-mobile">
          {userRole !== 'public' && (
            <NavItem to="/" icon={<HomeIcon size={20} />} label="Inicio" active={location.pathname === "/"} isMobile />
          )}

          <NavItem to="/partidos" icon={<Swords size={20} />} label="Partidos" active={location.pathname === "/partidos" || location.pathname.startsWith('/partido')} isMobile />

          {userRole !== 'public' && userRole !== 'usuario' && (
            <NavItem to="/equipos" icon={<Shield size={20} />} label="Torneos" active={location.pathname === "/equipos"} isMobile />
          )}

          {userRole === 'public' && (
            <NavItem to="/login" icon={<LogIn size={20} />} label="Ingresar" active={location.pathname === "/login"} isMobile />
          )}

          {/* More Actions Drawer Trigger for Mobile */}
          <div className="nav-item mobile-nav-item" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ cursor: 'pointer' }}>
            <div style={{
              padding: '8px',
              borderRadius: '12px',
              background: isMenuOpen ? 'var(--primary-glow)' : 'transparent',
              color: isMenuOpen ? 'var(--primary)' : 'inherit',
              transition: 'none'
            }}>
              <LayoutDashboard size={20} />
            </div>
            <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: isMenuOpen ? '700' : '500' }}>Más</span>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="mobile-drawer-overlay"
          >
            <div className="mobile-drawer-handle" onClick={() => setIsMenuOpen(false)}></div>
            <div className="drawer-content">
              {userRole !== 'public' && (
                <Link to="/estadisticas" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}><PieChart size={22} /> Estadísticas</Link>
              )}

              {userRole !== 'public' && userRole !== 'usuario' && (
                <Link to="/alta" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}><ScanFace size={22} /> Reconocimiento</Link>
              )}

              {userRole !== 'public' && (userRole === 'admin' || userRole === 'dev' || userRole === 'referee') && (
                <Link to="/register" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}><UserRoundPlus size={22} /> Registro Facial</Link>
              )}

              {userRole === 'dev' && (
                <Link to="/dev" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}><Terminal size={22} /> Dev</Link>
              )}

              {userRole !== 'public' && (
                <button
                  onClick={() => { onLogout(); setIsMenuOpen(false); }}
                  className="mobile-menu-item"
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', marginTop: '10px' }}
                >
                  <Unlock size={22} /> Cerrar Sesión
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface NavItemProps {
  to: string;
  icon?: React.ReactNode;
  label: string;
  active: boolean;
  isMobile?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, active, isMobile }) => (
  <Link to={to} className={`nav-item ${active ? 'active' : ''} ${isMobile ? 'mobile-nav-item' : ''}`}>
    {icon && (
      <div style={{
        padding: '8px',
        borderRadius: '12px',
        background: active ? 'var(--primary-glow)' : 'transparent',
        color: active ? 'var(--primary)' : 'inherit',
        transition: 'none'
      }}>
        {icon}
      </div>
    )}
    <span style={{ fontSize: isMobile ? '10px' : '13px', marginTop: '2px', fontWeight: active ? '800' : '500', display: 'block' }}>{label}</span>
  </Link>
);


interface ProtectedRouteProps {
  isAllowed: boolean;
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ isAllowed, children, redirectTo = "/" }) => {
  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

export default App;
