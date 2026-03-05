import React, { useState } from 'react';
import { Search, UserPlus, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { searchADCCPlayer, ADCCPlayer } from '../services/adccService';
import { playerRegistrationService, RegistrationResult } from '../services/playerRegistrationService';

interface PlayerSearchRegistryProps {
    onClose: () => void;
    onSuccess?: (player: any) => void;
}

export default function PlayerSearchRegistry({ onClose, onSuccess }: PlayerSearchRegistryProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ADCCPlayer[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setMsg(null);
        try {
            const players = await searchADCCPlayer(query);
            setResults(players);
            if (players.length === 0) setMsg({ type: 'error', text: 'No se encontraron jugadores en la base de ADCC' });
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Error al buscar en la API externa' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (player: ADCCPlayer) => {
        setProcessingId(player.jleid);
        setMsg(null);
        try {
            const result: RegistrationResult = await playerRegistrationService.registerPlayer({
                jleid: player.jleid,
                dni: player.dni,
                nombre: player.nombre,
                apellido: player.apellido,
                foto: player.imagen_url || player.imagen
            });

            if (result.success) {
                setMsg({ type: 'success', text: `¡${player.nombre} registrado con éxito!` });
                if (onSuccess) onSuccess(player);
                // Optionally remove from results or mark as registered
                setResults(prev => prev.filter(r => r.jleid !== player.jleid));
            } else {
                setMsg({ type: 'error', text: `Error: ${result.error}` });
            }
        } catch (err: any) {
            setMsg({ type: 'error', text: `Error crítico: ${err.message}` });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <div style={{
                background: 'var(--card-bg)',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                padding: '30px',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '20px', color: 'var(--primary)' }}>
                    Búsqueda Global ADCC
                </h2>
                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '20px' }}>
                    Busca jugadores que no estén en el sistema local y regístralos al instante.
                </p>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} size={18} />
                        <input
                            type="text"
                            placeholder="Nombre, Apellido o DNI..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--input-bg)',
                                color: 'var(--text-color)',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            background: 'var(--accent-gradient)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {loading ? <RefreshCw className="spin" size={20} /> : 'Buscar'}
                    </button>
                </form>

                {msg && (
                    <div style={{
                        padding: '12px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        background: msg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: msg.type === 'success' ? '#22c55e' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.9rem'
                    }}>
                        {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {msg.text}
                    </div>
                )}

                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.map(player => (
                        <div key={player.jleid} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <img
                                src={player.imagen_url || player.imagen}
                                alt={player.nombre}
                                style={{ width: '50px', height: '50px', borderRadius: '80px', objectFit: 'cover', background: '#000' }}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{player.nombre} {player.apellido}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>DNI: {player.dni}</div>
                            </div>
                            <button
                                onClick={() => handleRegister(player)}
                                disabled={processingId !== null}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#60a5fa',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                {processingId === player.jleid ? (
                                    <RefreshCw size={14} className="spin" />
                                ) : (
                                    <>
                                        <UserPlus size={14} />
                                        Validar
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                    {loading && results.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>Buscando en ADCC...</div>
                    )}
                    {!loading && results.length === 0 && !msg && (
                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, fontSize: '0.85rem' }}>
                            Ingresa un criterio de búsqueda arriba para encontrar jugadores.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
