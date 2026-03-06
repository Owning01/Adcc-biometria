import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { getFaceDataLocal } from '../services/faceServiceLocal';
import { saveUser } from '../services/db';

interface QuickRegisterModalProps {
    data: {
        name: string;
        dni: string;
        team: string;
        category: string;
    };
    onClose: () => void;
}

const QuickRegisterModal: React.FC<QuickRegisterModalProps> = ({ data, onClose }) => {
    const webcamRef = useRef<any>(null);
    const [formData, setFormData] = useState(data);
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelsReady, setModelsReady] = useState(false);
    const [qualityError, setQualityError] = useState('');
    const [qualityCode, setQualityCode] = useState('');
    const [faceBox, setFaceBox] = useState<any>(null);

    const initModels = async () => {
        setStatus('Iniciando IA...');
        const res = await initHybridEngine();
        if (res.success) {
            setModelsReady(true);
            setStatus('Sistema listo');
        } else {
            setStatus('Error: ' + res.error);
        }
    };

    const handleCapture = async () => {
        if (!webcamRef.current) return;
        setLoading(true);
        setStatus('Procesando...');
        try {
            const imageSrc = webcamRef.current.getScreenshot();
            const img = new Image();
            img.src = imageSrc;
            await new Promise((res) => img.onload = res);
            const canvas = document.createElement('canvas');
            canvas.width = 400; canvas.height = 400; // Calidad mejorada
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const size = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
            const photoUrl = canvas.toDataURL('image/jpeg', 0.8);

            const faceData = await getFaceDataLocal(webcamRef.current.video);
            if (!faceData) throw new Error("No se detecta rostro");

            await saveUser({
                ...formData,
                descriptor: Array.from(faceData.descriptor),
                photo: photoUrl,
                status: 'habilitado',
                categories: [formData.category], // Guardamos como array
                createdAt: new Date().toISOString()
            });
            setStatus('¡Éxito!');
            setTimeout(onClose, 1000);
        } catch (error: any) {
            alert(error.message);
            setStatus('Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval: any;
        if (step === 2) {
            if (!modelsReady) initModels();
            interval = setInterval(async () => {
                if (!webcamRef.current?.video || !modelsReady) return;
                const video = webcamRef.current.video;
                try {
                    const mp = await detectFaceMediaPipe(video);
                    if (!mp) {
                        setQualityError('Buscando rostro...');
                        setFaceBox(null);
                    } else {
                        const quality = checkFaceQuality(mp, video);
                        setQualityError(quality.ok ? '¡Listo!' : quality.reason);
                        setQualityCode(quality.ok ? 'OK' : 'ERR');
                        const { originX, originY, width, height } = mp.boundingBox;
                        setFaceBox({ x: (originX / video.videoWidth) * 100, y: (originY / video.videoHeight) * 100, w: (width / video.videoWidth) * 100, h: (height / video.videoHeight) * 100 });
                    }
                } catch (e) { }
            }, 200);
        }
        return () => clearInterval(interval);
    }, [step, modelsReady]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ padding: '30px', maxWidth: '450px', width: '100%', position: 'relative' }}>
                <h2 className="text-xl font-bold mb-4">Registro Rápido</h2>
                {step === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ej: Juan Pérez"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">DNI *</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Sin puntos"
                                    value={formData.dni}
                                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Equipo (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                        value={formData.team}
                                        onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Categoría (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading || !formData.name || !formData.dni}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Siguiente' // Changed from 'Guardar' to 'Siguiente' to match original flow
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '15px' }}>
                            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width="100%" height="300px" style={{ objectFit: 'cover' }} />
                            {faceBox && (
                                <div style={{
                                    position: 'absolute',
                                    border: `2px solid ${qualityCode === 'OK' ? '#4ade80' : '#fbbf24'}`,
                                    left: `${faceBox.x}%`,
                                    top: `${faceBox.y}%`,
                                    width: `${faceBox.w}%`,
                                    height: `${faceBox.h}%`,
                                    borderRadius: '5px',
                                    pointerEvents: 'none'
                                }} />
                            )}
                        </div>
                        <p style={{ margin: '15px 0', fontWeight: 'bold', color: qualityCode === 'OK' ? '#4ade80' : '#fbbf24' }}>{qualityError}</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="glass-button button-secondary" onClick={() => setStep(1)} disabled={loading}>Atrás</button>
                            <button className="glass-button" style={{ background: qualityCode === 'OK' ? 'var(--success)' : 'rgba(255,255,255,0.05)', flex: 1 }} onClick={handleCapture} disabled={loading || qualityCode !== 'OK'}>
                                {loading ? 'Registrando...' : 'Capturar y Finalizar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickRegisterModal;
```
