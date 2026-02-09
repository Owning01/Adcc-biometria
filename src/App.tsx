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
import Register from './pages/Register';
import AltaLocal from './pages/AltaLocal';
import Config from './pages/Config';
import DevTools from './pages/DevTools';
import Novedades from './pages/Novedades';
import Stats from './pages/Stats';
import Webcam from 'react-webcam';
import { getUsers, User } from './services/db';
import { createMatcher } from './services/faceService';
import { getFaceDataLocal } from './services/faceServiceLocal';
import { initHybridEngine, checkFaceQuality } from './services/hybridFaceService';
import { detectFaceMediaPipe } from './services/mediapipeService';

import { UserPlus, Home as HomeIcon, Search, RefreshCw, Zap, Lock, Unlock, LogIn, Settings, Globe, Terminal, Users, Trophy, Moon, Sun, WifiOff, CloudOff, Sparkles, BarChart2, LayoutDashboard, Bell, UserRoundPlus, ScanFace, Shield, PieChart, Swords, Sliders, Code2, Palette, X, Mic, AlertCircle, ShieldAlert, XCircle, UserCircle } from 'lucide-react';
import adccLogo from './Applogo.png';
import Equipos from './pages/Equipos';
import Partidos from './pages/Partidos';
import MatchDetail from './pages/MatchDetail';
import NotFound from './pages/NotFound';
import RefereeGuide from './pages/RefereeGuide';

import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { logEvent } from './services/auditService';

