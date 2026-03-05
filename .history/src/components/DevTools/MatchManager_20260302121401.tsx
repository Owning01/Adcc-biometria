import React from 'react';
import { Terminal, Trophy, Trash2 } from 'lucide-react';

interface Match {
    id: string;
    teamA?: { name: string; logo?: string };
    teamB?: { name: string; logo?: string };
    date: string;
    time: string;
}

interface MatchManagerProps {
    matches: Match[];
    clearAllMatches: () => void;
    handleDeleteMatch: (id: string) => void;
}

const MatchManager: React.FC<MatchManagerProps> = ({ matches, clearAllMatches, handleDeleteMatch }) => {
    return (
        <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Gestión de Partidos</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Control total sobre la base de datos de partidos</p>
                </div>
                <button
                    onClick={clearAllMatches}
                    className="glass-button"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    role="button"
                >
                    <Trash2 size={16} /> Eliminar Todo
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {matches.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', opacity: 0.5 }}>
                        No hay partidos registrados.
                    </div>
                ) : (
                    matches.map(m => (
                        <div key={m.id} className="glass-panel" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{m.teamA?.name} vs {m.teamB?.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.date} - {m.time} HS</div>
                            </div>
                            <button
                                onClick={() => handleDeleteMatch(m.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                aria-label={`Eliminar partido ${m.teamA?.name} vs ${m.teamB?.name}`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MatchManager;
