import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToMatches } from '../services/matchesService';
import { Swords, Shield, PieChart, Clock, Activity, ChevronRight, Zap, Trophy, BarChart2, Star } from 'lucide-react';
import adccLogo from '../Applogo.png';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';

const HomeUser = () => {
    const navigate = useNavigate();
    const [activeMatches, setActiveMatches] = useState<any[]>([]);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const unsubscribe = subscribeToMatches((matches) => {
            const active = matches.filter(m => m.status === 'live' || m.status === 'scheduled');
            setActiveMatches(active.slice(0, 5));
        });
        return () => unsubscribe();
    }, []);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const hours = time.getHours();
    const greeting = hours < 12 ? 'Buenos días' : hours < 18 ? 'Buenas tardes' : 'Buenas noches';
    const timeStr = time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    const liveCount = activeMatches.filter(m => m.status === 'live').length;

    const quickActions = [
        { icon: <Swords size={26} />, label: 'Partidos', color: '#d4af37', path: '/partidos' },
        { icon: <Shield size={26} />, label: 'Torneos', color: '#3b82f6', path: '/equipos' },
        { icon: <BarChart2 size={26} />, label: 'Stats', color: '#10b981', path: '/estadisticas' },
        { icon: <Trophy size={26} />, label: 'Ranking', color: '#f59e0b', path: '/equipos' },
    ];

    return (
        <LazyMotion features={domAnimation}>
            <div style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '100px' }}>

                {/* ── HERO HEADER ── */}
                <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '40px 20px 80px',
                    background: 'linear-gradient(180deg, rgba(212,175,55,0.08) 0%, transparent 100%)',
                    borderBottom: '1px solid rgba(212,175,55,0.1)',
                }}>
                    {/* Glow blob */}
                    <div style={{
                        position: 'absolute', top: '-30%', right: '-10%',
                        width: '300px', height: '300px',
                        background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
                        borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
                                {greeting}
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', margin: 0, lineHeight: 1.1 }}>
                                Bienvenido<br />
                                <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(212,175,55,0.4)' }}>Deportista</span>
                            </h1>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1 }}>{timeStr}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>{dateStr}</div>
                        </div>
                    </div>

                    {/* Logo pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', position: 'relative', zIndex: 1 }}>
                        <img src={adccLogo} alt="ADCC" style={{ width: '28px', opacity: 0.9 }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '3px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ADCC Biometric</span>
                    </div>
                </div>

                {/* ── CONTENT (overlapping hero) ── */}
                <div style={{ padding: '0 16px', marginTop: '-40px', position: 'relative', zIndex: 2 }}>

                    {/* Live indicator card */}
                    {liveCount > 0 && (
                        <m.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '16px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '16px',
                                cursor: 'pointer',
                            }}
                            onClick={() => navigate('/partidos')}
                        >
                            <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                background: '#ef4444', flexShrink: 0,
                                boxShadow: '0 0 8px #ef4444',
                                animation: 'userPulse 1.5s ease-in-out infinite'
                            }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#f87171' }}>
                                    {liveCount} partido{liveCount > 1 ? 's' : ''} en vivo
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toca para ver</div>
                            </div>
                            <ChevronRight size={18} color="#f87171" />
                        </m.div>
                    )}

                    {/* Quick Actions Grid */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
                            Accesos Rápidos
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {quickActions.map((action, i) => (
                                <m.button
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 25 }}
                                    onClick={() => navigate(action.path)}
                                    style={{
                                        background: `rgba(${action.color === '#d4af37' ? '212,175,55' : action.color === '#3b82f6' ? '59,130,246' : action.color === '#10b981' ? '16,185,129' : '245,158,11'}, 0.08)`,
                                        border: `1px solid ${action.color}22`,
                                        borderRadius: '18px',
                                        padding: '16px 8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        color: action.color,
                                    }}
                                >
                                    {action.icon}
                                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {action.label}
                                    </span>
                                </m.button>
                            ))}
                        </div>
                    </div>

                    {/* Matches Section */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                Partidos
                            </div>
                            <button
                                onClick={() => navigate('/partidos')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                Ver todos <ChevronRight size={14} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeMatches.length === 0 ? (
                                <div style={{
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '20px',
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                }}>
                                    <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>No hay partidos activos</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }}>Los partidos aparecerán aquí en tiempo real</div>
                                </div>
                            ) : (
                                activeMatches.map((match, i) => (
                                    <m.div
                                        key={match.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                        onClick={() => navigate(`/partido/${match.id}`)}
                                        style={{
                                            background: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '20px',
                                            padding: '16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            position: 'relative',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {/* Status accent bar */}
                                        <div style={{
                                            position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                                            background: match.status === 'live' ? '#ef4444' : '#d4af37',
                                            borderRadius: '3px 0 0 3px'
                                        }} />

                                        <div style={{ paddingLeft: '4px', flex: 1 }}>
                                            {/* Status pill */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: '800', letterSpacing: '1px',
                                                    padding: '2px 8px', borderRadius: '99px', textTransform: 'uppercase',
                                                    background: match.status === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(212,175,55,0.1)',
                                                    color: match.status === 'live' ? '#ef4444' : '#d4af37',
                                                    border: `1px solid ${match.status === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(212,175,55,0.2)'}`,
                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                }}>
                                                    {match.status === 'live' && (
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                                                    )}
                                                    {match.status === 'live' ? 'En Vivo' : 'Programado'}
                                                </span>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{match.category}</span>
                                            </div>

                                            {/* Score row */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', flex: 1 }}>{match.teamA?.name || 'Equipo A'}</div>
                                                <div style={{
                                                    fontWeight: '900', fontSize: '1.1rem', letterSpacing: '4px', padding: '4px 12px',
                                                    background: 'rgba(255,255,255,0.04)', borderRadius: '10px', margin: '0 8px',
                                                    color: match.status === 'live' ? '#ef4444' : 'var(--primary)',
                                                }}>
                                                    {match.score?.a ?? 0} - {match.score?.b ?? 0}
                                                </div>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', flex: 1, textAlign: 'right' }}>{match.teamB?.name || 'Equipo B'}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} color="var(--text-muted)" />
                                    </m.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer brand */}
                    <div style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: 0.25 }}>
                            <Star size={12} />
                            <span style={{ fontSize: '0.6rem', letterSpacing: '3px', fontWeight: '800', textTransform: 'uppercase' }}>ADCC Elite Platform</span>
                            <Star size={12} />
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes userPulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.4); opacity: 0.6; }
                    }
                `}</style>
            </div>
        </LazyMotion>
    );
};

export default HomeUser;


const HomeUser = () => {
    const navigate = useNavigate();
    const [activeMatches, setActiveMatches] = useState<any[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToMatches((matches) => {
            const active = matches.filter(m => m.status === 'live' || m.status === 'scheduled');
            setActiveMatches(active.slice(0, 4));
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="home-container animate-fade-in" style={{ padding: '20px' }}>
            <header className="home-premium-header" style={{ marginBottom: '30px' }}>
                <div className="header-brand">
                    <img src={adccLogo} alt="ADCC" className="logo-small drop-shadow-gold" />
                    <div>
                        <h1 className="brand-title">ADCC <span className="text-highlight amber-glow">BIOMETRIC</span></h1>
                        <p className="brand-subtitle">Bienvenido a la Plataforma Elite</p>
                    </div>
                </div>
            </header>

            <div className="glass-premium" style={{
                padding: '40px',
                borderRadius: '32px',
                marginBottom: '40px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div className="panel-decoration-blob" style={{ left: '-5%', top: '-5%', background: 'var(--primary-glow)', opacity: '0.1' }}></div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '10px', background: 'linear-gradient(to right, #fff, #d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ¡Hola! Bienvenido
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                    Has ingresado a la central biométrica de ADCC. Aquí podrás seguir los partidos en tiempo real y consultar estadísticas de los torneos.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="panel-premium" style={{ height: 'fit-content' }}>
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <h3 className="panel-label">PARTIDOS EN VIVO</h3>
                            <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Seguimiento Directo</p>
                        </div>
                        <Activity size={24} className="text-highlight animate-pulse" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                        {activeMatches.length === 0 ? (
                            <div className="text-center" style={{ padding: '40px', opacity: 0.5 }}>
                                <Clock size={32} style={{ margin: '0 auto 10px' }} />
                                <p>No hay partidos en curso en este momento.</p>
                            </div>
                        ) : (
                            activeMatches.map((match) => (
                                <div
                                    key={match.id}
                                    className="match-item-compact glass-panel group"
                                    onClick={() => navigate(`/partido/${match.id}`)}
                                    style={{ cursor: 'pointer', padding: '15px' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{match.teamA.name}</div>
                                        </div>
                                        <div className="score-badge-premium" style={{ margin: '0 20px' }}>
                                            {match.score?.a ?? 0} - {match.score?.b ?? 0}
                                        </div>
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{match.teamB?.name || 'Equipo B'}</div>
                                        </div>
                                    </div>
                                    <div className="text-center" style={{ marginTop: '10px', fontSize: '0.7rem', opacity: 0.5 }}>
                                        {match.category} • {match.status.toUpperCase()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/partidos')}
                        className="glass-button w-full mt-4"
                        style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37' }}
                    >
                        VER TODOS LOS PARTIDOS <Swords size={16} />
                    </button>
                </div>

                <div className="panel-premium" style={{ height: 'fit-content' }}>
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <h3 className="panel-label">ACCESOS RÁPIDOS</h3>
                            <p>Explorar Plataforma</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
                        <div
                            className="glass-panel"
                            style={{ padding: '20px', textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => navigate('/equipos')}
                        >
                            <Shield size={32} style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>TORNEOS</div>
                        </div>
                        <div
                            className="glass-panel"
                            style={{ padding: '20px', textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => navigate('/estadisticas')}
                        >
                            <PieChart size={32} style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>ESTADÍSTICAS</div>
                        </div>
                    </div>


                </div>
            </div>

            <footer style={{ marginTop: '60px', textAlign: 'center', opacity: 0.3, fontSize: '0.7rem', marginBottom: '40px' }}>
                SISTEMA BIOMÉTRICO ADCC • AGENTE DE SEGURIDAD ELITE
            </footer>
        </div>
    );
};

export default HomeUser;
