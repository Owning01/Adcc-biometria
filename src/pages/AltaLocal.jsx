import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { getUsers, subscribeToUsers } from '../services/db';
import { createMatcher } from '../services/faceService';
import { initHybridEngine, checkFaceQuality } from '../services/hybridFaceService';
import { detectFaceMediaPipe } from '../services/mediapipeService';
import { getFaceDataLocal } from '../services/faceServiceLocal';
import { playSuccessSound, playErrorSound } from '../services/audioService';
import { ShieldCheck, Search, RefreshCw, BadgeInfo, Cpu, Zap, ShieldAlert, XCircle, UserCircle, SwitchCamera, ArrowLeft, Lightbulb } from 'lucide-react';
import adccLogo from '../Applogo.png';

const AltaLocal = () => {
    const webcamRef = useRef(null);
    const [matchResult, setMatchResult] = useState(null);
    const [matcher, setMatcher] = useState(null);
    const [users, setUsers] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isModelsLoading, setIsModelsLoading] = useState(true);
    const [scanProgress, setScanProgress] = useState(0);
    const [facingMode, setFacingMode] = useState('user');
    const [cameraKey, setCameraKey] = useState(0);
    const [loadError, setLoadError] = useState('');
    const [tipIndex, setTipIndex] = useState(0);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [statusText, setStatusText] = useState('Escaneando...');
    const [qualityError, setQualityError] = useState('');
    const [faceBox, setFaceBox] = useState(null);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    const tips = [
        { icon: <Zap size={20} color="#fbbf24" />, text: "Busca un lugar con buena iluminación" },
        { icon: <UserCircle size={20} color="#3b82f6" />, text: "Mira directo al centro de la cámara" },
        { icon: <ShieldAlert size={20} color="#f87171" />, text: "Rostro descubierto, sin gafas oscuras" },
        { icon: <Search size={20} color="#a855f7" />, text: "Acércate un poco más si no detecta" },
        { icon: <UserCircle size={20} color="#10b981" />, text: "Asegúrate de que tu cara ocupe buen espacio en el círculo" },
        { icon: <UserCircle size={20} color="#10b981" />, text: "Asegúrate de que tu cara ocupe buen espacio en el círculo" }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % tips.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const toggleCamera = () => {
        setIsTorchOn(false); // Reset torch when switching
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        setCameraKey(prev => prev + 1); // Forzar re-render
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

    const onUserMedia = (stream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities?.() || {};
            setTorchAvailable(!!capabilities.torch);
        }
    };

    const handlePlay = () => {
        setIsVideoReady(true);
    };

    const forceStartVideo = () => {
        if (webcamRef.current && webcamRef.current.video) {
            webcamRef.current.video.play()
                .then(() => setIsVideoReady(true))
                .catch(e => {
                    console.error("Error al forzar play:", e);
                    alert("Por favor, desactiva el ahorro de batería o presiona fuerte el botón de Play.");
                });
        }
    };

    useEffect(() => {
        let unsubscribe;
        const init = async () => {
            setLoadError('');
            try {
                const result = await initHybridEngine();
                if (result.success) {
                    setIsModelsLoading(false);
                    unsubscribe = subscribeToUsers((data) => {
                        setUsers(data || []);
                        const faceMatcher = createMatcher(data || []);
                        setMatcher(faceMatcher);
                    });
                } else {
                    setLoadError(result.error || 'Error desconocido al cargar motores Híbridos');
                    setIsModelsLoading(false);
                }
            } catch (e) {
                setLoadError(e.message);
                setIsModelsLoading(false);
            }
        };
        init();
        return () => unsubscribe && unsubscribe();
    }, [cameraKey]);

    useEffect(() => {
        let interval;

        const detectFaceHybrid = async () => {
            if (!webcamRef.current || !webcamRef.current.video || !matcher || isProcessing || isModelsLoading) return;
            const video = webcamRef.current.video;
            if (video.readyState !== 4) return;

            const mpDetection = await detectFaceMediaPipe(video);

            if (!mpDetection) {
                setQualityError('No se detecta rostro');
                setScanProgress(0);
                setFaceBox(null);
                return;
            }

            const { originX, originY, width, height } = mpDetection.boundingBox;
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;

            setFaceBox({
                x: (originX / videoW) * 100,
                y: (originY / videoH) * 100,
                w: (width / videoW) * 100,
                h: (height / videoH) * 100
            });

            const quality = checkFaceQuality(mpDetection, video);
            if (!quality.ok) {
                setQualityError(quality.reason);
                setScanProgress(prev => Math.max(0, prev - 10));
                return;
            }

            setQualityError('');

            setScanProgress(prev => {
                const next = prev + 25;
                if (next >= 100) {
                    performDeepRecognition(video);
                    return 0;
                }
                return next;
            });
        };

        const performDeepRecognition = async (video) => {
            setIsProcessing(true);
            setStatusText('Reconociendo...');
            try {
                const data = await getFaceDataLocal(video);
                if (data) {
                    const { descriptor } = data;
                    const match = matcher.findBestMatch(descriptor);

                    if (match.label !== 'unknown') {
                        const user = users.find(u => u.id === match.label);
                        if (user) {
                            setMatchResult(user);
                            if ((user.status || 'habilitado') === 'habilitado') {
                                playSuccessSound();
                            } else {
                                playErrorSound();
                            }
                        }
                    } else {
                        setStatusText('Desconocido');
                        setTimeout(() => setStatusText('Escaneando...'), 2000);
                    }
                }
            } catch (err) {
                console.error("Error en reconocimiento profundo:", err);
            } finally {
                setIsProcessing(false);
                setStatusText('Escaneando...');
                setFaceBox(null);
            }
        };

        if (!matchResult && !isModelsLoading) {
            interval = setInterval(detectFaceHybrid, 150);
        }

        return () => clearInterval(interval);
    }, [matcher, isProcessing, matchResult, users, isModelsLoading]);

    if (loadError) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
                <Link to="/" className="glass-button" style={{ position: 'absolute', top: 20, left: 20 }}>
                    <ArrowLeft /> SALIR
                </Link>
                <XCircle size={48} color="#ef4444" style={{ marginBottom: '20px' }} />
                <h3 style={{ color: '#ef4444' }}>Falla de Sistema (IA)</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '300px' }}>{loadError}</p>
                <button onClick={() => window.location.reload()} className="glass-button">
                    <RefreshCw size={20} /> REINTENTAR
                </button>
            </div>
        );
    }

    if (isModelsLoading) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <RefreshCw size={48} className="animate-spin" color="var(--primary)" />
                <h2 style={{ marginTop: '20px' }}>Cargando IA Local...</h2>
                <p style={{ color: 'var(--text-muted)' }}>Esto solo ocurre la primera vez</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '20px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                    Consulta de Jugador
                </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (window.innerWidth > 800 && !matchResult) ? '1fr 1fr' : '1fr', gap: '30px', alignItems: 'start' }}>

                {!matchResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', minHeight: '50px', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ minWidth: '24px' }}>{tips[tipIndex].icon}</div>
                            <span className="animate-fade-in" key={tipIndex} style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)', textAlign: 'center' }}>
                                {tips[tipIndex].text}
                            </span>
                        </div>

                        <div className="webcam-wrapper" style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', border: '2px solid rgba(245, 158, 11, 0.3)', position: 'relative', borderRadius: '24px' }}>
                            <Webcam
                                key={cameraKey}
                                audio={false}
                                ref={webcamRef}
                                height="100%"
                                playsInline
                                muted
                                autoPlay
                                onPlaying={handlePlay}
                                videoConstraints={{ facingMode }}
                                onUserMedia={onUserMedia}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />

                            {!isVideoReady && (
                                <div
                                    style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.8)',
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center',
                                        zIndex: 150, gap: '15px',
                                        padding: '20px'
                                    }}
                                >
                                    <RefreshCw size={30} className="animate-spin" color="white" />
                                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>INICIANDO CÁMARA...</p>
                                </div>
                            )}

                            <div style={{ position: 'absolute', bottom: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 100 }}>
                                {torchAvailable && facingMode === 'environment' && (
                                    <button onClick={toggleTorch} className="glass-button" style={{ borderRadius: '50%', width: '50px', height: '50px', background: isTorchOn ? '#fbbf24' : 'rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Lightbulb size={24} color={isTorchOn ? "black" : "white"} />
                                    </button>
                                )}
                                <button onClick={toggleCamera} className="glass-button" style={{ borderRadius: '50%', width: '50px', height: '50px', background: 'rgba(245, 158, 11, 0.9)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SwitchCamera size={24} color="white" />
                                </button>
                            </div>

                            {faceBox && (
                                <div className="face-box-overlay">
                                    <div className={`face-box ${qualityError ? 'invalid' : ''} ${isProcessing ? 'processing' : ''}`} style={{ left: `${faceBox.x}%`, top: `${faceBox.y}%`, width: `${faceBox.w}%`, height: `${faceBox.h}%` }}>
                                        <div className="face-box-corner tl"></div>
                                        <div className="face-box-corner tr"></div>
                                        <div className="face-box-corner bl"></div>
                                        <div className="face-box-corner br"></div>
                                    </div>
                                </div>
                            )}

                            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', zIndex: 20 }}>
                                <div className="status-badge" style={{ background: qualityError ? 'rgba(239, 68, 68, 0.8)' : (isProcessing ? 'rgba(59, 130, 246, 0.8)' : 'rgba(34, 197, 94, 0.8)'), color: '#fff' }}>
                                    {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : (qualityError ? <XCircle size={12} /> : <Zap size={12} />)}
                                    {qualityError ? qualityError : statusText}
                                </div>
                                {!isProcessing && !matchResult && (
                                    <div style={{ width: '120px', height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${scanProgress}%`, background: '#f59e0b', transition: 'width 0.1s linear' }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Section */}
                {(() => {
                    const userData = matchResult ? users.find(u => u.id === matchResult.id) : null;

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'center' }}>
                            {userData ? (
                                <div key="result" className="animate-fade-in">
                                    <div className={`fifa-card ${(userData.status || 'habilitado') === 'habilitado' ? '' : 'deshabilitado'}`}>
                                        <div className="fifa-card-header">
                                            <div className="fifa-rating">{userData.number || '--'}</div>
                                            <div className="fifa-position">JUG</div>
                                        </div>
                                        <div className={`fifa-status-badge ${(userData.status || 'habilitado') === 'habilitado' ? 'habilitado' : 'deshabilitado'}`}>
                                            {(userData.status || 'habilitado') === 'habilitado' ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                        </div>
                                        <div className="fifa-photo-container">
                                            {userData.photo ? <img src={userData.photo} className="fifa-photo" alt="" /> : <UserCircle size={120} style={{ opacity: 0.2 }} />}
                                        </div>
                                        <div className="fifa-info">
                                            <div className="fifa-name" style={{ fontSize: userData.name.length > 18 ? '1.1rem' : '1.5rem' }}>
                                                {userData.name.toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '10px' }}>{userData.team}</div>
                                            <div className="fifa-stats">
                                                <div className="fifa-stat-item">
                                                    <div className="fifa-stat-value">{userData.dni}</div>
                                                    <div className="fifa-stat-label">DNI</div>
                                                </div>
                                                <div className="fifa-stat-item" style={{ flex: 1.5 }}>
                                                    <div className="fifa-stat-value" style={{
                                                        color: '#fff',
                                                        fontSize: '0.7rem',
                                                        lineHeight: '1.4',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '2px'
                                                    }}>
                                                        {(Array.isArray(userData.categories) && userData.categories.length > 0 ? userData.categories : [userData.category]).map(c => {
                                                            const catStatus = (userData.categoryStatuses && userData.categoryStatuses[c]) || userData.status || 'habilitado';
                                                            const isHabilitado = catStatus === 'habilitado';
                                                            return (
                                                                <div key={c} style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    color: isHabilitado ? '#4ade80' : '#f87171',
                                                                    background: isHabilitado ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '4px',
                                                                    width: '100%',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isHabilitado ? '#4ade80' : '#f87171' }}></div>
                                                                    {c}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="fifa-stat-label">CAT / ESTADOS</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 55%, transparent 60%)', pointerEvents: 'none' }} />
                                    </div>

                                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{userData.name.toUpperCase()}</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            {(Array.isArray(userData.categories) && userData.categories.length > 0 ? userData.categories : [userData.category]).map(c => {
                                                const catStatus = (userData.categoryStatuses && userData.categoryStatuses[c]) || userData.status || 'habilitado';
                                                return (
                                                    <p key={c} style={{
                                                        color: catStatus === 'habilitado' ? '#4ade80' : '#f87171',
                                                        fontWeight: 'bold',
                                                        margin: 0,
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        {c}: {catStatus.toUpperCase()}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button onClick={() => setMatchResult(null)} className="glass-button" style={{ width: '100%', marginTop: '30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b' }}>
                                        <RefreshCw size={16} /> NUEVA CONSULTA
                                    </button>
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                                    <BadgeInfo size={48} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '15px' }} />
                                    <h3 style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Esperando rostro...</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '280px', margin: '0 auto' }}>
                                        Aproxima el rostro a la cámara para iniciar el reconocimiento.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
            <Link to="/" className="glass-button" style={{ position: 'fixed', top: '20px', left: '20px', padding: '10px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <ArrowLeft size={20} />
            </Link>
        </div>
    );
};

export default AltaLocal;
