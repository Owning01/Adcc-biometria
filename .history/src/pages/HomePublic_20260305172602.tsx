import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ArrowRight, Swords, Shield, ChevronDown } from 'lucide-react';
import { m, LazyMotion, domAnimation, useScroll, useTransform } from 'framer-motion';
import AppLogo from '../Applogo.png';
import Footer from '../components/Footer';
import ArcoBg from '../img/arco abstracto futurista.png';
import EstadioBg from '../img/estadio.png';
import PelotaImg from '../img/Pelota.png';

const HomePublic = () => {
    const navigate = useNavigate();

    return (
        <LazyMotion features={domAnimation}>
            <div className="home-public-immersive" style={{
                height: '100vh',
                width: '100%',
                overflowY: 'scroll',
                scrollSnapType: 'y mandatory',
                backgroundColor: '#020617',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif",
                position: 'relative',
                overflowX: 'hidden'
            }}>

                {/* Fixed Background for Continuity */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                    <div style={{
                        position: 'absolute',
                        top: '20%',
                        left: '10%',
                        width: '40vw',
                        height: '40vw',
                        background: 'radial-gradient(circle, rgba(0, 135, 81, 0.1) 0%, transparent 70%)',
                        filter: 'blur(100px)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '20%',
                        right: '10%',
                        width: '50vw',
                        height: '50vw',
                        background: 'radial-gradient(circle, rgba(0, 81, 162, 0.08) 0%, transparent 70%)',
                        filter: 'blur(120px)'
                    }} />

                    {/* Floating Pelota */}
                    <m.img
                        src={PelotaImg}
                        style={{
                            position: 'absolute',
                            top: '15%',
                            right: '5%',
                            width: '180px',
                            opacity: 0.3,
                            filter: 'blur(2px)'
                        }}
                        animate={{
                            y: [0, 40, 0],
                            rotate: [0, 10, 0],
                            scale: [1, 1.05, 1]
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                </div>

                {/* Section 1: Hero / Landing */}
                <section style={{
                    height: '100vh',
                    width: '100%',
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <m.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                        style={{ textAlign: 'center' }}
                    >
                        <m.img
                            src={AppLogo}
                            alt="Logo"
                            style={{ width: '140px', marginBottom: '30px', filter: 'drop-shadow(0 0 20px rgba(0, 135, 81, 0.4))' }}
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <h1 style={{
                            fontSize: 'clamp(2.5rem, 12vw, 5rem)',
                            fontWeight: '900',
                            letterSpacing: '-2px',
                            margin: 0,
                            lineHeight: 1,
                            background: 'linear-gradient(to bottom, #fff, #94a3b8)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            ADCC
                        </h1>
                        <h2 style={{
                            fontSize: 'clamp(1rem, 5vw, 2rem)',
                            fontWeight: '300',
                            letterSpacing: '8px',
                            color: 'var(--primary)',
                            textTransform: 'uppercase',
                            marginTop: '10px'
                        }}>
                            Biometric
                        </h2>
                    </m.div>

                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ position: 'absolute', bottom: '40px', textAlign: 'center' }}
                    >
                        <p style={{ fontSize: '0.8rem', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>DESLIZA</p>
                        <ChevronDown size={24} color="rgba(255,255,255,0.4)" />
                    </m.div>
                </section>

                {/* Section 2: Partidos Immersive */}
                <section style={{
                    height: '100vh',
                    width: '100%',
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `linear-gradient(to right, rgba(2,6,23,0.95), transparent), url(${EstadioBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        zIndex: -1,
                        opacity: 0.6
                    }} />

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px' }}>
                        <m.div
                            initial={{ x: -50, opacity: 0 }}
                            whileInView={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '800', letterSpacing: '3px', marginBottom: '10px' }}>EN VIVO</h3>
                            <h2 style={{ fontSize: '4rem', fontWeight: '900', lineHeight: 0.9, marginBottom: '20px' }}>PARTIDOS</h2>
                            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px', marginBottom: '40px' }}>
                                Resultados, fixture y estadísticas en tiempo real.
                            </p>

                            <m.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/partidos')}
                                style={{
                                    background: 'transparent',
                                    border: '2px solid var(--primary)',
                                    color: '#fff',
                                    padding: '16px 32px',
                                    borderRadius: '100px',
                                    fontSize: '1rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(5px)'
                                }}
                            >
                                VER FIXTURE <Swords size={20} />
                            </m.button>
                        </m.div>
                    </div>
                </section>

                {/* Section 3: Torneos Immersive */}
                <section style={{
                    height: '100vh',
                    width: '100%',
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `linear-gradient(to left, rgba(2,6,23,0.95), transparent), url(${ArcoBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        zIndex: -1,
                        opacity: 0.4
                    }} />

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px', alignItems: 'flex-end', textAlign: 'right' }}>
                        <m.div
                            initial={{ x: 50, opacity: 0 }}
                            whileInView={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h3 style={{ fontSize: '0.9rem', color: '#008751', fontWeight: '800', letterSpacing: '3px', marginBottom: '10px' }}>ELITE</h3>
                            <h2 style={{ fontSize: '4rem', fontWeight: '900', lineHeight: 0.9, marginBottom: '20px' }}>TORNEOS</h2>
                            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px', marginBottom: '40px', marginLeft: 'auto' }}>
                                Clubes, categorías y la gloria de la liga.
                            </p>

                            <m.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/equipos')}
                                style={{
                                    background: 'transparent',
                                    border: '2px solid #008751',
                                    color: '#fff',
                                    padding: '16px 32px',
                                    borderRadius: '100px',
                                    fontSize: '1rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    marginLeft: 'auto'
                                }}
                            >
                                VER EQUIPOS <Shield size={20} />
                            </m.button>
                        </m.div>
                    </div>
                </section>

                {/* Section 4: Login / CTA */}
                <section style={{
                    height: '100vh',
                    width: '100%',
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <m.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        style={{ textAlign: 'center' }}
                    >
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '30px' }}>¿ERES ÁRBITRO O DELEGADO?</h2>
                        <m.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/login')}
                            style={{
                                background: '#fff',
                                color: '#000',
                                padding: '20px 60px',
                                borderRadius: '100px',
                                fontSize: '1.2rem',
                                fontWeight: '900',
                                border: 'none',
                                boxShadow: '0 20px 50px rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                margin: '0 auto'
                            }}
                        >
                            INGRESAR <LogIn size={24} />
                        </m.button>
                    </m.div>
                </section>

                {/* Section 5: Footer Info */}
                <section style={{
                    minHeight: '100vh',
                    width: '100%',
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    background: 'rgba(0,0,0,0.5)'
                }}>
                    <Footer />
                </section>

                <style>{`
    .home - public - immersive:: -webkit - scrollbar {
    display: none;
}
                    .home - public - immersive {
    -ms - overflow - style: none;
    scrollbar - width: none;
}
`}</style>
            </div>
        </LazyMotion>
    );
};

export default HomePublic