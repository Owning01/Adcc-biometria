// ============================================
// 1. IMPORTS & DEPENDENCIES
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { Loader2, Camera, User, CreditCard, Users, Layers } from 'lucide-react';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { getFaceDataLocal } from '../services/faceServiceLocal';
import { saveUser } from '../services/db';

// ============================================
// 2. INTERFACES & BACKEND TYPES
// ============================================
interface QuickRegisterModalProps {
    data: {
        name: string;
        dni: string;
        team: string;
        category: string;
    };
    onClose: () => void;
}

// ============================================
// 3. COMPONENT DEFINITION & STATE
// ============================================
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
            canvas.width = 400; canvas.height = 400;
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
                categories: [formData.category],
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-500" />
                    Registro Rápido de Jugador
                </h2>

                {step === 1 ? (
                    <div className="space-y-5">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                            <p className="text-sm text-blue-400">
                                Por favor, completa los datos básicos para continuar con la captura facial.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                <User className="w-4 h-4" /> Nombre Completo *
                            </label>
                            <input
                                type="text"
                                className="w-full bg-[#151515] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="Ej: Juan Pérez"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> DNI / Identificación *
                            </label>
                            <input
                                type="text"
                                className="w-full bg-[#151515] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="Sin puntos"
                                value={formData.dni}
                                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Equipo
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#151515] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    value={formData.team}
                                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                    <Layers className="w-4 h-4" /> Categoría
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#151515] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.name || !formData.dni}
                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="relative w-full aspect-square max-w-[320px] bg-black rounded-3xl overflow-hidden border-2 border-white/10 shadow-inner">
                            <Webcam
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover grayscale brightness-110"
                                videoConstraints={{ facingMode: 'user', width: 600, height: 600 }}
                            />

                            {faceBox && (
                                <div
                                    className={`absolute border-2 rounded-2xl transition-all duration-200 ${qualityCode === 'OK' ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'}`}
                                    style={{
                                        left: `${faceBox.x}%`,
                                        top: `${faceBox.y}%`,
                                        width: `${faceBox.w}%`,
                                        height: `${faceBox.h}%`
                                    }}
                                />
                            )}

                            <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40" />
                        </div>

                        <div className="mt-6 w-full text-center">
                            <p className={`text-lg font-bold mb-1 ${qualityCode === 'OK' ? 'text-green-500' : 'text-red-400'}`}>
                                {qualityError || 'Inicializando cámara...'}
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                Asegúrate de estar en un lugar iluminado
                            </p>

                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleCapture}
                                    disabled={loading || qualityCode !== 'OK'}
                                    className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Registrando...
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="w-5 h-5" />
                                            Capturar y Guardar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickRegisterModal;
