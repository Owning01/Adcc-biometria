import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed',
        platform: string
    }>;
    prompt(): Promise<void>;
}

const PwaInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevenir que Chrome M67 y anteriores muestren el mini-infobar automáticamente
            e.preventDefault();
            // Guardar el evento para poder lanzarlo luego.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Mostrar la UI de instalación
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Ocultar si ya se instaló
        const handleAppInstalled = () => {
            setShowPrompt(false);
            setDeferredPrompt(null);
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        // Chequeo por si ya se está corriendo en modo standalone (PWA)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowPrompt(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Ocultar nuestra UI
        setShowPrompt(false);

        // Mostrar el prompt de instalación nativo
        deferredPrompt.prompt();

        // Esperar la respuesta del usuario
        const { outcome } = await deferredPrompt.userChoice;

        // Limpiar el estado independientemente del resultado
        setDeferredPrompt(null);
    };

    if (!showPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // Justo por encima de la barra de navegación móvil si existe
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: '400px',
            background: 'var(--card-bg)',
            border: '1px solid var(--primary)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            <button
                onClick={() => setShowPrompt(false)}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                }}
            >
                <X size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    background: 'var(--primary-glow)',
                    padding: '10px',
                    borderRadius: '12px',
                    color: 'var(--primary)'
                }}>
                    <Download size={24} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Instalar Aplicación</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Para una experiencia más rápida y fluida.
                    </p>
                </div>
            </div>
            <button
                onClick={handleInstallClick}
                className="premium-button"
                style={{ width: '100%', padding: '10px' }}
            >
                Instalar Ahora
            </button>
        </div>
    );
};

export default PwaInstallPrompt;
