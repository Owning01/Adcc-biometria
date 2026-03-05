/**
 * @file HomePublic.tsx
 * @description Pantalla de inicio para usuarios visitantes (públicos).
 * Ofrece una vista premium y atractiva de la liga ADCC BIOMETRICA.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, Activity, ChevronRight, LogIn, Calendar, Star } from 'lucide-react';
import { m, LazyMotion, domAnimation } from 'framer-motion';
import AppLogo from '../Applogo.png';

const HomePublic = () => {
    const navigate = useNavigate();

    const sections = [
        {
            title: 'PARTIDOS',
            subtitle: 'Resultados y Fixture en vivo',
            icon: <Calendar className="text-primary" size={24} />,
            path: '/partidos',
            color: 'var(--primary)'
        },
        {
            title: 'EQUIPOS',
            subtitle: 'Clubes y Categorías',
            icon: <Users className="text-blue-400" size={24} />,
            path: '/equipos',
            color: '#60a5fa'
        }
    ];

    return (
        <LazyMotion features={domAnimation}>
            <div className="home-public-container animate-fade-in" style={{ padding: '20px 0' }}>

                {/* Hero Section */}
                <section className="glass-panel" style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    marginBottom: '30px',
                    background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent)',
                    border: '1px solid var(--glass-border)'
                }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        style={{ display: 'inline-block', marginBottom: '20px' }}
                    >
                        <img src={AppLogo} alt="ADCC Logo" style={{ width: '100px', height: 'auto', filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.3))' }} />
                    </m.div>

                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-1px' }}>
                        ADCC <span className="text-highlight">BIOMÉTRICA</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 30px auto' }}>
                        La plataforma oficial de gestión y estadísticas en tiempo real de la liga ADCC.
                    </p>

                    <button
                        onClick={() => navigate('/login')}
                        className="glass-button active"
                        style={{
                            padding: '12px 30px',
                            fontSize: '1rem',
                            fontWeight: '700',
                            gap: '10px'
                        }}
                    >
                        <LogIn size={20} /> INGRESAR AL SISTEMA
                    </button>
                </section>

                {/* Grid de Accesos */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px'
                }}>
                    {sections.map((section, idx) => (
                        <m.div
                            key={section.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * idx }}
                            onClick={() => navigate(section.path)}
                            className="glass-panel hover-card"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '16px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--glass-border-light)'
                            }}>
                                {section.icon}
                            </div>

                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{section.title}</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{section.subtitle}</p>
                            </div>

                            <ChevronRight size={20} className="text-muted" />

                            {/* Sutil glow en hover */}
                            <div className="card-glow" style={{ backgroundColor: section.color }} />
                        </m.div>
                    ))}
                </div>

                {/* Footer Info */}
                <footer style={{ marginTop: '50px', textAlign: 'center', opacity: 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <Star size={12} className="text-yellow-500" />
                        <span>Experiencia Premium ADCC 2025</span>
                    </div>
                </footer>

                <style>{`
                    .hover-card:hover {
                        transform: translateY(-5px);
                        border-color: var(--primary-glow);
                        box-shadow: 0 10px 30px -10px rgba(59, 130, 246, 0.2);
                    }
                    .card-glow {
                        position: absolute;
                        top: -50%;
                        right: -50%;
                        width: 100px;
                        height: 100px;
                        filter: blur(60px);
                        opacity: 0;
                        transition: opacity 0.3s;
                        pointer-events: none;
                    }
                    .hover-card:hover .card-glow {
                        opacity: 0.2;
                    }
                `}</style>
            </div>
        </LazyMotion>
    );
};

export default HomePublic;
