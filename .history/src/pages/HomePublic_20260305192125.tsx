import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ArrowRight, Swords, Shield, ChevronDown } from 'lucide-react';
import { m, LazyMotion, domAnimation, useScroll, useTransform } from 'framer-motion';
import AppLogo from '../Applogo.webp';
import Footer from '../components/Footer';
import ArcoBg from '../img/arco abstracto futurista.webp';
import EstadioBg from '../img/estadio.webp';
import PelotaImg from '../img/Pelota.webp';
import FrostedGlass from '../img/2 Frosted_glass_panels.webp';

const HomePublic = () => {
    const navigate = useNavigate();

    return (
        <LazyMotion features={domAnimation}>
            <div className="home-public-immersive full-bleed" style={{
                height: '100vh',
                width: '100%',
                marginTop: '-40px',
                marginBottom: '-120px',
                backgroundColor: '#020617',
                backgroundImage: `url(${EstadioBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif",
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '80px' // Espacio para navbar
            }}>

                {/* Overlay Oscuro para legibilidad */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(2, 6, 23, 0.70)', /* Capa oscura */
                    zIndex: 0
                }} />


                {/* Contenedor Principal a Dos Columnas */}
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    maxWidth: '1400px',
                    display: 'flex',
                    flex: 1,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '40px',
                    padding: '20px'
                }}>

                    {/* Logo Flotante Central (Móvil y Escritorio) */}
                    <m.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1 }}
                        style={{
                            width: '100%',
                            textAlign: 'center',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                    >
                        <m.img
                            src={AppLogo}
                            alt="Logo"
                            style={{ width: '100px', filter: 'drop-shadow(0 0 15px rgba(0, 135, 81, 0.8))' }}
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <h1 style={{
                            fontSize: 'clamp(1.5rem, 5vw, 3rem)',
                            fontWeight: '900',
                            letterSpacing: '-1px',
                            margin: '10px 0 0 0',
                            lineHeight: 1,
                            background: 'linear-gradient(to right, #ffffff, #a7f3d0)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            ADCC BIOMETRIC
                        </h1>
                    </m.div>

                    {/* COLUMNA IZQUIERDA: Partidos */}
                    <m.div
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{
                            flex: '1 1 350px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: '40px',
                            background: 'rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '30px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: '800', letterSpacing: '4px', marginBottom: '5px' }}>EN VIVO</h3>
                        <h2 style={{ fontSize: '3rem', fontWeight: '900', lineHeight: 1, margin: '0 0 20px 0' }}>PARTIDOS</h2>
                        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px', marginBottom: '30px' }}>
                            Resultados, fixture y estadísticas en tiempo real.
                        </p>
                        <m.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/partidos')}
                            style={{
                                background: 'linear-gradient(135deg, rgba(0,255,150,0.2) 0%, rgba(0,100,50,0.2) 100%)',
                                border: '1px solid var(--primary)',
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

                    {/* COLUMNA DERECHA: Roles / Ingreso */}
                    <m.div
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        style={{
                            flex: '1 1 350px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: '40px',
                            background: 'rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '30px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent, #6366f1)', fontWeight: '800', letterSpacing: '4px', marginBottom: '5px' }}>ACCESO</h3>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: 1, margin: '0 0 20px 0' }}>¿ÁRBITRO O DELEGADO?</h2>
                        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px', marginBottom: '30px' }}>
                            Ingresa con tus credenciales para gestionar a tu equipo.
                        </p>
                        <m.button
                            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(255,255,255,0.5)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/login')}
                            style={{
                                background: '#fff',
                                color: '#000',
                                padding: '16px 40px',
                                borderRadius: '100px',
                                fontSize: '1.2rem',
                                fontWeight: '900',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}
                        >
                            INGRESAR <LogIn size={24} />
                        </m.button>
                    </m.div>

                </div>

                {/* Footer Abajo */}
                <div style={{ width: '100%', zIndex: 10, marginTop: 'auto', flexShrink: 0 }}>
                    <div style={{ transform: 'scale(0.8)', opacity: 0.8, transformOrigin: 'bottom center' }}>
                        <Footer />
                    </div>
                </div>

            </div>
        </LazyMotion>
    );
};

export default HomePublic;