// ============================================================================
// 1. CONSTANTS & CONFIG
// ============================================================================
const ADMIN_UIDS = ['kPkuIN4DxkTAvistlsAeoKjEFNx2']; // UID del Admin Principal
// Puedes agregar tu UID de desarrollador aquí si lo conoces, o mantener el email temporalmente para dev
const DEV_EMAILS = ['dev@admin.com', 'admin@admin.com'];
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
        console.warn("No se pudo verificar actualizacion", e);
      }
    };
    checkUpdate();

    // 2. Cargar modelos.
    loadModelsLocal()
      .then((res) => {
        if (res.success) {
          setModelsLoaded(true);
        } else {
          console.error("Error loading models:", res.error);
          setError(res.error || "Error al cargar modelos");
        }
      })
      .catch((err: any) => {
        console.error("DEBUG IA ERROR:", err);
        setError(err.message || String(err));
      });

    // 3. Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Usuario detectado UID:", user.uid); // Para ver tu UID de dev si lo necesitas
        const email = user.email?.toLowerCase() || '';

        const isAdmin = ADMIN_UIDS.includes(user.uid);
        const isDev = DEV_EMAILS.includes(email);
        const isReferee = REFEREE_EMAILS.includes(email);

        if (isAdmin) {
          setUserRole('admin');
        } else if (isDev) {
          setUserRole('dev');
        } else if (isReferee) {
          setUserRole('referee');
        } else {
          setUserRole('user');
        }

        // Registrar ingreso si es un cambio de estado a logueado
        if (user) {
          const role = isAdmin ? 'admin' : (isDev ? 'dev' : (isReferee ? 'referee' : 'user'));
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
      console.log("Detectada nueva versión, limpiando caché...");
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
      console.log("Login exitoso");
    } catch (err: any) {
      console.error("Error de login:", err);
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
  const [matcher, setMatcher] = useState<any>(null);
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

    const startDetection = async () => {
      // Init Hybrid Engine if needed (though usually done at app start)
      await initHybridEngine();

      // Load users for matcher
      const currentUsers = await getUsers();
      const newMatcher = createMatcher(currentUsers);
      setMatcher(newMatcher);

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
        if (data && matcher) {
          const { descriptor } = data;
          const bestMatch = matcher.findBestMatch(descriptor);

          if (bestMatch.label !== 'unknown') {
            const users = await getUsers();
            const matchedUser = users.find(u => u.id === bestMatch.label);

            if (matchedUser) {
              console.log("Login exitoso vía Facial:", matchedUser.name);
              // Access Logic: Check if enabled? 
              // For now, just login.
              setUserRole(matchedUser.role || 'admin');
              setLoadingAuth(false);
              setShowFaceLogin(false);
              alert(`Bienvenido, ${matchedUser.name}`);
            }
          } else {
            setStatusText('Desconocido');
          }
        }
      } catch (err) {
        console.error("Error Login:", err);
      } finally {
        isDeepProcessing = false;
        setMatchingFace(false);
        setStatusText('Escaneando...');
      }
    };

    startDetection();

    return () => clearInterval(interval);
  }, [showFaceLogin]);

  // ============================================================================
  // 6. RENDER UI
  // ============================================================================
  // ... inside return ...

  {/* Modal de Login Facial */ }
  {
    showFaceLogin && (
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
          <div className="webcam-wrapper" style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', border: '2px solid rgba(212, 175, 55, 0.3)', position: 'relative', borderRadius: '24px' }}>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
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
                  <div style={{ height: '100%', width: `${scanProgress}%`, background: '#d4af37', transition: 'width 0.1s linear' }} />
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
    )
  }

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
      console.error("Error al salir:", err);
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

  if (!modelsLoaded || loadingAuth) {
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
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.05) 0%, transparent 70%)',
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
            border: '1px solid rgba(212, 175, 55, 0.1)',
            borderTop: '2px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)'
          }}></div>

          {/* Middle Counter-Rotating Ring */}
          <div style={{
            position: 'absolute',
            width: '85%',
            height: '85%',
            border: '1px solid rgba(212, 175, 55, 0.05)',
            borderBottom: '1px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 3s linear infinite reverse',
            opacity: 0.6
          }}></div>

          {/* Innermost Pulsing Ring */}
          <div style={{
            position: 'absolute',
            width: '70%',
            height: '70%',
            border: '2px solid rgba(212, 175, 55, 0.2)',
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
              alt="ADCC Logo"
              style={{
                width: '70px',
                filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.5)) brightness(1.1)'
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
              ADCC<span style={{ color: '#d4af37', marginLeft: '8px', textShadow: '0 0 20px rgba(212, 175, 55, 0.6)' }}>BIOMETRIC</span>
            </h1>
          </div>

          <div style={{
            marginTop: '40px',
            color: '#d4af37',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            background: 'rgba(212, 175, 55, 0.05)',
            padding: '10px 20px',
            borderRadius: '99px',
            border: '1px solid rgba(212, 175, 55, 0.1)',
            backdropFilter: 'blur(5px)'
          }}>
            <RefreshCw size={14} className="animate-spin" style={{ color: '#d4af37' }} />
            <span style={{ fontWeight: '700' }}>
              {!modelsLoaded ? 'Initializing AI Systems...' : 'Verifying Identity...'}
            </span>
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

        <div style={{
          position: 'fixed',
          bottom: '40px',
          color: 'rgba(255, 255, 255, 0.2)',
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '5px',
          textTransform: 'uppercase'
        }}>
          ELITE CORE ENGINE <span style={{ color: '#d4af37' }}>v{VERSION}</span>
        </div>

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.3; border-color: rgba(212, 175, 55, 0.2); }
            50% { transform: scale(1.1); opacity: 0.8; border-color: rgba(212, 175, 55, 0.5); }
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

        {/* Botón Paleta de Colores */}
        <button
          onClick={() => setShowPaletteMenu(!showPaletteMenu)}
          className="glass-button floating-palette-toggle"
        >
          <Palette size={20} />
        </button>

        {showPaletteMenu && (
          <div className="glass-panel palette-menu-panel">
            <div className="panel-header" style={{ marginBottom: '0' }}>
              <span className="panel-label">🎨 Estilo Visual</span>
              <X size={16} style={{ cursor: 'pointer' }} onClick={() => setShowPaletteMenu(false)} />
            </div>
            {[

              { id: 'default', name: 'Negro y Oro (default)', color: '#d4af37' },
              { id: 'violet', name: 'Violeta Cyber', color: '#8b5cf6' },
              { id: 'rose', name: 'Rosa Intenso', color: '#f43f5e' },
              { id: 'cyan', name: 'Cian Futuro', color: '#06b6d4' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => { setPalette(p.id); setShowPaletteMenu(false); }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${palette === p.id ? p.color : 'transparent'}`,
                  padding: '10px',
                  borderRadius: '10px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color }}></div>
                {p.name}
                {palette === p.id && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>ACTIVO</span>}
              </button>
            ))}
          </div>
        )}

        <Navigation userRole={userRole} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />

        {/* Indicador de Modo Offline */}
        {!isOnline && (
          <div className="offline-indicator">
            <WifiOff size={16} /> MODO OFFLINE - Los cambios se sincronizarán al conectar
          </div>
        )}

        <main className="container" style={{ paddingBottom: '120px', paddingTop: '40px' }}>
          <Routes>
            <Route path="/" element={userRole !== 'public' ? <Home userRole={userRole} /> : (
              <AdminLogin
                handleLogin={handleLogin}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                onFaceLogin={() => setShowFaceLogin(true)}
              />
            )} />

            {/* Rutas Protegidas (Solo Autenticados con Permisos) */}
            <Route path="/register" element={<ProtectedRoute isAllowed={isAdminOrDev || userRole === 'referee'}><Register /></ProtectedRoute>} />
            <Route path="/alta" element={<ProtectedRoute isAllowed={userRole === 'admin' || userRole === 'dev' || userRole === 'referee'}><AltaLocal /></ProtectedRoute>} />
            <Route path="/equipos" element={<ProtectedRoute isAllowed={userRole !== 'public'}><Equipos /></ProtectedRoute>} />
            <Route path="/partidos" element={<ProtectedRoute isAllowed={userRole !== 'public'}><Partidos userRole={userRole} /></ProtectedRoute>} />
            <Route path="/partido/:id" element={<ProtectedRoute isAllowed={userRole !== 'public'}><MatchDetail userRole={userRole} /></ProtectedRoute>} />
            <Route path="/novedades" element={<ProtectedRoute isAllowed={userRole !== 'public'}><Novedades /></ProtectedRoute>} />
            <Route path="/estadisticas" element={<ProtectedRoute isAllowed={userRole !== 'public'}><Stats /></ProtectedRoute>} />
            <Route path="/guia-arbitro" element={<ProtectedRoute isAllowed={userRole === 'referee' || userRole === 'admin' || userRole === 'dev'}><RefereeGuide /></ProtectedRoute>} />

            {/* Rutas de Desarrollador */}
            <Route path="/config" element={<ProtectedRoute isAllowed={userRole === 'dev'}><Config /></ProtectedRoute>} />
            <Route path="/dev" element={<ProtectedRoute isAllowed={userRole === 'dev'}><DevTools /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute isAllowed={isAdminOrDev}><AuditLogs /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>



          <footer style={{ marginTop: '50px', textAlign: 'center', opacity: 0.3, fontSize: '0.7rem', paddingBottom: '20px' }}>
            2026 Gbro
          </footer>
        </main>
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

const AdminLogin: React.FC<AdminLoginProps> = ({ handleLogin, loginForm, setLoginForm, onFaceLogin }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '400px', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src={adccLogo} alt="ADCC Logo" style={{ width: '100px', marginBottom: '20px' }} />
        <h2 style={{ margin: 0 }}>ADCC <span style={{ color: 'var(--primary)' }}>Admin</span></h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Inicia sesión para ver los registros</p>
      </div>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          type="email"
          placeholder="Email (ej: admin@adcc.com)"
          className="premium-input"
          value={loginForm.user}
          onChange={(e) => setLoginForm({ ...loginForm, user: e.target.value.toLowerCase() })}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          className="premium-input"
          value={loginForm.pass}
          onChange={(e) => setLoginForm({ ...loginForm, pass: e.target.value })}
        />
        <button type="submit" className="glass-button" style={{ width: '100%', marginTop: '10px' }}>
          Entrar <LogIn size={18} />
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '25px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.3, fontWeight: 'bold' }}>o accede con</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
      </div>

      <button
        onClick={onFaceLogin}
        className="glass-premium"
        style={{
          width: '100%',
          padding: '15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.1)',
          cursor: 'pointer',
          borderRadius: '16px',
          color: 'var(--primary)',
          fontWeight: '800',
          textTransform: 'uppercase',
          fontSize: '11px',
          letterSpacing: '1px'
        }}
      >
        <ScanFace size={20} className="animate-pulse" />
        Reconocimiento Facial
      </button>
    </div>
  </div>
);

interface NavigationProps {
  userRole: string;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ userRole, onLogout, theme, toggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="app-nav">

      {/* Logo in Desktop Sidebar */}
      <div className="hide-mobile" style={{ marginBottom: '20px', padding: '10px' }}>
        <div style={{ fontWeight: '800', letterSpacing: '-1px', color: 'var(--primary)' }}>ADCC</div>
      </div>

      <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Inicio" active={location.pathname === "/"} />

      {userRole !== 'public' && (
        <>
          {/* 2. Reconocimiento (Alta) */}
          {userRole !== 'usuario' && <NavItem to="/alta" icon={<ScanFace size={20} />} label="Reconocimiento" active={location.pathname === "/alta"} />}

          {/* 3. Registro */}
          {userRole !== 'referee' && userRole !== 'usuario' && <NavItem to="/register" icon={<UserRoundPlus size={20} />} label="Registro" active={location.pathname === "/register"} />}

          {/* 4. Partidos */}
          <NavItem to="/partidos" icon={<Swords size={20} />} label="Partidos" active={location.pathname === "/partidos" || location.pathname.startsWith('/partido')} />

          {/* 5. Torneos (Equipos) */}
          <NavItem to="/equipos" icon={<Shield size={20} />} label="Torneos" active={location.pathname === "/equipos"} />

          {/* Resto */}
          {userRole !== 'referee' && userRole !== 'usuario' && <NavItem to="/novedades" icon={<Bell size={20} />} label="Novedades" active={location.pathname === "/novedades"} />}

          <NavItem to="/estadisticas" icon={<PieChart size={20} />} label="Estadísticas" active={location.pathname === "/estadisticas"} />

          {userRole !== 'public' && userRole !== 'usuario' && (
            <div
              className="nav-item"
              onClick={() => {
                const code = prompt("Ingrese el código de acceso al historial:");
                if (code === '583491') {
                  navigate('/audit');
                } else if (code !== null) {
                  alert("Código incorrecto");
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <div style={{
                padding: '8px',
                borderRadius: '12px',
                background: location.pathname === "/audit" ? 'var(--primary-glow)' : 'transparent',
                color: location.pathname === "/audit" ? 'var(--primary)' : 'inherit',
                transition: 'none'
              }}><ShieldAlert size={20} /></div>
              <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: location.pathname === "/audit" ? '700' : '500' }}>Historial</span>
            </div>
          )}
          {(userRole === 'referee' || userRole === 'admin' || userRole === 'dev') && (
            <NavItem to="/guia-arbitro" icon={<Mic size={20} />} label="Voz Árbitro" active={location.pathname === "/guia-arbitro"} />
          )}
          {userRole === 'dev' && (
            <>
              <NavItem to="/config" icon={<Sliders size={20} />} label="Ajustes" active={location.pathname === "/config"} />
              <NavItem to="/dev" icon={<Code2 size={20} />} label="Dev" active={location.pathname === "/dev"} />
            </>
          )}
        </>
      )}

      {userRole !== 'public' && (
        <div onClick={onLogout} className="nav-item" style={{ cursor: 'pointer', color: '#f87171', marginTop: 'auto' }}>
          <div style={{ padding: '8px', borderRadius: '12px' }}>
            <Unlock size={20} />
          </div>
          <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: '500' }}>Salir</span>
        </div>
      )}
    </nav>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, active }) => (
  <Link to={to} className={`nav-item ${active ? 'active' : ''}`}>
    <div style={{
      padding: '8px',
      borderRadius: '12px',
      background: active ? 'var(--primary-glow)' : 'transparent',
      color: active ? 'var(--primary)' : 'inherit',
      transition: 'none'
    }}>
      {icon}
    </div>
    <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: active ? '700' : '500' }}>{label}</span>
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
