import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface Result {
    name: string;
    status: 'success' | 'error' | 'pending';
    message: string;
}

interface ImportResultLogProps {
    results: Result[];
}

const ImportResultLog: React.FC<ImportResultLogProps> = ({ results }) => {
    return (
        <div className="glass-panel" style={{ padding: '25px', maxHeight: '580px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>HISTORIAL DE PROCESAMIENTO</h4>
                <span className="status-badge" style={{ fontSize: '0.65rem' }}>{results.length} ÍTEMS</span>
            </div>

            {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.15 }}>
                    <RefreshCw size={50} style={{ margin: '0 auto 15px' }} />
                    <p style={{ fontSize: '0.9rem' }}>Esperando datos para analizar...</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[...results].reverse().map((r, i) => (
                        <div key={`${r.name}-${r.status}-${i}`} style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${r.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : r.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}` }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                <div style={{ fontSize: '0.7rem', color: r.status === 'error' ? '#ef4444' : '#10b981', opacity: 0.9 }}>{r.message}</div>
                            </div>
                            {r.status === 'success' ? <CheckCircle2 size={18} color="#10b981" /> : r.status === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <RefreshCw size={18} className="animate-spin" opacity={0.3} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImportResultLog;
