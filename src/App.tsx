/**
 * @file App.jsx
 * @description Punto de entrada principal de la aplicación.
 * Maneja el enrutamiento, autenticación, control de versiones y lógica global de actualización.
 */
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { loadModels } from './services/faceService';
import Home from './pages/Home';
import Register from './pages/Register';
import AltaLocal from './pages/AltaLocal';
import Config from './pages/Config';
import DevTools from './pages/DevTools';
import Novedades from './pages/Novedades';
import Stats from './pages/Stats';

import { UserPlus, Home as HomeIcon, Search, RefreshCw, Zap, Lock, Unlock, LogIn, Settings, Globe, Terminal, Users, Trophy, Moon, Sun, WifiOff, CloudOff, Sparkles, BarChart2 } from 'lucide-react';
import adccLogo from './Applogo.png';
import Equipos from './pages/Equipos';
import Partidos from './pages/Partidos';
import MatchDetail from './pages/MatchDetail';
import NotFound from './pages/NotFound';

import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

function App() {
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('public');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'dark');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // @ts-ignore
  const [updateRequired, setUpdateRequired] = useState<boolean>(false);
  const [updateUrl, setUpdateUrl] = useState<string>('');
  const [availableVersion, setAvailableVersion] = useState<string>('');
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

  useEffect(() => {
    // 1. Check Update
    const checkUpdate = async () => {
      try {
        const res = await fetch('https://recofacial-7cea1.web.app/version.json?t=' + Date.now());
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

    // 2. Load Models
    loadModels()
      .then(() => setModelsLoaded(true))
      .catch((err: any) => {
        console.error("DEBUG IA ERROR:", err);
        setError(err.message || String(err));
      });

    // 3. Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Mapeo simple de roles por email (puedes ampliarlo con Custom Claims luego)
        if (user.email === 'admin@admin.com') {
          setUserRole('admin');
        } else if (user.email === 'dev@admin.com') {
          setUserRole('dev');
        } else {
          setUserRole('public'); // Default to public if logged in but no specific role
        }
      } else {
        setUserRole('public');
      }
      setLoadingAuth(false); // Auth state determined, stop loading
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
  }, [VERSION, theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

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
        background: '#020617',
        color: 'white',
        flexDirection: 'column'
      }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <div className="loader" style={{
            width: '80px',
            height: '80px',
            border: '4px solid rgba(59, 130, 246, 0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite'
          }}></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.5 }}>
            <RefreshCw size={24} className="animate-spin" />
          </div>
        </div>
        <img src={adccLogo} alt="ADCC Logo" style={{ width: '120px', marginBottom: '20px' }} />
        <h2 style={{ fontWeight: '300', letterSpacing: '2px' }}>ADCC <span style={{ fontWeight: '700', color: '#3b82f6' }}>BIOMETRIC</span></h2>
        <p style={{ marginTop: '10px', color: '#64748b', fontSize: '0.9rem' }}>
          {!modelsLoaded ? 'Sincronizando modelos para ADCC...' : 'Verificando sesión...'}
        </p>

        {error && (
          <div className="glass-panel" style={{ color: '#f87171', fontSize: '13px', marginTop: '30px', padding: '15px 25px', border: '1px solid rgba(239, 68, 68, 0.2)', maxWidth: '80%' }}>
            <strong>Fallo de Inicialización:</strong><br />{error}
          </div>
        )}

        <div style={{ position: 'fixed', bottom: '20px', color: '#1e293b', fontSize: '10px' }}>
          CORE v{VERSION}
        </div>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .animate-spin { animation: spin 2s linear infinite; }
      `}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
        <div style={{ position: 'fixed', bottom: '100px', right: '20px', fontSize: '10px', color: '#1e293b', zIndex: 200, fontWeight: 'bold' }}>
          VER: {VERSION} {userRole !== 'public' && <span style={{ color: 'var(--success)' }}>[{userRole.toUpperCase()}]</span>}
        </div>

        {/* Botón Flotante Tema */}
        <button
          onClick={toggleTheme}
          className="glass-button"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 2000,
            padding: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <Navigation userRole={userRole} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />

        {/* Indicador de Modo Offline */}
        {!isOnline && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#f59e0b',
            color: '#020617',
            padding: '8px 20px',
            borderRadius: '99px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
            animation: 'fadeInDown 0.5s ease'
          }}>
            <WifiOff size={16} /> MODO OFFLINE - Los cambios se sincronizarán al conectar
          </div>
        )}

        <main className="container" style={{ paddingBottom: '120px', paddingTop: '40px' }}>
          <Routes>
            <Route path="/" element={userRole !== 'public' ? <Home /> : (
              <AdminLogin
                handleLogin={handleLogin}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
              />
            )} />
            <Route path="/register" element={userRole !== 'public' ? <Register /> : <Home />} />
            <Route path="/alta" element={userRole !== 'public' ? <AltaLocal /> : <Home />} />
            <Route path="/equipos" element={userRole !== 'public' ? <Equipos /> : <Home />} />
            <Route path="/partidos" element={userRole !== 'public' ? <Partidos /> : <Home />} />
            <Route path="/partido/:id" element={userRole !== 'public' ? <MatchDetail /> : <Home />} />
            <Route path="/config" element={userRole === 'dev' ? <Config /> : <Home />} />
            <Route path="/dev" element={userRole === 'dev' ? <DevTools /> : <Home />} />
            <Route path="/novedades" element={userRole !== 'public' ? <Novedades /> : <Home />} />
            <Route path="/estadisticas" element={userRole !== 'public' ? <Stats /> : <Home />} />


            <Route path="*" element={<NotFound />} />
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
}

const AdminLogin: React.FC<AdminLoginProps> = ({ handleLogin, loginForm, setLoginForm }) => (
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

  return (
    <nav className="mobile-nav" style={{ overflowX: 'auto', whiteSpace: 'nowrap', justifyContent: 'flex-start', padding: '10px 20px', maxWidth: '95vw', borderRadius: '20px' }}>
      <NavItem to="/" icon={<HomeIcon size={20} />} label="Inicio" active={location.pathname === "/"} />
      {userRole !== 'public' && (
        <>
          <NavItem to="/novedades" icon={<Sparkles size={20} />} label="Novedades" active={location.pathname === "/novedades"} />
          <NavItem to="/register" icon={<UserPlus size={20} />} label="Registro" active={location.pathname === "/register"} />
          <NavItem to="/alta" icon={<Search size={20} />} label="Consulta" active={location.pathname === "/alta"} />
          <NavItem to="/equipos" icon={<Users size={20} />} label="Torneos" active={location.pathname === "/equipos"} />
          <NavItem to="/estadisticas" icon={<BarChart2 size={20} />} label="Estadísticas" active={location.pathname === "/estadisticas"} />
          <NavItem to="/partidos" icon={<Trophy size={20} />} label="Partidos" active={location.pathname === "/partidos" || location.pathname.startsWith('/partido')} />
          {userRole === 'dev' && (
            <>
              <NavItem to="/config" icon={<Settings size={20} />} label="Ajustes" active={location.pathname === "/config"} />
              <NavItem to="/dev" icon={<Terminal size={20} />} label="Dev" active={location.pathname === "/dev"} />
            </>
          )}
        </>
      )}

      {userRole !== 'public' && (
        <div onClick={onLogout} className="nav-item" style={{ cursor: 'pointer', color: '#f87171' }}>
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
      background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
      color: active ? '#3b82f6' : 'inherit',
      transition: 'none'
    }}>
      {icon}
    </div>
    <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: active ? '700' : '500' }}>{label}</span>
  </Link>
);

export default App;
