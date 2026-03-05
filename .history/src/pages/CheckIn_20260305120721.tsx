import PlayerSearchRegistry from '../components/PlayerSearchRegistry';

const CheckIn = () => {
    // ... (previous state)
    const [showSearchRegistry, setShowSearchRegistry] = useState(false);

    const fetchUsers = async () => {
        // OPTIMIZATION: Solo descargar jugadores con partidos hoy
        const data = await getMatchDayUsers();
        setUsers(data);
        const faceMatcher = createMatcher(data);
        setMatcher(faceMatcher);

        // Fetch live/scheduled matches
        const matches = await getMatches();
        const active = matches.filter((m: any) => m.status === 'live' || m.status === 'scheduled');
        setActiveMatches(active);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // ... (rest of the component)

    return (
        <div className="container animate-fade-in" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* ... (Header) */}

            {/* ... (Webcam and Overlays) */}

            <button
                onClick={() => setShowSearchRegistry(true)}
                className="glass-button"
                style={{ marginTop: '20px', padding: '10px 20px', fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--primary)' }}
            >
                <Search size={16} style={{ marginRight: '8px' }} /> ¿NO TE RECONOCE? BUSCAR MANUALMENTE
            </button>

            {showSearchRegistry && (
                <PlayerSearchRegistry
                    onClose={() => setShowSearchRegistry(false)}
                    onSuccess={() => {
                        // Recargar lista de hoy para que el matcher lo incluya si vuelve a pasar por cámara
                        fetchUsers();
                    }}
                />
            )}

            <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Ubica tu rostro frente a la cámara para el acceso automático
            </p>
        </div>
    );
};

useEffect(() => {
    let interval;
    const detectFace = async () => {
        if (!webcamRef.current || !webcamRef.current.video || !matcher || isProcessing) return;

        const video = webcamRef.current.video;
        if (video.readyState !== 4) return;

        setIsProcessing(true);

        try {
            // Detección local de alta calidad
            const faceData = await getFaceDataLocal(video);

            if (faceData && faceData.descriptor && faceData.detection) {
                const quality = checkFaceQuality(faceData.detection, video);

                if (!quality.ok) {
                    setFeedbackMsg(quality.reason);
                    setTimeout(() => setIsProcessing(false), 500); // Pausa corta
                    return;
                }

                setFeedbackMsg(''); // Rostro óptimo
                const match = matcher.findBestMatch(faceData.descriptor);

                if (match.label !== 'unknown') {
                    const user = users.find(u => u.id === match.label);
                    if (user) {
                        playSuccessSound();
                        if (window.navigator.vibrate) window.navigator.vibrate(200);

                        // Find target match
                        const userMatch = activeMatches.find(m => m.teamA?.name === user.team || m.teamB?.name === user.team);

                        if (userMatch) {
                            // Request shirt number
                            setPendingNumberUser({ user, match: userMatch });
                            setMatchResult({ type: 'success', user, waitNumber: true });
                        } else {
                            // Normal success without match (e.g., training or generic CheckIn)
                            setMatchResult({ type: 'success', user, waitNumber: false });
                            setTimeout(() => setMatchResult(null), 4000);
                        }
                    }
                } else {
                    setFeedbackMsg('No reconocido');
                    setTimeout(() => setFeedbackMsg(''), 2000);
                }
            }
        } catch (err) {
            // Error
        } finally {
            // Pausa para no saturar
            setTimeout(() => setIsProcessing(false), 1500);
        }
    };

    interval = setInterval(() => {
        if (!pendingNumberUser && !matchResult) {
            detectFace();
        }
    }, 1500);
    return () => clearInterval(interval);
}, [matcher, isProcessing, users, activeMatches, pendingNumberUser, matchResult]);

const handleConfirmNumber = async () => {
    if (!pendingNumberUser || !shirtNumber) return;
    setIsProcessing(true);
    try {
        const currentMatch = await getMatch(pendingNumberUser.match.id);
        if (currentMatch) {
            const teamKey = currentMatch.teamA.name === pendingNumberUser.user.team ? 'playersA' : 'playersB';
            const players = currentMatch[teamKey] || [];
            const playerIndex = players.findIndex((p: any) => p.dni === pendingNumberUser.user.dni || p.id === pendingNumberUser.user.id);

            if (playerIndex >= 0) {
                players[playerIndex].camiseta = parseInt(shirtNumber);
                players[playerIndex].number = parseInt(shirtNumber);
                players[playerIndex].status = 'titular'; // Le damos el presente
                players[playerIndex].jugo = 1;
            } else {
                players.push({
                    ...pendingNumberUser.user,
                    camiseta: parseInt(shirtNumber),
                    number: parseInt(shirtNumber),
                    status: 'titular',
                    jugo: 1
                });
            }

            await updateMatch(pendingNumberUser.match.id, { [teamKey]: players });
        }

        // Success
        setShirtNumber('');
        setPendingNumberUser(null);
        setTimeout(() => setMatchResult(null), 1500); // Disappear slightly after confirm
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
    }
};

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

            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                {feedbackMsg && (
                    <div className="animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {feedbackMsg}
                    </div>
                )}
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
                        <div style={{ marginTop: '20px', padding: '15px 30px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px', width: '90%' }}>
                            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0 0 5px 0' }}>{matchResult.user.name}</p>
                            <p style={{ fontSize: '0.9rem', opacity: 0.8, margin: 0 }}>{matchResult.user.team}</p>
                        </div>

                        {matchResult.waitNumber && pendingNumberUser && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                style={{ marginTop: '20px', width: '90%' }}
                            >
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Número de camiseta hoy:</label>
                                <input
                                    type="number"
                                    value={shirtNumber}
                                    onChange={(e) => setShirtNumber(e.target.value)}
                                    style={{
                                        width: '100%', padding: '15px', borderRadius: '10px',
                                        border: 'none', textAlign: 'center', fontSize: '1.5rem',
                                        fontWeight: 'bold', color: 'var(--text-main)', background: 'var(--bg-main)',
                                        marginBottom: '10px'
                                    }}
                                    autoFocus
                                    placeholder="Ej: 10"
                                />
                                <button
                                    onClick={handleConfirmNumber}
                                    disabled={!shirtNumber || isProcessing}
                                    className="glass-button"
                                    style={{ width: '100%', background: 'white', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem', padding: '15px' }}
                                >
                                    {isProcessing ? 'GUARDANDO...' : 'CONFIRMAR Y DAR PRESENTE'}
                                </button>
                            </motion.div>
                        )}
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
