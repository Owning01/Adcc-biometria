import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle, RefreshCw } from 'lucide-react';
import adccLogo from '../Applogo.png';

const NotFound = () => {
    return (
        <div style={{
            height: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '20px'
        }}>
            <div className="glass-panel" style={{
                padding: '50px 30px',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Decor */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '150px',
                    height: '150px',
                    background: 'var(--primary)',
                    filter: 'blur(100px)',
                    opacity: 0.1,
                    zIndex: 0
                }}></div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <img src={adccLogo} alt="ADCC" style={{ width: '100px', marginBottom: '25px', filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.3))' }} />

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '15px',
                            borderRadius: '50%',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            <AlertCircle size={40} color="#f87171" />
                        </div>
                    </div>

                    <h1 style={{ fontSize: '4rem', fontWeight: '900', margin: '0', color: 'white', letterSpacing: '-2px' }}>404</h1>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '15px', color: 'var(--primary)' }}>Página no encontrada</h2>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '35px', lineHeight: '1.6' }}>
                        Lo sentimos, la sección que buscas no existe o ha sido movida.
                        Verifica la URL o vuelve al inicio.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link to="/" className="glass-button" style={{
                            width: '100%',
                            background: 'var(--primary)',
                            color: 'white',
                            justifyContent: 'center',
                            gap: '10px'
                        }}>
                            <Home size={18} /> VOLVER AL INICIO
                        </Link>

                        <button onClick={() => window.location.reload()} className="glass-button" style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.05)',
                            justifyContent: 'center',
                            gap: '10px'
                        }}>
                            <RefreshCw size={18} /> RECARGAR SITIO
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '30px', fontSize: '0.8rem', opacity: 0.3 }}>
                ADCC Biometric System • v{__APP_VERSION__}
            </div>
        </div>
    );
};

export default NotFound;
