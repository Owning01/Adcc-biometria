import React from 'react';
import { Sparkles, Mic, Trophy, Users, Moon, Zap, Search } from 'lucide-react';

const Novedades = () => {
    return (
        <div className="animate-fade-in" style={{ padding: '0 10px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Sparkles color="var(--primary)" size={32} />
                    Novedades
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Últimas actualizaciones y mejoras de la versión actual</p>
            </div>

            {/* Nueva Sección: Control por Voz */}
            <div className="glass-panel" style={{ padding: '25px', marginBottom: '25px', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', color: '#3b82f6' }}>
                        <Mic size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Nuevo: Arbitraje por Voz</h2>
                        <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold' }}>¡BETA!</span>
                    </div>
                </div>

                <p style={{ lineHeight: '1.6', opacity: 0.9 }}>

                    Activa el micrófono en la pantalla de partido, que permite usar los siguientes comandos:
                </p>

                <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                    <CommandCard
                        title="Goles"
                        command={['"Gol local"', '"Gol visitante"']}
                        desc="Suma un gol al marcador automáticamente."
                    />
                    <CommandCard
                        title="Tarjetas"
                        command={['"Tarjeta amarilla [número]"', '"Tarjeta roja [número]"']}
                        desc="Ej: 'Tarjeta amarilla 10'. Registra la amonestación."
                    />
                    <CommandCard
                        title="Sustituciones"
                        command={['"Cambio entra [X] sale [Y]"']}
                        desc="Ej: 'Cambio entra 14 sale 9'. Registra el cambio."
                    />
                    <CommandCard
                        title="Estado del Partido"
                        command={['"Iniciar partido"', '"Entretiempo"', '"Finalizar partido"']}
                        desc="Controla el cronómetro y el estado general."
                    />
                    <CommandCard
                        title="Consultas"
                        command={['"Tiempo"', '"Resultado"']}
                        desc="El asistente te responderá de viva voz cómo va el partido."
                    />
                </div>
            </div>

            {/* Otras Mejoras */}
            <h3 style={{ marginLeft: '10px', marginBottom: '15px', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Otras Mejoras Recientes
            </h3>

            <div style={{ display: 'grid', gap: '15px' }}>
                <UpdateItem
                    icon={<Moon color="#60a5fa" />}
                    title="Modo Oscuro / Claro"
                    desc="Nuevo botón flotante en la esquina superior derecha para alternar entre temas visuales según tu preferencia."
                />
                <UpdateItem
                    icon={<Users color="#10b981" />}
                    title="Asignación Inteligente de Dorsales"
                    desc="Al crear partidos, los jugadores ahora se cargan con su número de camiseta real registrado en la base de datos."
                />
                <UpdateItem
                    icon={<Trophy color="#fbbf24" />}
                    title="Marcador en Tiempo Real"
                    desc="Corrección en la sincronización de goles. Ahora el marcador refleja siempre el estado exacto, incluso al usar comandos de voz repetidos."
                />
                <UpdateItem
                    icon={<Search color="#a855f7" />}
                    title="Búsqueda Optimizada"
                    desc="Mejoras en el filtro de jugadores y equipos para encontrar registros más rápido."
                />
            </div>

            <div style={{ marginTop: '40px', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                <p>ADCC Biometric - v{__APP_VERSION__ || '2.5.0'}</p>
            </div>
        </div>
    );
};

const CommandCard = ({ title, command, desc }) => (
    <div className="glass-panel" style={{ padding: '15px', background: 'rgba(0,0,0,0.2)' }}>
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{title}</h4>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '8px' }}>
            {command.map((c, i) => <div key={i}>{c}</div>)}
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{desc}</div>
    </div>
);

const UpdateItem = ({ icon, title, desc }) => (
    <div className="glass-panel" style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
            {icon}
        </div>
        <div>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{title}</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
    </div>
);

export default Novedades;
