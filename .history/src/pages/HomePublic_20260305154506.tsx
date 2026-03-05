import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogIn, Calendar, ArrowRight, Shield, Swords } from 'lucide-react';
import { m, LazyMotion, domAnimation, AnimatePresence } from 'framer-motion';
import AppLogo from '../Applogo.png';

const HomePublic = () => {
    const navigate = useNavigate();

    const menuItems = [
        {
            title: 'PARTIDOS',
            subtitle: 'Resultados y Fixture',
            description: 'Sigue la acción en tiempo real con actualizaciones minuto a minuto.',
            icon: <Swords size={32} />,
            path: '/partidos',
            color: '#3b82f6',
            delay: 0.2
        },
        {
            title: 'TORNEOS',
            subtitle: 'Equipos y Tablas',
            description: 'Explora los clubes, categorías y el camino a la gloria.',
            icon: <Shield size={32} />,
            path: '/equipos',
            color: '#d4af37',
            delay: 0.3
        }
    ];

    return (
        <LazyMotion features={domAnimation}>
            <div className="home-public-wrapper" style={{
                minHeight: '100vh',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#000',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif"
            }}>

                {/* Background Animated Blobs */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                    <m.div
                        animate={{
                            x: [0, 100, 0],
                            y: [0, 50, 0],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        style={{
                            position: 'absolute',
                            top: '-10%',
                            right: '-10%',
                            width: '600px',
                            height: '600px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
                            filter: 'blur(80px)'
                        }}
                    />
                    <m.div
                        animate={{
                            x: [0, -80, 0],
                            y: [0, 100, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        style={{
                            position: 'absolute',
                            bottom: '10%',
                            left: '-10%',
                            width: '500px',
                            height: '500px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                            filter: 'blur(80px)'
                        }}
                    />
                </div>

                <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: '60px', paddingBottom: '100px' }}>

                    {/* Hero Section */}
                    <m.section
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ textAlign: 'center', marginBottom: '80px' }}
                    >
                        <m.div
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            style={{ display: 'inline-block', marginBottom: '40px' }}
                        >
                            <img
                                src={AppLogo}
                                alt="ADCC Logo"
                                style={{
                                    width: '160px',
                                    height: 'auto',
                                    filter: 'drop-shadow(0 0 30px rgba(212, 175, 55, 0.4))'
                                }}
                            />
                        </m.div>

                        <h1 style={{
                            fontSize: 'clamp(3rem, 10vw, 5.5rem)',
                            fontWeight: '900',
                            lineHeight: '0.9',
                            margin: '0 0 20px 0',
                            letterSpacing: '-4px',
                            textTransform: 'uppercase'
                        }}>
                            ADCC<br />
                            <span style={{
                                color: 'transparent',
                                WebkitTextStroke: '1px rgba(255,255,255,0.3)',
                                letterSpacing: '2px'
                            }}>BIOMÉTRICA</span>
                        </h1>

                        <p style={{
                            fontSize: '1.2rem',
                            color: 'rgba(255,255,255,0.6)',
                            maxWidth: '600px',
                            margin: '0 auto 40px auto',
                            fontWeight: '400',
                            lineHeight: '1.6'
                        }}>
                            Ecosistema digital de élite para la gestión deportiva.
                            Tecnología aplicada al fútbol amateur de máximo nivel.
                        </p>

                        <m.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/login')}
                            className="glass-button"
                            style={{
                                background: '#fff',
                                color: '#000',
                                padding: '18px 45px',
                                borderRadius: '40px',
                                fontSize: '1.1rem',
                                fontWeight: '800',
                                border: 'none',
                                boxShadow: '0 20px 40px rgba(255,255,255,0.2)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <LogIn size={20} /> INGRESAR
                        </m.button>
                    </m.section>

                    {/* Navigation Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: '30px',
                        maxWidth: '1000px',
                        margin: '0 auto'
                    }}>
                        {menuItems.map((item) => (
                            <m.div
                                key={item.title}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: item.delay, duration: 0.8 }}
                                whileHover={{ y: -10 }}
                                onClick={() => navigate(item.path)}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '40px',
                                    padding: '50px 40px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '20px',
                                    transition: 'border-color 0.3s ease'
                                }}
                                className="premium-card"
                            >
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '24px',
                                    background: `linear-gradient(135deg, ${item.color}44, transparent)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: item.color,
                                    border: `1px solid ${item.color}33`
                                }}>
                                    {item.icon}
                                </div>

                                <div>
                                    <h4 style={{ color: item.color, fontSize: '0.9rem', fontWeight: '800', letterSpacing: '2px', marginBottom: '8px' }}>{item.title}</h4>
                                    <h3 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '15px' }}>{item.subtitle}</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', lineHeight: '1.5' }}>{item.description}</p>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                                    EXPLORAR <ArrowRight size={16} />
                                </div>

                                {/* Hover Glow */}
                                <div className="card-glow" style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: `radial-gradient(circle at center, ${item.color}11, transparent 70%)`,
                                    opacity: 0,
                                    transition: 'opacity 0.3s ease',
                                    pointerEvents: 'none',
                                    borderRadius: '40px'
                                }} />
                            </m.div>
                        ))}
                    </div>

                    <m.footer
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                        style={{ marginTop: '100px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '40px' }}
                    >
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', letterSpacing: '1px' }}>
                            © 2025 ADCC CANNING • TODOS LOS DERECHOS RESERVADOS
                        </p>
                    </m.footer>
                </div>

                <style>{`
                    .premium-card:hover {
                        border-color: rgba(255,255,255,0.2);
                        background: rgba(255,255,255,0.05);
                    }
                    .premium-card:hover .card-glow {
                        opacity: 1;
                    }
                    @media (max-width: 768px) {
                        .home-public-wrapper {
                            padding-top: 20px;
                        }
                    }
                `}</style>
            </div>
        </LazyMotion>
    );
};

export default HomePublic;

