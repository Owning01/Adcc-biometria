const functions = require("firebase-functions");
const admin = require("firebase-admin");
const jimp = require("jimp");

// Variables globales para reutilizar la carga
let faceapi;
let tf;
let modelsLoaded = false;

const initializeIA = async () => {
    if (modelsLoaded) return;

    // ✅ LAZY LOADING: Cargamos esto solo cuando se necesita, no en el deploy
    faceapi = require("face-api.js");
    tf = require("@tensorflow/tfjs");
    const path = require("path");

    // Mock del entorno para Node (sin Canvas real)
    faceapi.env.monkeyPatch({
        Canvas: class { },
        Image: class { },
        ImageData: class { },
        createCanvasElement: () => ({}),
        createImageElement: () => ({})
    });

    const modelPath = path.join(__dirname, "models");
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    modelsLoaded = true;
};

admin.initializeApp();

// ✅ OPTIMIZACIÓN: Rate limiting simple para prevenir abuso
let invocationCount = 0;
let resetTime = Date.now() + 3600000; // Reset cada hora

exports.processFace = functions.runWith({
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
        return res.status(429).json({
            success: false,
            error: 'Límite de solicitudes excedido. Intenta en unos minutos.'
        });
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
    } catch (error) {
        console.error("Falla en Servidor:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
