import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as jimp from "jimp";
import Fuse from "fuse.js";
import * as path from "path";

// Variables globales para reutilizar la carga
let faceapi: any;
let tf: any;
let modelsLoaded = false;

// Inicialización de Firebase
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const initializeIA = async () => {
    if (modelsLoaded) return;

    // ✅ LAZY LOADING: Cargamos esto solo cuando se necesita, no en el deploy
    faceapi = require("face-api.js");
    tf = require("@tensorflow/tfjs");

    // Mock del entorno para Node (sin Canvas real)
    faceapi.env.monkeyPatch({
        Canvas: class { } as any,
        Image: class { } as any,
        ImageData: class { } as any,
        createCanvasElement: () => ({} as any),
        createImageElement: () => ({} as any)
    });

    const modelPath = path.join(__dirname, "models");
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    modelsLoaded = true;
};

// ==========================================
// API DE VOZ PARA ÁRBITROS (Watch/Shortcuts)
// ==========================================

// Configuración de comandos (Duplicada del frontend para consistencia)
const COMMANDS = [
    { id: 'goal_local', keys: ['gol local', 'gol equipo a', 'gol del local', 'tanto local'] },
    { id: 'goal_visitor', keys: ['gol visitante', 'gol equipo b', 'gol del visitante', 'tanto visitante'] },
    { id: 'yellow_card', keys: ['tarjeta amarilla', 'amonestación', 'amarilla'] },
    { id: 'red_card', keys: ['tarjeta roja', 'roja', 'expulsión'] },
    { id: 'substitution', keys: ['cambio', 'sustitución', 'sale'] },
    { id: 'start_match', keys: ['iniciar partido', 'arrancar', 'comenzar', 'pitazo inicial'] },
    { id: 'halftime', keys: ['entretiempo', 'final primer tiempo', 'descanso', 'medio tiempo'] },
    { id: 'finish_match', keys: ['final del partido', 'terminar partido', 'fin del juego', 'finalizar'] }
];

const fuse = new Fuse(COMMANDS, { keys: ['keys'], threshold: 0.4, includeScore: true });

/**
 * Función que recibe comandos de voz (texto transcrito) desde Apple Watch / Android.
 * URL: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/apiRefereeVoice
 * Method: POST
 * Body: { "text": "Gol local", "matchId": "...", "key": "SECRET_KEY" }
 */
// Force Update
export const apiRefereeVoice = functions.https.onRequest(async (req, res) => {
    // 1. CORS Headers para permitir llamadas desde cualquier lado (Watch, web, etc)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const { text, matchId, secretKey } = req.body;

        // Validación básica de seguridad (en producción usar autenticación real)
        if (!text || !matchId) {
            res.status(400).json({ ok: false, message: "Faltan datos (text, matchId)" });
            return;
        }

        // TODO: Validar secretKey si se desea mayor seguridad simple

        console.log(`🎤 API Audio recibido para Match ${matchId}: "${text}"`);

        // 2. Procesamiento de Texto (NLP Básico)
        // Normalizar texto
        const transcript = text.toLowerCase().trim();

        // Buscar comando
        const results = fuse.search(transcript);

        if (results.length === 0 || results[0].score! > 0.4) {
            res.status(200).json({ ok: false, message: "No entendí la orden." });
            return;
        }

        const commandId = results[0].item.id;

        // Extraer dorsales
        const numbers = (transcript.match(/\d+/g) || []).map((n: string) => parseInt(n));
        const dorsal = numbers.length > 0 ? numbers[0] : null;
        const dorsal2 = numbers.length > 1 ? numbers[1] : null;

        console.log(`✅ Comando detectado: ${commandId}, Dorsales: ${numbers}`);

        // 3. Obtener el partido de Firestore
        const matchRef = admin.firestore().collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();

        if (!matchSnap.exists) {
            res.status(404).json({ ok: false, message: "Partido no encontrado" });
            return;
        }

        const matchData = matchSnap.data();

        // 4. Lógica de Negocio (Actualizar Firestore)
        // NOTA: Replicamos lógica simplificada del frontend. Lo ideal sería tener un módulo compartido.

        if (commandId === 'goal_local') {
            await matchRef.update({
                'score.a': admin.firestore.FieldValue.increment(1)
            });
            // TODO: Si hay dorsal, buscar jugador y sumarle gol
        }
        else if (commandId === 'goal_visitor') {
            await matchRef.update({
                'score.b': admin.firestore.FieldValue.increment(1)
            });
        }
        else if (commandId === 'start_match') {
            await matchRef.update({ status: 'live', startTime: Date.now() });
        }
        else if (commandId === 'finish_match') {
            await matchRef.update({ status: 'finished', endTime: Date.now() });
        }

        // Respuesta exitosa para el reloj
        res.status(200).json({
            ok: true,
            message: "Comando procesado",
            command: commandId,
            dorsal: dorsal
        });

    } catch (error: any) {
        console.error("Error en apiRefereeVoice:", error);
        res.status(500).json({ ok: false, message: "Error interno", error: error.message });
    }
});


// ==========================================
// FUNCIÓN EXISTENTE DE RECONOCIMIENTO FACIAL
// ==========================================

// ✅ OPTIMIZACIÓN: Rate limiting simple para prevenir abuso
let invocationCount = 0;
let resetTime = Date.now() + 3600000; // Reset cada hora

export const processFace = functions.runWith({
    memory: '1GB',  // ✅ VOLVEMOS A 1GB: Para dar más CPU y bajar esos 20s de espera
    timeoutSeconds: 60
}).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // ✅ OPTIMIZACIÓN: Verificar límite de invocaciones
    if (Date.now() > resetTime) {
        invocationCount = 0;
        resetTime = Date.now() + 3600000;
    }

    invocationCount++;
    const MAX_INVOCATIONS_PER_HOUR = 20000; // ~480k/día (suficiente para 2000 usuarios)

    if (invocationCount > MAX_INVOCATIONS_PER_HOUR) {
        console.warn(`⚠️ Límite de invocaciones excedido: ${invocationCount}`);
        res.status(429).json({
            success: false,
            error: 'Límite de solicitudes excedido. Intenta en unos minutos.'
        });
        return;
    }

    try {
        const { image } = req.body;
        if (!image) throw new Error("Imagen requerida");

        await initializeIA();

        // 1. Decodificamos la imagen con JIMP (100% JS, sin binarios nativos)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const jimpImage = await jimp.read(buffer);

        // 2. Convertimos JIMP a Tensor
        const { width, height, data } = jimpImage.bitmap;
        const tensor = tf.tidy(() => {
            const img = tf.tensor3d(data, [height, width, 4]); // RGBA
            return img.slice([0, 0, 0], [-1, -1, 3]); // Convertimos a RGB
        });

        // 3. Detectamos rostro usando el Tensor
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
        const result = await faceapi.detectSingleFace(tensor, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        tf.dispose(tensor);

        if (result) {
            res.json({ success: true, descriptor: Array.from(result.descriptor) });
        } else {
            res.json({ success: false, message: 'No se detectó rostro en el servidor' });
        }
    } catch (error: any) {
        console.error("Falla en Servidor:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
