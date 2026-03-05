/**
 * @file Register.jsx
 * @description Pantalla de registro de nuevos jugadores.
 * Implementa flujo de dos pasos:
 * 1. Formulario de datos (Nombre, DNI, Equipo, Categoría).
 * 2. Captura facial con validación de calidad en tiempo real (MediaPipe) y generación de descriptor (FaceAPI).
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { createMatcher } from '../services/faceService';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { saveUser, checkDniExists, getUsers, subscribeToUsers } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { Camera, RefreshCw, User, Clipboard, Users, Trophy, Milestone, CheckCircle2, Zap, Globe, ArrowLeft, Plus, SwitchCamera, Lightbulb, Upload, X, Check as SuccessIcon, RefreshCw as RefreshIcon, AlertCircle as WarningIcon } from 'lucide-react';
import adccLogo from '../Applogo.png';

/**
 * Componente principal para el registro de nuevos usuarios.
 * Permite la entrada de datos del usuario y la captura de una imagen facial
 * para su posterior reconocimiento.
 * @returns {JSX.Element} El componente de registro.
 */
const Register = () => {
    // --- ESTADOS ---
    /** @type {React.RefObject<Webcam>} Referencia al componente Webcam para acceder a su API. */
    const webcamRef = useRef<Webcam>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [formData, setFormData] = useState({ name: '', dni: '', team: '', category: '' });
    const [step, setStep] = useState(1); // 1: Form, 2: Camera

    // Estados de UI y Control
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
    const [faceBox, setFaceBox] = useState<any>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const toggleCamera = () => {
        setIsTorchOn(false); // Reset torch when switching
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        setCameraKey(prev => prev + 1); // Forzar que React destruya y recree el componente Webcam
    };

    const toggleTorch = async () => {
        try {
            const stream = webcamRef.current?.video?.srcObject as MediaStream;
            const videoTrack = stream?.getVideoTracks()[0];
            if (videoTrack) {
                const newTorchState = !isTorchOn;
                await (videoTrack as any).applyConstraints({
                    advanced: [{ torch: newTorchState }]
                });
                setIsTorchOn(newTorchState);
            }
        } catch (err) {
            console.warn("Flashlight not supported on this device/camera", err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatus('Cargando imagen...');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const result = event.target?.result;
                if (typeof result !== 'string') return;

                const img = new Image();
                img.onload = async () => {
                    setStatus('Analizando foto...');
                    setUploadedImage(result);

                    const { getFaceDataFromImage } = await import('../services/faceServiceLocal');
                    const data = await getFaceDataFromImage(img);

                    if (data) {
                        setStatus('¡Rostro detectado!');
                        setQualityCode('OK');
                        setQualityError('¡Foto lista!');
                        setLoading(false);
                    } else {
                        alert("No se detectó un rostro claro en la foto.");
                        setUploadedImage(null);
                        setLoading(false);
                        setStatus('Error en foto');
                    }
                };
                img.src = result;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            alert("Error al procesar la imagen");
            setLoading(false);
        }
    };

    // Check for torch availability when camera starts
    const onUserMedia = (stream: MediaStream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities?.() || {};
            setTorchAvailable(!!(capabilities as any).torch);
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

    // Bucle de calidad en tiempo real para el registro.
    // Analiza el stream de video cada 200ms para dar feedback al usuario (Acércate, Aléjate, OK).
    useEffect(() => {
        let interval: any;
        if (step === 2 && modelsReady && !loading) {
            interval = setInterval(async () => {
                if (!webcamRef.current?.video) return;
                const video = webcamRef.current.video as HTMLVideoElement;
                if (video.readyState !== 4) return;

                try {
                    const mpDetection = await detectFaceMediaPipe(video);
                    if (!mpDetection) {
                        setQualityError('Buscando rostro...');
                        setQualityCode('NO_FACE');
                        setFaceBox(null);
                    } else {
                        const quality = checkFaceQuality(mpDetection, video);
                        setQualityError(quality.ok ? '¡Rostro listo!' : quality.reason);
                        setQualityCode(quality.ok ? 'OK' : quality.code);

                        const { originX, originY, width, height } = mpDetection.boundingBox;
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    /**
     * Captura la foto, genera el descriptor y guarda el usuario en Firestore.
     * Incluye validaciones robustas:
     * - DNI duplicado
     * - Calidad de rostro
     * - Rostro duplicado (cotejo 1:N contra toda la base)
     */
    const captureAndSave = useCallback(async () => {
        if (!webcamRef.current && !uploadedImage) return;

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
            setTimer(Number(((Date.now() - startTime) / 1000).toFixed(1)));
        }, 100);

        try {
            let imageSrc;
            let videoElement = null;

            if (uploadedImage) {
                imageSrc = uploadedImage;
            } else if (webcamRef.current) {
                imageSrc = webcamRef.current.getScreenshot();
                videoElement = webcamRef.current.video || null;
            }

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
            if (tCtx) tCtx.drawImage(img, x, y, size, size, 0, 0, 400, 400);
            const photoUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);

            setStatus('Procesando rostro...');
            const { getFaceDataLocal, getFaceDataFromImage } = await import('../services/faceServiceLocal');

            let data;
            if (uploadedImage) {
                data = await getFaceDataFromImage(img);
            } else if (webcamRef.current?.video) {
                data = await getFaceDataLocal(webcamRef.current.video);
            }

            if (data) {
                const { descriptor, detection } = data;

                // VALIDACIÓN DE CALIDAD FINAL
                const quality = checkFaceQuality(detection, videoElement || img);

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
                    if (bestMatch && bestMatch.label !== 'unknown') {
                        const matched = allUsers.find(u => u.id === bestMatch.label);
                        if (matched) {
                            alert(`⚠️ Ya registrado: ${matched.name || (matched.nombre + ' ' + (matched.apellido || ''))} (${matched.dni})`);
                            setLoading(false);
                            clearInterval(timerInterval);
                            return;
                        }
                    }
                }

                setStatus('¡Analizado!');
                await saveUser({
                    ...formData,
                    descriptor: Array.from(descriptor),
                    photo: photoUrl,
                    status: 'habilitado',
                    role: 'usuario',
                    createdAt: new Date().toISOString()
                });

                setStatus('¡ÉXITO!');
                setTimeout(() => navigate('/'), 1000);
            } else {
                throw new Error("No se detectó rostro");
            }
        } catch (error: any) {
            alert(error?.message || "Error desconocido");
            setStatus('Falla');
        } finally {
            clearInterval(timerInterval);
            setLoading(false);
        }
    }, [formData, navigate]);

    const distinctTeams = [...new Set(users.map(u => u.team))].filter(Boolean).sort();
    const distinctCategories = [...new Set(users.map(u => u.category))].filter(Boolean).sort();

    return (
        <div className="register-container">
            <header className="register-header">
                <img src={adccLogo} alt="ADCC" className="register-logo" />
                <h1 className="list-title"><span className="text-highlight">ADCC</span> Registro</h1>
                <p className="list-subtitle">{step === 1 ? 'Completa los datos' : 'Captura de rostro'}</p>
            </header>

            {step === 1 ? (
                <div key="form" className="glass-panel register-form-card">
                    <div className="input-group">
                        <div className="input-field-wrapper">
                            <label className="input-label-small">Nombre y Apellido</label>
                            <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Juan Pérez" className="premium-input" />
                        </div>

                        <div className="input-field-wrapper">
                            <label className="input-label-small">DNI (Solo números)</label>
                            <input name="dni" type="number" value={formData.dni} onChange={handleInputChange} placeholder="12345678" className="premium-input" />
                        </div>

                        <div className="input-field-wrapper">
                            <label className="input-label-small">Equipo / Club (Escribe o selecciona)</label>
                            <input name="team" list="teams-list" value={formData.team} onChange={handleInputChange} placeholder="Ej: Boca Juniors" className="premium-input" />
                            <datalist id="teams-list">
                                {distinctTeams.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>

                        <div className="input-field-wrapper">
                            <label className="input-label-small">Categoría (Escribe o selecciona)</label>
                            <input name="category" list="cats-list" value={formData.category} onChange={handleInputChange} placeholder="Ej: 2010 o 1ra" className="premium-input" />
                            <datalist id="cats-list">
                                {distinctCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!formData.name || !formData.dni || !formData.team || !formData.category}
                            className="glass-button"
                            style={{ marginTop: '0.5rem', width: '100%', padding: '1rem' }}
                        >
                            CONTINUAR A CÁMARA <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div key="camera" className="glass-panel register-camera-card">
                    <div className="camera-viewfinder" style={{ aspectRatio: '1/1', marginBottom: '1.25rem' }}>
                        {uploadedImage ? (
                            <img
                                src={uploadedImage}
                                alt="Uploaded"
                                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                            />
                        ) : (
                            <Webcam
                                key={cameraKey}
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                playsInline
                                muted
                                autoPlay
                                videoConstraints={{ facingMode: { ideal: facingMode } }}
                                onUserMedia={onUserMedia}
                                onUserMediaError={(err: any) => {
                                    console.error("Error de cámara:", err);
                                    let msg = "Error de cámara";
                                    const errorName = typeof err === 'string' ? err : (err?.name || "Unknown");
                                    if (errorName === 'NotAllowedError') msg = "Permiso denegado";
                                    if (errorName === 'NotFoundError') msg = "No se encontró el dispositivo";
                                    if (errorName === 'NotReadableError') msg = "Cámara en uso";
                                    setStatus("Falla: " + msg + " (iOS Ready)");
                                }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        )}

                        <div className="camera-controls-floating">
                            {!uploadedImage && torchAvailable && facingMode === 'environment' && (
                                <button
                                    onClick={toggleTorch}
                                    className={`glass-button btn-camera-toggle btn-camera-toggle-torch ${isTorchOn ? 'active' : ''}`}
                                    title="Alternar Linterna"
                                >
                                    <Lightbulb style={{ width: '24px', height: '24px' }} color={isTorchOn ? "black" : "white"} />
                                </button>
                            )}

                            {!uploadedImage && (
                                <button
                                    onClick={toggleCamera}
                                    className="glass-button btn-camera-toggle btn-camera-toggle-switch"
                                >
                                    <SwitchCamera style={{ width: '24px', height: '24px' }} color="white" />
                                </button>
                            )}
                        </div>

                        <div className="camera-upload-floating">
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => uploadedImage ? setUploadedImage(null) : fileInputRef.current?.click()}
                                className="glass-button"
                                style={{
                                    padding: '10px 15px',
                                    borderRadius: '12px',
                                    background: uploadedImage ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.7rem'
                                }}
                            >
                                {uploadedImage ? <X size={14} /> : <Upload size={14} />}
                                {uploadedImage ? 'CANCELAR FOTO' : 'SUBIR FOTO'}
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
                            <div className="validating-overlay" style={{ background: 'rgba(2,6,23,0.7)', zIndex: 10 }}>
                                <RefreshCw size={48} className="text-highlight animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className={`quality-status-badge ${qualityCode === 'OK' ? 'quality-status-ok' : (qualityCode === 'NO_FACE' ? '' : 'quality-status-warning')}`}>
                        {qualityCode === 'OK' ? <SuccessIcon size={16} /> : (qualityCode === 'NO_FACE' ? <RefreshIcon size={16} className="animate-spin" /> : <WarningIcon size={16} />)}
                        {loading ? status : (status === '¡ÉXITO!' ? status : (qualityCode === 'DISTANCE_TOO_FAR' ? 'Acércate más a la cámara' : qualityError))}
                    </div>

                    <div className="btn-group-modal" style={{ marginTop: '0' }}>
                        <button onClick={() => { setStep(1); setUploadedImage(null); }} disabled={loading} className="glass-button flex-1" style={{ background: 'rgba(255,255,255,0.05)' }}>ATRÁS</button>
                        <button onClick={captureAndSave} disabled={loading || (qualityCode !== 'OK' && !uploadedImage)} className="glass-button flex-large" style={{
                            background: (qualityCode === 'OK' || uploadedImage) ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                            borderColor: (qualityCode === 'OK' || uploadedImage) ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                            color: (qualityCode === 'OK' || uploadedImage) ? 'white' : 'rgba(255,255,255,0.3)',
                            opacity: (qualityCode === 'OK' || uploadedImage) ? 1 : 0.6
                        }}>
                            {loading ? 'ANALIZANDO...' : 'REGISTRAR JUGADOR'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Register;
