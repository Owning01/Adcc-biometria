import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { getUsers } from '../services/db';
import { createMatcher, getFaceDescriptor } from '../services/faceService';
import { playSuccessSound } from '../services/audioService';
import { CheckCircle, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CheckIn = () => {
    const webcamRef = useRef(null);
    const [matchResult, setMatchResult] = useState(null);
    const [matcher, setMatcher] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            const data = await getUsers();
            setUsers(data);
            const faceMatcher = createMatcher(data);
            setMatcher(faceMatcher);
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        let interval;
        const detectFace = async () => {
            if (!webcamRef.current || !webcamRef.current.video || !matcher || isProcessing) return;

            const video = webcamRef.current.video;
            if (video.readyState !== 4) return;

            setIsProcessing(true);

            try {
                // Modo Nube + Worker detection
                const descriptor = await getFaceDescriptor(video);

                if (descriptor) {
                    const match = matcher.findBestMatch(descriptor);

                    if (match.label !== 'unknown') {
                        const user = users.find(u => u.id === match.label);
                        if (user) {
                            setMatchResult({ type: 'success', user });
                            playSuccessSound();
                            // Vibración si es móvil
                            if (window.navigator.vibrate) window.navigator.vibrate(200);
                            setTimeout(() => setMatchResult(null), 4000);
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                // Pausa para no saturar
                setTimeout(() => setIsProcessing(false), 2000);
            }
        };

        interval = setInterval(detectFace, 1500);
        return () => clearInterval(interval);
    }, [matcher, isProcessing, users]);

    return (
        <div className="container animate-fade-in" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 20px', borderRadius: '99px', color: 'var(--primary)', marginBottom: '15px' }}>
                    <ShieldCheck size={18} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Escaneo Biométrico Activo</span>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>Punto de <span style={{ color: 'var(--primary)' }}>Acceso</span></h1>
            </div>

            <div className="webcam-wrapper" style={{ width: '100%', maxWidth: '500px', aspectRatio: '1/1', maxHeight: '70vh' }}>
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    width="100%"
                    height="100%"
                    playsInline
                    muted
                    videoConstraints={{ facingMode: "user", width: 480, height: 480 }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Scan Overlay UI */}
                <div className="scan-line"></div>

                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <div className={`status-badge ${isProcessing ? 'status-loading' : ''}`} style={{ background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(10px)' }}>
                        {isProcessing ? (
                            <> <RefreshCw size={14} className="animate-spin" /> Analizando... </>
                        ) : (
                            <> <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div> Buscando rostro... </>
                        )}
                    </div>
                </div>

                {/* Result Overlay */}
                <AnimatePresence>
                    {matchResult && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -20 }}
                            style={{
                                position: 'absolute',
                                inset: '10px',
                                background: 'rgba(16, 185, 129, 0.95)',
                                borderRadius: '15px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                backdropFilter: 'blur(10px)',
                                zIndex: 20,
                                color: 'white'
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', damping: 12 }}
                            >
                                <CheckCircle size={80} color="white" strokeWidth={3} />
                            </motion.div>
                            <h2 style={{ fontSize: '2.5rem', margin: '20px 0 5px 0', fontWeight: '800' }}>¡ÉXITO!</h2>
                            <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Bienvenido de nuevo</p>
                            <div style={{ marginTop: '20px', padding: '15px 30px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px' }}>
                                <p style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0 }}>{matchResult.user.name}</p>
                                <p style={{ fontSize: '0.9rem', opacity: 0.8, margin: '5px 0 0 0' }}>{matchResult.user.team} - {matchResult.user.category}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <p style={{ marginTop: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Ubica tu rostro frente a la cámara para el acceso automático
            </p>
        </div>
    );
};

export default CheckIn;
