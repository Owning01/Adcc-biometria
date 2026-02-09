import Fuse from 'fuse.js';

/**
 * Servicio de Reconocimiento de Voz para Árbitros (Ref-Voice)
 * V2: Optimizado para alta sensibilidad y respuesta rápida en campo.
 */

class VoiceRefereeService {
    private recognition: any = null;
    private synthesis: SpeechSynthesis = window.speechSynthesis;
    public isListening: boolean = false;
    private lang: string = 'es-ES';
    private onCommand: ((data: any) => void) | null = null;
    private lastTranscript: string = '';

    // Lista de "hotwords" o variaciones para despertar al sistema
    private hotwords: string[] = ['árbitro', 'arbitro', 'albitro', 'oye', 'che', 'atento'];
    private commands: any[];
    private fuse: any;
    private keepAliveAudio: HTMLAudioElement | null = null;

    constructor() {
        this.commands = [
            // Goles - Variaciones de "Gol" y "Anota"
            { id: 'goal_local', keys: ['gol local', 'gol de local', 'gol del local', 'tanto local', 'gol equipo a', 'gol casa', 'anota local', 'uno para el local', 'suma local'] },
            { id: 'goal_visitor', keys: ['gol visitante', 'gol de visitante', 'gol del visitante', 'tanto visitante', 'gol equipo b', 'gol la visita', 'anota visitante', 'uno para la visita', 'suma visitante'] },

            // Tarjetas Local - Variantes de "Amarilla" y "Roja"
            { id: 'yellow_card_local', keys: ['amarilla local', 'tarjeta amarilla local', 'amonestado local', 'amonestación local', 'píntalo de amarillo local', 'amarilla para el local', 'amarilla casa'] },
            { id: 'yellow_card_visitor', keys: ['amarilla visitante', 'tarjeta amarilla visitante', 'amonestado visitante', 'amonestación visitante', 'píntalo de amarillo visitante', 'amarilla para la visita', 'amarilla fuera'] },

            { id: 'red_card_local', keys: ['roja local', 'tarjeta roja local', 'expulsado local', 'fuera local', 'a la calle local', 'se va local', 'roja directa local'] },
            { id: 'red_card_visitor', keys: ['roja visitante', 'tarjeta roja visitante', 'expulsado visitante', 'fuera visitante', 'a la calle visitante', 'se va visitante', 'roja directa visitante'] },

            // Compatibilidad Global (Identificación automática por número)
            { id: 'yellow_card', keys: ['amarilla', 'tarjeta amarilla', 'amonestado', 'amonestación', 'amonestar', 'necesito amarilla'] },
            { id: 'red_card', keys: ['roja', 'tarjeta roja', 'expulsado', 'echar', 'a la calle', 'se va', 'afuera', 'roja directa'] },

            // Cambios / Sustituciones
            { id: 'substitution', keys: ['cambio', 'sustitución', 'sale', 'entra', 'modificación', 'variante', 'hay cambio', 'cambio jugador'] },

            // Estado del Partido - Frases naturales
            { id: 'start_match', keys: ['arranca', 'comienza', 'iniciar', 'inicio', 'dale ya', 'pitazo', 'juego', 'mueve la pelota', 'sacar del medio'] },
            { id: 'halftime', keys: ['entretiempo', 'descanso', 'medio tiempo', 'termina primero', 'a los vestuarios', 'final primer tiempo', 'pausa'] },
            { id: 'finish_match', keys: ['final', 'terminó', 'se acabó', 'finalizar', 'pito final', 'fin del partido', 'no va más', 'partido terminado', 'cerramos'] },

            // Consultas
            { id: 'time_check', keys: ['tiempo', 'minuto', 'cuánto va', 'dame el tiempo', 'reloj'] },
            { id: 'score_check', keys: ['resultado', 'marcador', 'cómo vamos', 'score', 'cuánto van'] },

            // Correcciones de Pánico
            { id: 'undo', keys: ['corrección', 'borrar', 'deshacer', 'me equivoqué', 'error', 'no eso no', 'atrás', 'cancela'] }
        ];

        this.fuse = new Fuse(this.commands, {
            keys: ['keys'],
            threshold: 0.4, // Equilibrio entre precisión y facilidad
            includeScore: true
        });

        this.init();
    }

