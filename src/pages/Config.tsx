import React, { useState, useEffect } from 'react';
import { Settings, Globe, ShieldCheck, Database, RefreshCw, Trash2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Config = () => {
    const [isCloudEnabled, setIsCloudEnabled] = useState(false);
    const [showAndroidDownload, setShowAndroidDownload] = useState(true);

    useEffect(() => {
        const savedCloud = localStorage.getItem('cloud_enabled') === 'true';
        setIsCloudEnabled(savedCloud);

        const savedDownload = localStorage.getItem('show_android_download') !== 'false';
        setShowAndroidDownload(savedDownload);
    }, []);

    const toggleCloud = () => {
        const newState = !isCloudEnabled;
        setIsCloudEnabled(newState);
        localStorage.setItem('cloud_enabled', JSON.stringify(newState));
        window.location.reload();
    };

    const toggleDownload = () => {
        const newState = !showAndroidDownload;
        setShowAndroidDownload(newState);
        localStorage.setItem('show_android_download', JSON.stringify(newState));
    };



    return (
        <div className="container animate-fade-in">
            <header style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.2rem', margin: 0, fontWeight: '800' }}>
                    Configuración <span style={{ color: 'var(--primary)' }}>del Sistema</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gestión de módulos y rendimiento</p>
            </header>

            <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '14px', color: 'var(--primary)' }}>
                                <Globe size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Módulo Consulta Nube</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Procesamiento avanzado (IA en la nube)</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleCloud}
                            className="glass-button"
                            style={{
                                padding: '10px 20px',
                                background: isCloudEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                color: isCloudEnabled ? '#3b82f6' : 'white',
                                border: `1px solid ${isCloudEnabled ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                fontSize: '0.75rem'
                            }}
                        >
                            {isCloudEnabled ? 'HABILITADO' : 'DESHABILITADO'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '14px', color: '#10b981' }}>
                                <Zap size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Botón Descarga Android</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mostrar/Ocultar link del APK en Inicio</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleDownload}
                            className="glass-button"
                            style={{
                                padding: '10px 20px',
                                background: showAndroidDownload ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                color: showAndroidDownload ? '#10b981' : '#10b981',
                                border: `1px solid ${showAndroidDownload ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                fontSize: '0.75rem'
                            }}
                        >
                            {showAndroidDownload ? 'VISIBLE' : 'OCULTO'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', opacity: 0.5 }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '14px' }}>
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sincronización de Base</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-sync activo con Firestore</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', opacity: 0.5 }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '14px' }}>
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Seguridad Biométrica</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Validación de unicidad activa</p>
                        </div>
                    </div>



                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                SISTEMA v1.0.0-PRO • LICENCIA ACTIVA
            </div>
        </div>
    );
};

export default Config;
