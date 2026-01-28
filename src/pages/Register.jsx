import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { createMatcher } from '../services/faceService';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { saveUser, checkDniExists, getUsers, subscribeToUsers } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { Camera, RefreshCw, User, Clipboard, Users, Trophy, Milestone, CheckCircle2, Zap, Globe, ArrowLeft, Plus, SwitchCamera, Lightbulb } from 'lucide-react';
import adccLogo from '../Applogo.png';

const Register = () => {
    const webcamRef = useRef(null);
    const [users, setUsers] = useState([]);
    const [formData, setFormData] = useState({ name: '', dni: '', team: '', category: '' });
    const [step, setStep] = useState(1); // 1: Form, 2: Camera

    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [modelsReady, setModelsReady] = useState(false);
    const [facingMode, setFacingMode] = useState('user');
    const [cameraKey, setCameraKey] = useState(0); // Para forzar re-render de la cámara
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [qualityError, setQualityError] = useState('');
    const [qualityCode, setQualityCode] = useState('');
    const [faceBox, setFaceBox] = useState(null);
    const navigate = useNavigate();

    const toggleCamera = () => {
        setIsTorchOn(false); // Reset torch when switching
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        setCameraKey(prev => prev + 1); // Forzar que React destruya y recree el componente Webcam
    };

    const toggleTorch = async () => {
        try {
            const videoTrack = webcamRef.current?.video?.srcObject?.getVideoTracks()[0];
            if (videoTrack) {
                const newTorchState = !isTorchOn;
                await videoTrack.applyConstraints({
                    advanced: [{ torch: newTorchState }]
                });
                setIsTorchOn(newTorchState);
            }
        } catch (err) {
            console.warn("Flashlight not supported on this device/camera", err);
        }
    };

    // Check for torch availability when camera starts
    const onUserMedia = (stream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities?.() || {};
            setTorchAvailable(!!capabilities.torch);
        }
    };

    // Cargar usuarios para datalists en tiempo real
    useEffect(() => {
        const unsubscribe = subscribeToUsers((data) => {
            setUsers(data || []);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!modelsReady && step === 2) {
            setStatus('Iniciando motores híbridos...');
            initHybridEngine().then((res) => {
                if (res.success) {
                    setModelsReady(true);
                    setStatus('Sistemas listos ✅');
                } else {
                    setStatus('Error de IA: ' + res.error);
                }
            });
        }
    }, [modelsReady, step]);

    // Bucle de calidad en tiempo real para el registro
    useEffect(() => {
        let interval;
        if (step === 2 && modelsReady && !loading) {
            interval = setInterval(async () => {
                if (!webcamRef.current?.video) return;
                const video = webcamRef.current.video;
                if (video.readyState !== 4) return;

                try {
                    const mpDetection = await detectFaceMediaPipe(video);
                    if (!mpDetection) {
                        setQualityError('Buscando rostro...');
                        setQualityCode('NO_FACE');
                        setFaceBox(null);
                    } else {
                        const quality = checkFaceQuality(mpDetection, webcamRef.current.video);
                        setQualityError(quality.ok ? '¡Rostro listo!' : quality.reason);
                        setQualityCode(quality.ok ? 'OK' : quality.code);

                        // Update Face Box
                        const { originX, originY, width, height } = mpDetection.boundingBox;
                        const video = webcamRef.current.video;
                        setFaceBox({
                            x: (originX / video.videoWidth) * 100,
                            y: (originY / video.videoHeight) * 100,
                            w: (width / video.videoWidth) * 100,
                            h: (height / video.videoHeight) * 100
                        });
                    }
                } catch (e) {
                    console.error("Error en loop register:", e);
                }
            }, 200); // Un poco más lento que en consulta para no saturar
        }
        return () => clearInterval(interval);
    }, [step, modelsReady, loading]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const captureAndSave = useCallback(async () => {
        if (!webcamRef.current) return;

        // VALIDACIÓN: DNI
        const dniExists = await checkDniExists(formData.dni);
        if (dniExists) {
            alert(`⚠️ El DNI ${formData.dni} ya está registrado.`);
            return;
        }

        setLoading(true);
        setStatus('Preparando captura...');
        setTimer(0);

        const startTime = Date.now();
        const timerInterval = setInterval(() => {
            setTimer(((Date.now() - startTime) / 1000).toFixed(1));
        }, 100);

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) throw new Error("No hay imagen");

            const img = new Image();
            img.src = imageSrc;
            await new Promise((res) => img.onload = res);

            // Generar miniatura (Foto de cara) - Mayor resolución para evitar desenfoque
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 400;
            thumbnailCanvas.height = 400;
            const tCtx = thumbnailCanvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            tCtx.drawImage(img, x, y, size, size, 0, 0, 400, 400);
            const photoUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);

            setStatus('Procesando rostro...');
            const { getFaceDataLocal } = await import('../services/faceServiceLocal');
            const data = await getFaceDataLocal(webcamRef.current.video);

            if (data) {
                const { descriptor, detection } = data;

                // VALIDACIÓN DE CALIDAD FINAL
                const quality = checkFaceQuality(detection, webcamRef.current.video);

                if (!quality.ok) {
                    alert(`⚠️ Calidad insuficiente: ${quality.reason}. Por favor, sigue las instrucciones.`);
                    setLoading(false);
                    clearInterval(timerInterval);
                    setStatus('Error de calidad');
                    return;
                }

                setStatus('Verificando duplicados...');
                const allUsers = await getUsers(true);
                if (allUsers.length > 0) {
                    const matcher = createMatcher(allUsers);
                    const bestMatch = matcher.findBestMatch(new Float32Array(descriptor));
                    if (bestMatch.label !== 'unknown') {
                        const matched = allUsers.find(u => u.id === bestMatch.label);
                        alert(`⚠️ Ya registrado: ${matched.name} (${matched.dni})`);
                        setLoading(false);
                        clearInterval(timerInterval);
                        return;
                    }
                }

                setStatus('¡Analizado!');
                await saveUser({
                    ...formData,
                    descriptor: Array.from(descriptor),
                    photo: photoUrl,
                    status: 'habilitado',
                    createdAt: new Date().toISOString()
                });

                setStatus('¡ÉXITO!');
                setTimeout(() => navigate('/'), 1000);
            } else {
                throw new Error("No se detectó rostro");
            }
        } catch (error) {
            alert(error.message);
            setStatus('Falla');
        } finally {
            clearInterval(timerInterval);
            setLoading(false);
        }
    }, [formData, navigate]);

    const distinctTeams = [...new Set(users.map(u => u.team))].filter(Boolean).sort();
    const distinctCategories = [...new Set(users.map(u => u.category))].filter(Boolean).sort();

    return (
        <div className="container" style={{ padding: '10px 0' }}>
            <header style={{ textAlign: 'center', marginBottom: '25px' }}>
                <img src={adccLogo} alt="ADCC" style={{ width: '80px', marginBottom: '10px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}><span style={{ color: 'var(--primary)' }}>ADCC</span> Registro</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{step === 1 ? 'Completa los datos' : 'Captura de rostro'}</p>
            </header>

            {step === 1 ? (
                <div key="form" className="glass-panel" style={{ padding: '25px', maxWidth: '450px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Nombre y Apellido</label>
                            <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Juan Pérez" className="premium-input" />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>DNI (Solo números)</label>
                            <input name="dni" type="number" value={formData.dni} onChange={handleInputChange} placeholder="12345678" className="premium-input" />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Equipo / Club (Escribe o selecciona)</label>
                            <input name="team" list="teams-list" value={formData.team} onChange={handleInputChange} placeholder="Ej: Boca Juniors" className="premium-input" />
                            <datalist id="teams-list">
                                {distinctTeams.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Categoría (Escribe o selecciona)</label>
                            <input name="category" list="cats-list" value={formData.category} onChange={handleInputChange} placeholder="Ej: 2010 o 1ra" className="premium-input" />
                            <datalist id="cats-list">
                                {distinctCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!formData.name || !formData.dni || !formData.team || !formData.category}
                            className="glass-button"
                            style={{ marginTop: '10px', width: '100%', py: '15px' }}
                        >
                            CONTINUAR A CÁMARA <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div key="camera" className="glass-panel" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
                    <div className="webcam-wrapper" style={{ borderRadius: '15px', overflow: 'hidden', marginBottom: '20px', aspectRatio: '1/1', position: 'relative' }}>
                        <Webcam
                            key={cameraKey}
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            width="100%"
                            height="100%"
                            playsInline
                            muted
                            autoPlay
                            videoConstraints={{ facingMode }}
                            onUserMedia={onUserMedia}
                            onUserMediaError={(err) => {
                                console.error("Error de cámara:", err);
                                let msg = "Error de cámara";
                                if (err.name === 'NotAllowedError') msg = "Permiso denegado";
                                if (err.name === 'NotFoundError') msg = "No se encontró el dispositivo";
                                if (err.name === 'NotReadableError') msg = "Cámara en uso";
                                setStatus("Falla: " + msg + " (iOS Ready)");
                            }}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />

                        <div style={{ position: 'absolute', bottom: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 100 }}>
                            {torchAvailable && facingMode === 'environment' && (
                                <button
                                    onClick={toggleTorch}
                                    className="glass-button"
                                    style={{
                                        padding: '12px',
                                        borderRadius: '50%',
                                        width: '50px',
                                        height: '50px',
                                        minWidth: '50px',
                                        background: isTorchOn ? '#fbbf24' : 'rgba(0,0,0,0.5)',
                                        border: '2px solid rgba(255,255,255,0.5)',
                                        // backdropFilter: 'blur(5px)',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.3s'
                                    }}
                                    title="Alternar Linterna"
                                >
                                    <Lightbulb size={24} color={isTorchOn ? "black" : "white"} />
                                </button>
                            )}

                            <button
                                onClick={toggleCamera}
                                className="glass-button"
                                style={{
                                    padding: '12px',
                                    borderRadius: '50%',
                                    width: '50px',
                                    height: '50px',
                                    minWidth: '50px', // Forzar tamaño
                                    background: 'rgba(59, 130, 246, 0.9)', // Color primario más visible
                                    border: '2px solid rgba(255,255,255,0.5)',
                                    // backdropFilter: 'blur(5px)',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <SwitchCamera size={24} color="white" />
                            </button>
                        </div>

                        {/* Face Bounding Box Overlay */}
                        {faceBox && (
                            <div className="face-box-overlay">
                                <div
                                    className={`face-box ${qualityCode !== 'OK' ? 'invalid' : ''} ${loading ? 'processing' : ''}`}
                                    style={{
                                        left: `${faceBox.x}%`,
                                        top: `${faceBox.y}%`,
                                        width: `${faceBox.w}%`,
                                        height: `${faceBox.h}%`
                                    }}
                                >
                                    <div className="face-box-corner tl"></div>
                                    <div className="face-box-corner tr"></div>
                                    <div className="face-box-corner bl"></div>
                                    <div className="face-box-corner br"></div>
                                    {qualityCode === 'OK' && !loading && <div className="face-box-scan-line"></div>}
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(2,6,23,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', /* backdropFilter: 'blur(4px)', */ zIndex: 10 }}>
                                <RefreshCw className="animate-spin" size={48} color="var(--primary)" />
                            </div>
                        )}
                    </div>

                    <div style={{
                        marginBottom: '20px',
                        padding: '12px',
                        borderRadius: '12px',
                        background: qualityCode === 'OK' ? 'rgba(34, 197, 94, 0.15)' : qualityCode === 'NO_FACE' ? 'rgba(255,255,255,0.05)' : 'rgba(245, 158, 11, 0.15)',
                        color: qualityCode === 'OK' ? '#4ade80' : qualityCode === 'NO_FACE' ? '#94a3b8' : '#fbbf24',
                        border: `1px solid ${qualityCode === 'OK' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700', fontSize: '0.85rem'
                    }}>
                        {loading ? status : (status === '¡ÉXITO!' ? status : (qualityCode === 'DISTANCE_TOO_FAR' ? 'Acércate más a la cámara' : qualityError))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setStep(1)} disabled={loading} className="glass-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>ATRÁS</button>
                        <button onClick={captureAndSave} disabled={loading || qualityCode !== 'OK'} className="glass-button" style={{
                            flex: 2,
                            background: qualityCode === 'OK' ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                            borderColor: qualityCode === 'OK' ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                            color: qualityCode === 'OK' ? 'white' : 'rgba(255,255,255,0.3)',
                            opacity: qualityCode === 'OK' ? 1 : 0.6
                        }}>
                            {loading ? 'ANALIZANDO...' : 'REGISTRAR JUGADOR'}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .select-mode-btn {
                    padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); 
                    background: rgba(255,255,255,0.02); color: white; cursor: pointer; font-size: 0.7rem; font-weight: bold;
                    transition: all 0.2s;
                }
                .select-mode-btn.active { border-color: var(--primary); background: rgba(59, 130, 246, 0.1); color: var(--primary); }
                .select-mode-btn.active-local { border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
                
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .animate-spin { animation: spin 2s linear infinite; }
            `}</style>
        </div>
    );
};

export default Register;
