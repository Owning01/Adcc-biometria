import React from 'react';
import { Instagram, Facebook, MessageCircle, MapPin, Mail, Globe } from 'lucide-react';
import logoAdcc from '../img/Logo ADCC.webp';

const Footer = () => {
    // Icono de WhatsApp personalizado (SVG oficial)
    const WhatsAppIcon = ({ size = 22, color = "#25D366" }) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color }}
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.122.54 4.192 1.571 6.002L0 24l6.102-1.601a11.785 11.785 0 005.944 1.635h.006c6.635 0 12.03-5.393 12.034-12.03A11.83 11.83 0 0020.465 3.488z" />
        </svg>
    );

    return (
        <footer style={{
            background: 'rgba(2, 6, 23, 0.95)',
            backdropFilter: 'blur(20px)',
            padding: '60px 20px 40px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
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
                    <div style={{ flex: '1.2' }}>
                        <img src={logoAdcc} alt="ADCC Canning" style={{ width: '130px', marginBottom: '20px', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.15))' }} />
                        
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <a href="https://www.instagram.com/adccanning" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.8, transition: '0.3s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}>
                                <Instagram size={24} />
                            </a>
                            <a href="https://www.facebook.com/adccanning" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.8, transition: '0.3s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}>
                                <Facebook size={24} />
                            </a>
                            <a href="https://wa.me/5491132011677" target="_blank" rel="noopener noreferrer" style={{ transition: '0.3s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                <WhatsAppIcon size={26} />
                            </a>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div style={{ flex: '1' }}>
                        <h4 style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '25px' }}>
                            Contacto Directo
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                                <MapPin size={22} color="var(--primary)" style={{ marginTop: '2px' }} />
                                <div>
                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#fff' }}>Giribone 909 Of. 409</p>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Canning - Buenos Aires</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <WhatsAppIcon size={20} />
                                <a href="https://wa.me/5491132011677" style={{ textDecoration: 'none', color: '#fff', fontSize: '1rem', fontWeight: '600', transition: '0.3s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}>
                                    +54 9 11 3201-1677
                                </a>
                            </div>
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
                </div>
            </div>
        </footer>
    );
};

export default Footer;