    private init() {
        const win = window as any;
        const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("❌ Web Speech API no soportada en este navegador/WebView.");
            alert("⚠️ Error de Voz: Tu dispositivo o WebView no soporta reconocimiento de voz (Web Speech API). Asegúrate de usar Chrome o actualizar el visor de sistema de Android.");
            return;
        }

        console.log("🎤 Inicializando SpeechRecognition...");
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.lang;

        this.recognition.onerror = (event: any) => {
            console.error("❌ Error de Voz:", event.error);
            // Solo alertamos si no es un 'no-speech' (timout normal)
            if (event.error !== 'no-speech') {
                alert(`🎤 Error de Micrófono: ${event.error}\n\nDetalle: Verifica los permisos de audio en los ajustes de la App.`);
            }
        };

        this.recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    transcript = event.results[i][0].transcript.toLowerCase().trim();
                    this.processCommand(transcript);
                }
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                console.log("Re-activando mic automáticamente...");
                try { this.recognition.start(); } catch (e) { }
            }
        };
    }

    public start(callback: (data: any) => void) {
        this.onCommand = callback;
        this.isListening = true;
        try {
            this.recognition.start();
            console.log("🎤 Micrófono activo y escuchando...");
            this.speak("Sistema atento.");
        } catch (e) {
            console.error("❌ No se pudo iniciar el micrófono:", e);
        }

        if (!this.keepAliveAudio) {
            this.keepAliveAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            this.keepAliveAudio.loop = true;
            this.keepAliveAudio.volume = 0.01;
            this.keepAliveAudio.play().catch(() => { });
        }
    }

    public stop() {
        this.isListening = false;
        this.recognition.stop();
        if (this.keepAliveAudio) {
            this.keepAliveAudio.pause();
            this.keepAliveAudio = null;
        }
        this.speak("Apagado.");
    }

    private processCommand(transcript: string) {
        console.log("🎤 Analizando:", transcript);

        // 1. Limpieza de Hotword flexible
        let commandText = transcript;
        let foundHotword = false;

        for (const hw of this.hotwords) {
            if (transcript.includes(hw)) {
                commandText = transcript.replace(hw, '').trim();
                foundHotword = true;
                break;
            }
        }

        // Si no detectó hotword pero el comando es corto y claro, lo intentamos procesar igual
        // Esto ayuda si el árbitro se olvida de decir "Árbitro" pero la app lo escucha bien.
        const results = this.fuse.search(commandText);

        if (results.length > 0 && results[0].score < 0.4) {
            const commandId = results[0].item.id;

            const numbers = (commandText.match(/\d+/g) || []).map(n => parseInt(n));
            const dorsal = numbers.length > 0 ? numbers[0] : null;
            const dorsal2 = numbers.length > 1 ? numbers[1] : null;

            if (this.onCommand) {
                this.onCommand({
                    command: commandId,
                    dorsal: dorsal,
                    dorsal2: dorsal2,
                    original: transcript
                });
            }

            this.provideFeedback(commandId, dorsal);
        }
    }

    private provideFeedback(commandId: string, dorsal: number | null) {
        let text = "";
        const team = commandId.includes('local') ? 'local' : (commandId.includes('visitor') ? 'visitante' : '');

        switch (commandId) {
            case 'goal_local': text = "Gol local."; break;
            case 'goal_visitor': text = "Gol visitante."; break;
            case 'yellow_card_local':
            case 'yellow_card_visitor':
            case 'yellow_card':
                text = `Amarilla número ${dorsal || ''} ${team}`; break;
            case 'red_card_local':
            case 'red_card_visitor':
            case 'red_card':
                text = `Roja número ${dorsal || ''} ${team}`; break;
            case 'start_match': text = "Partido iniciado."; break;
            case 'finish_match': text = "Final."; break;
        }
        if (text) this.speak(text);
    }

    public speak(text: string) {
        if (!this.synthesis) return;
        this.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang;
        utterance.rate = 1.3; // Más rápido para ser menos molesto
        this.synthesis.speak(utterance);
    }
}

export const voiceReferee = new VoiceRefereeService();
