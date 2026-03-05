import React from 'react';
import { Instagram, Facebook, MessageCircle, MapPin, Mail, Globe } from 'lucide-react';
import logoAdcc from '../img/Logo ADCC.webp';

const Footer = () => {
    return (
        <footer style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 135, 81, 0.05) 100%)',
            padding: '60px 20px 40px',
            borderTop: '1px solid rgba(0, 51, 102, 0.1)',
            color: '#fff',
            fontFamily: "'Outfit', sans-serif"
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '40px',
                    marginBottom: '50px'
                }}>
                    {/* Brand & Social */}
                    <div>
                        <img src={logoAdcc} alt="ADCC Canning" style={{ width: '120px', marginBottom: '20px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))' }} />
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '25px', maxWidth: '300px' }}>
                            La plataforma oficial de gestión deportiva y biometría para ADCC Canning. Excelencia en competición.
                        </p>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <a href="https://www.instagram.com/adccanning" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.7, transition: '0.3s' }}>
                                <Instagram size={22} />
                            </a>
                            <a href="https://www.facebook.com/adccanning" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.7, transition: '0.3s' }}>
                                <Facebook size={22} />
                            </a>
                            <a href="https://wa.me/5491132011677" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', opacity: 0.9, transition: '0.3s' }}>
                                <MessageCircle size={22} />
                            </a>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 style={{ color: 'var(--primary)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>
                            Contacto
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <MapPin size={18} color="var(--primary)" style={{ marginTop: '2px' }} />
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>Giribone 909 Of. 409</p>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Canning - Buenos Aires</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <MessageCircle size={18} color="var(--primary)" />
                                <a href="https://wa.me/5491132011677" style={{ textDecoration: 'none', color: '#fff', fontSize: '0.9rem' }}>+54 9 11 3201-1677</a>
                            </div>
                        </div>
                    </div>

                    {/* Links/Platform */}
                    <div>
                        <h4 style={{ color: 'var(--primary)', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>
                            Plataforma
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <a href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Inicio</a>
                            <a href="/partidos" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Partidos</a>
                            <a href="/estadisticas" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Estadísticas</a>
                            <a href="/login" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Acceso Staff</a>
                        </div>
                    </div>
                </div>

                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '30px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '20px'
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', margin: 0 }}>
                        © 2025 ADCC CANNING. Todos los derechos reservados.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.2 }}>
                        <Globe size={12} />
                        <span style={{ fontSize: '0.6rem', letterSpacing: '2px', fontWeight: '800', textTransform: 'uppercase' }}>Elite Biometric Systems</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
