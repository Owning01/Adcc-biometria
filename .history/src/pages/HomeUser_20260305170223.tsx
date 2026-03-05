import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToMatches } from '../services/matchesService';
import { Swords, Shield, PieChart, Clock, ChevronRight, Trophy, BarChart2, Star, Award } from 'lucide-react';
import adccLogo from '../Applogo.png';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Footer from '../components/Footer';

const HomeUser = () => {
    const navigate = useNavigate();
    const [activeMatches, setActiveMatches] = useState<any[]>([]);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const unsubscribe = subscribeToMatches((matches: any[]) => {
            const active = matches.filter((m: any) => m.status === 'live' || m.status === 'scheduled');
            setActiveMatches(active.slice(0, 5));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const hours = time.getHours();
    const greeting = hours < 12 ? 'Buenos días' : hours < 18 ? 'Buenas tardes' : 'Buenas noches';
    const timeStr = time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const liveCount = activeMatches.filter((m: any) => m.status === 'live').length;

    const quickActions = [
        { icon: <Swords size={24} />, label: 'Partidos', color: 'var(--primary)', path: '/partidos' },
        { icon: <Shield size={24} />, label: 'Torneos', color: '#3b82f6', path: '/equipos' },
        { icon: <BarChart2 size={24} />, label: 'Stats', color: '#10b981', path: '/estadisticas' },
        { icon: <Award size={24} />, label: 'Ranking', color: '#f59e0b', path: '/equipos' },
    ];

    return (
        <LazyMotion features={domAnimation}>
            <div style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '100px' }}>

                {/* ── HERO HEADER ── */}
                <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '40px 20px 70px',
                    background: 'linear-gradient(180deg, rgba(0, 51, 102, 0.15) 0%, transparent 100%)',
                    borderBottom: '1px solid rgba(0, 135, 81, 0.1)',
                }}>
                    <div style={{
                        position: 'absolute', top: '-20%', right: '-10%',
                        width: '280px', height: '280px',
                        background: 'radial-gradient(circle, rgba(0, 135, 81, 0.18) 0%, transparent 70%)',
                        borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
                                {greeting}
                            </div>
                            <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: 0, lineHeight: 1.1 }}>
                                Bienvenido<br />
                                <span style={{ color: 'var(--primary)', textShadow: '0 0 20px var(--primary-glow)' }}>Deportista</span>
                            </h1>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>{dateStr}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', position: 'relative', zIndex: 1 }}>
                        <img src={adccLogo} alt="ADCC" style={{ width: '26px', opacity: 0.85 }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '3px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ADCC Biometric</span>
                    </div>
                </div>

                {/* ── CONTENT ── */}
                <div style={{ padding: '0 16px', marginTop: '-30px', position: 'relative', zIndex: 2 }}>

                    {/* Live alert */}
                    {liveCount > 0 && (
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => navigate('/partidos')}
                            style={{
                                background: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.05))',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '18px',
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                background: '#ef4444', flexShrink: 0,
                                boxShadow: '0 0 10px #ef4444',
                                animation: 'livePulse 1.5s ease-in-out infinite'
                            }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#f87171' }}>
                                    {liveCount} partido{liveCount > 1 ? 's' : ''} en vivo ahora
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toca para ver el marcador</div>
                            </div>
                            <ChevronRight size={18} color="#f87171" />
                        </m.div>
                    )}

                    {/* Quick Actions */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                            Accesos Rápidos
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {quickActions.map((action, i) => (
                                <m.button
                                    key={i}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
                                    onClick={() => navigate(action.path)}
                                    style={{
                                        background: 'var(--glass-bg)',
                                        border: `1px solid ${action.color}28`,
                                        borderRadius: '18px',
                                        padding: '16px 6px 14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        color: action.color,
                                        boxShadow: `0 4px 20px ${action.color}10`,
                                    }}
                                >
                                    {action.icon}
                                    <span style={{ fontSize: '0.58rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {action.label}
                                    </span>
                                </m.button>
                            ))}
                        </div>
                    </div>

                    {/* Matches feed */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                Partidos
                            </div>
                            <button
                                onClick={() => navigate('/partidos')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
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
                                    <Clock size={30} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>Sin partidos activos</div>
                                    <div style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '5px' }}>Los partidos aparecen aquí en tiempo real</div>
                                </div>
                            ) : (
                                activeMatches.map((match, i) => (
                                    <m.div
                                        key={match.id}
                                        initial={{ opacity: 0, x: -16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06 }}
                                        onClick={() => navigate(`/partido/${match.id}`)}
                                        style={{
                                            background: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '20px',
                                            padding: '16px 16px 16px 20px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            position: 'relative',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                                            background: match.status === 'live' ? '#ef4444' : '#008751',
                                            borderRadius: '4px 0 0 4px'
                                        }} />

                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.58rem', fontWeight: '800', letterSpacing: '1px',
                                                    padding: '2px 8px', borderRadius: '99px',
                                                    background: match.status === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(0, 135, 81, 0.1)',
                                                    color: match.status === 'live' ? '#ef4444' : '#00a859',
                                                    border: `1px solid ${match.status === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(0, 135, 81, 0.2)'}`,
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase'
                                                }}>
                                                    {match.status === 'live' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />}
                                                    {match.status === 'live' ? 'En Vivo' : 'Programado'}
                                                </span>
                                                {match.category && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{match.category}</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.88rem', flex: 1 }}>{match.teamA?.name || 'Equipo A'}</div>
                                                <div style={{
                                                    fontWeight: '900', fontSize: '1rem', letterSpacing: '3px', padding: '3px 10px',
                                                    background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                                                    color: match.status === 'live' ? '#ef4444' : 'var(--primary)',
                                                }}>
                                                    {match.score?.a ?? 0} - {match.score?.b ?? 0}
                                                </div>
                                                <div style={{ fontWeight: '700', fontSize: '0.88rem', flex: 1, textAlign: 'right' }}>{match.teamB?.name || 'Equipo B'}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                    </m.div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '48px', marginBottom: '40px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 0.2 }}>
                            <Star size={10} />
                            <span style={{ fontSize: '0.58rem', letterSpacing: '3px', fontWeight: '800', textTransform: 'uppercase' }}>ADCC Elite Platform</span>
                            <Star size={10} />
                        </div>
                    </div>

                    <Footer />
                </div>

                <style>{`
                    @keyframes livePulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.5); opacity: 0.5; }
                    }
                `}</style>
            </div>
        </LazyMotion>
    );
};

export default HomeUser;
