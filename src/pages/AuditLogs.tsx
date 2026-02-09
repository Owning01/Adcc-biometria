/**
 * @file AuditLogs.tsx
 * @description PÁGINA DE AUDITORÍA
 * Visualiza el registro inmutable de acciones críticas del sistema (Logins, Ediciones, Borrados).
 * Permite filtrar por usuario, fecha o tipo de evento.
 */
import React, { useState, useEffect } from 'react';
import { getAuditLogs, AuditLog } from '../services/auditService';
import { Shield, Clock, User, Trash2, Edit, LogIn, ChevronRight, Search } from 'lucide-react';

// ============================================================================
// 1. COMPONENTE PRINCIPAL & ESTADO
// ============================================================================
const AuditLogs = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            const data = await getAuditLogs(200);
            setLogs(data);
            setLoading(false);
        };
        fetchLogs();
    }, []);

    // ============================================================================
    // 2. HELPERS VISUALES (ICONOS & LABELS)
    // ============================================================================
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'access': return <LogIn size={16} className="text-blue-400" />;
            case 'modification': return <Edit size={16} className="text-amber-400" />;
            case 'deletion': return <Trash2 size={16} className="text-red-400" />;
            default: return <ChevronRight size={16} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'access': return 'Ingreso';
            case 'modification': return 'Modificación';
            case 'deletion': return 'Eliminación';
            default: return type;
        }
    };

    const filteredLogs = logs.filter(log =>
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in p-6">
            <header className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Shield className="text-primary" />
                    Historial de <span className="text-primary">Auditoría</span>
                </h1>
                <p className="text-slate-400 text-sm mt-1">Registro interno de operaciones sensibles</p>

                <div className="mt-6 flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, acción o entidad..."
                            className="premium-input pl-10 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="text-center py-20 text-slate-500">Cargando registros...</div>
            ) : (
                <div className="glass-panel overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10 uppercase text-[10px] font-bold tracking-wider text-slate-400">
                                    <th className="p-4">Fecha / Hora</th>
                                    <th className="p-4">Operación</th>
                                    <th className="p-4">Usuario</th>
                                    <th className="p-4">Entidad</th>
                                    <th className="p-4">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-slate-500">No se encontraron registros.</td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-primary">
                                                        {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : 'N/A'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">
                                                        {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(log.type)}
                                                    <span className="text-[10px] font-bold uppercase tracking-tight">
                                                        {getTypeLabel(log.type)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/30 uppercase">
                                                        {log.user.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-200">{log.user.name}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase">{log.user.role}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-400 font-mono">
                                                    {log.entity || '-'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-xs text-slate-300 max-w-md truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none transition-all">
                                                    {log.description}
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
