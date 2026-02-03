import Fuse from 'fuse.js';

/**
 * Servicio de Reconocimiento de Voz para Árbitros (Ref-Voice)
 * Permite registrar eventos mediante comandos de voz.
 */

class VoiceRefereeService {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.lang = 'es-ES';
        this.onCommand = null; // Callback para ejecutar acción
        this.lastTranscript = '';

        // Comandos base para fuzzy matching
        this.commands = [
            { id: 'goal_local', keys: ['gol local', 'gol equipo a', 'gol del local', 'tanto local'] },
            { id: 'goal_visitor', keys: ['gol visitante', 'gol equipo b', 'gol del visitante', 'tanto visitante'] },
            { id: 'yellow_card', keys: ['tarjeta amarilla', 'amonestación', 'amarilla'] },
            { id: 'red_card', keys: ['tarjeta roja', 'roja', 'expulsión'] },
            { id: 'substitution', keys: ['cambio', 'sustitución', 'sale'] },

            // Comandos de Estado de Partido
            { id: 'start_match', keys: ['iniciar partido', 'arrancar', 'comenzar', 'pitazo inicial'] },
            { id: 'halftime', keys: ['entretiempo', 'final primer tiempo', 'descanso', 'medio tiempo'] },
            { id: 'finish_match', keys: ['final del partido', 'terminar partido', 'fin del juego', 'finalizar'] },

            // Consultas
            { id: 'time_check', keys: ['tiempo', 'minuto', 'cronómetro', 'cuánto va'] },
            { id: 'score_check', keys: ['resultado', 'marcador', 'cómo van', 'score'] },

            // Utilidades
            { id: 'undo', keys: ['cancelar', 'deshacer', 'borrar último', 'corrección'] }
        ];

        // Configurar Fuse para búsqueda difusa (tolerancia a errores de pronunciación)
        this.fuse = new Fuse(this.commands, {
            keys: ['keys'],
            threshold: 0.4, // 0.0 es coincidencia exacta, 1.0 es cualquier cosa
            includeScore: true
        });

        this.init();
    }

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("Web Speech API no soportada en este navegador.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = this.lang;

        this.recognition.onresult = (event) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.toLowerCase().trim();
            this.lastTranscript = transcript;
            console.log("🎤 Escuchado:", transcript);
            this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error("Error de voz:", event.error);
            if (event.error === 'not-allowed') {
                this.speak("Permiso de micrófono denegado.");
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                // Reiniciar si se detiene inesperadamente (iOS hace esto)
                this.recognition.start();
            }
        };
    }

    start(callback) {
        if (this.recognition && !this.isListening) {
            this.onCommand = callback;
            this.recognition.start();
            this.isListening = true;
            this.speak("Sistema de voz activo.");

            // HACK: Keep-Alive para iOS/Android (Reproducir silencio para evitar que el navegador duerma la tab)
            this.keepAliveAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Sonido corto o silencio
            this.keepAliveAudio.loop = true;
            this.keepAliveAudio.volume = 0.001; // Casi mudo
            this.keepAliveAudio.play().catch(e => console.warn("Audio keep-alive bloqueado:", e));
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            this.recognition.stop();
            this.speak("Sistema de voz desactivado.");

            if (this.keepAliveAudio) {
                this.keepAliveAudio.pause();
                this.keepAliveAudio = null;
            }
        }
    }

    processCommand(transcript) {
        // 1. Detectar Comando Principal con Fuse.js
        const results = this.fuse.search(transcript);

        if (results.length > 0 && results[0].score < 0.4) {
            const commandId = results[0].item.id;

            // 2. Extraer Números (Dorsal/es)
            // Soporta "entra el 10 sale el 5" -> [10, 5]
            const numbers = (transcript.match(/\d+/g) || []).map(n => parseInt(n));
            const dorsal = numbers.length > 0 ? numbers[0] : null;
            const dorsal2 = numbers.length > 1 ? numbers[1] : null;

            // 3. Ejecutar Callback
            if (this.onCommand) {
                this.onCommand({
                    command: commandId,
                    dorsal: dorsal,
                    dorsal2: dorsal2, // Para sustituciones
                    original: transcript
                });
            }

            // 4. Feedback Auditivo
            this.provideFeedback(commandId, dorsal, dorsal2);
        }
    }

    provideFeedback(commandId, dorsal, dorsal2) {
        let text = "";
        switch (commandId) {
            case 'goal_local': text = "Gol local registrado."; break;
            case 'goal_visitor': text = "Gol visitante registrado."; break;
            case 'yellow_card': text = `Amarilla para el número ${dorsal || 'desconocido'}.`; break;
            case 'red_card': text = `Roja para el número ${dorsal || 'desconocido'}.`; break;
            case 'substitution':
                if (dorsal && dorsal2) text = `Cambio. Entra ${dorsal}, sale ${dorsal2}.`;
                else text = "Iniciando cambio. Mencione 'Sale X Entra Y'.";
                break;

            case 'start_match': text = "Iniciando partido."; break;
            case 'halftime': text = "Marcando entretiempo."; break;
            case 'finish_match': text = "Finalizando partido."; break;
            case 'undo': text = "Deshaciendo última acción."; break;
            // time_check y score_check se manejan dinámicamente en el componente principal
            case 'time_check': text = ""; break;
            case 'score_check': text = ""; break;
        }
        if (text) this.speak(text);
    }

    speak(text) {
        // Feedback auditivo desactivado a pedido del usuario (Punto 1)
        console.log("🔊 Feedback (Silenciado):", text);

        // Si en el futuro se quiere reactivar, descomentar:
        /*
        if (this.synthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang;
            utterance.rate = 1.1; 
            this.synthesis.speak(utterance);
        }
        */
    }
}

export const voiceReferee = new VoiceRefereeService();
