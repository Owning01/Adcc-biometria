import React from 'react';
import { Mic, Trophy, Activity, Square, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RefereeGuide = () => {
    const navigate = useNavigate();

    const commands = [
        { cmd: 'Árbitro: Gol local / visitante', desc: 'Suma un gol al equipo correspondiente y actualiza el marcador.' },
        { cmd: 'Árbitro: Gol [dorsal] local / visitante', desc: 'Suma un gol al jugador con ese dorsal y al equipo.' },
        { cmd: 'Árbitro: Amarilla [dorsal] local / visitante', desc: 'Asigna una tarjeta amarilla al jugador.' },
        { cmd: 'Árbitro: Roja [dorsal] local / visitante', desc: 'Expulsa al jugador del partido.' },
        { cmd: 'Árbitro: Entra [dorsal] sale [dorsal]', desc: 'Registra un cambio de jugadores automáticamente.' },
        { cmd: 'Árbitro: Iniciar partido / Finalizar partido', desc: 'Cambia el estado del cronómetro y del encuentro.' },
        { cmd: 'Árbitro: Resultado / Tiempo', desc: 'El sistema te dictará el estado actual del partido.' },
    ];

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => navigate(-1)} className="glass-button" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Guía de <span style={{ color: 'var(--primary)' }}>Voz Árbitro</span></h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Comandos integrados para control manos libres</p>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '30px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <Mic size={24} color="var(--primary)" className="animate-pulse" />
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
                        Para activar los comandos, pulsa el botón <strong>"Usar Voz"</strong> dentro de un partido y di la palabra clave <strong>"Árbitro..."</strong> seguida del comando.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {commands.map((c, i) => (
                        <div key={i} style={{ padding: '15px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem', marginBottom: '5px' }}>{c.cmd}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '25px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '50px', height: '50px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <Activity size={24} />
                </div>
                <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>Sugerencia Pro</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Puedes decir "Árbitro, tiempo" en cualquier momento para saber cuánto falta sin mirar el cronómetro.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RefereeGuide;
