import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToMatches } from '../services/matchesService';
import { Swords, LayoutDashboard, Bell, Shield, PieChart, Users, Trophy, Calendar, Clock, Activity, MessageCircle } from 'lucide-react';
import adccLogo from '../Applogo.png';

const HomeUser = () => {
    const navigate = useNavigate();
    const [activeMatches, setActiveMatches] = useState<any[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToMatches((matches) => {
            const active = matches.filter(m => m.status === 'en curso' || m.status === 'scheduled');
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
                        <h1 className="brand-title">ADCC <span className="text-highlight amber-glow">Biometric</span></h1>
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
                                            {match.scoreA} - {match.scoreB}
                                        </div>
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{match.teamB.name}</div>
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

                    <div className="glass-panel" style={{ marginTop: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <MessageCircle size={24} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>AYUDA Y SOPORTE</div>
                            <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>Contacta con la administración</p>
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
