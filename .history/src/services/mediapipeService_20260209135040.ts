/**
 * @file mediapipeService.ts
 * @description SERVICIO DE VISIÓN RÁPIDA (CLIENT-SIDE)
 * Implementa Google MediaPipe Tasks-Vision para:
 * 1. Detección de rostros ultra-rápida (BlazeFace Short Range).
 * 2. Cálculo de Embeddings ligeros (MobileNet V3) - Opcional, actualmente usamos Face-API para esto.
 * 
 * Este servicio corre 100% en el navegador usando WASM y WebGL/GPU.
 */
import { FilesetResolver, ImageEmbedder, FaceDetector } from '@mediapipe/tasks-vision';

let faceEmbedder = null;
let faceDetector = null;
let offscreenCanvas = null;

// ============================================================================
// 1. INICIALIZACIÓN DE MODELOS
// ============================================================================
/**
 * Inicializa los modelos de visión de Google MediaPipe.
 * Carga el detector de rostros (BlazeFace) y el generador de embeddings (MobileNet V3)
 * para realizar reconocimiento facial rápido y ligero en el navegador.
 * Intenta delegar el procesamiento a la GPU para máximo rendimiento.
 *
 * @returns {Promise<boolean>} - True si la carga fue exitosa.
 */
export const loadMediaPipeModels = async () => {
    if (faceEmbedder && faceDetector) return true;
    try {
        console.log("Iniciando carga de MediaPipe V2 (Detector + Embedder)...");
        // Cargar binarios WASM para el runtime de visión
        const visionHost = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
        const vision = await FilesetResolver.forVisionTasks(visionHost);

        // URLs de los modelos tflite optimizados para borde (edge devices)
        const embedderUrl = "https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite";
        const detectorUrl = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

        // Cargar Detector primero
        faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: detectorUrl, delegate: "GPU" },
            runningMode: "VIDEO"
        });

        // Cargar Embedder
        faceEmbedder = await ImageEmbedder.createFromOptions(vision, {
            baseOptions: { modelAssetPath: embedderUrl, delegate: "GPU" },
            runningMode: "VIDEO"
        });

        offscreenCanvas = document.createElement('canvas');
        console.log("✅ MediaPipe V2 Listo (High Precision)");
        return true;
    } catch (error) {
        console.error("❌ Error crítico cargando MediaPipe:", error);
        throw error;
    }
};

// ============================================================================
// 2. GENERACIÓN DE VECTORES (EMBEDDINGS)
// ============================================================================
/**
 * Genera un vector numérico (embedding) único para el rostro detectado en el video.
 * Recorta y centra el rostro antes de procesarlo para mejorar la precisión.
 *
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<Float32Array|null>} - Vector de características del rostro.
 */
export const getMediaPipeEmbedding = async (videoElement) => {
    if (!faceEmbedder || !faceDetector) {
        await loadMediaPipeModels();
    }

    try {
        const timestamp = performance.now();
        // 1. Detectar rostro primero para recortar la región de interés (ROI)
        const detectionResult = faceDetector.detectForVideo(videoElement, timestamp);

        if (detectionResult.detections && detectionResult.detections.length > 0) {
            const face = detectionResult.detections[0];
            const { originX, originY, width, height } = face.boundingBox;

            // --- MEJORA: Padding y Cuadrado ---
            // Añadimos un 30% de margen alrededor del rostro para incluir contexto (pelo, orejas)
            const padding = 0.3;
            const size = Math.max(width, height) * (1 + padding);

            // Centrar el nuevo cuadro
            let startX = originX - (size - width) / 2;
            let startY = originY - (size - height) / 2;

            // Validar límites para no salirnos de la imagen
            startX = Math.max(0, startX);
            startY = Math.max(0, startY);
            const drawW = Math.min(size, videoElement.videoWidth - startX);
            const drawH = Math.min(size, videoElement.videoHeight - startY);

            // 2. Recortar rostro usando canvas offscreen
            // Normalizamos a 224x224 que es la entrada estándar de MobileNet
            offscreenCanvas.width = 224;
            offscreenCanvas.height = 224;
            const ctx = offscreenCanvas.getContext('2d');

            // Limpiar canvas antes de dibujar
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 224, 224);

            // Dibujar la subregión centrada y cuadrada
            ctx.drawImage(
                videoElement,
                startX, startY, drawW, drawH,
                0, 0, 224, 224
            );

            // 3. Obtener embedding SOLO de la cara recortada y normalizada
            const result = faceEmbedder.embedForVideo(offscreenCanvas, timestamp);
            if (result.embeddings && result.embeddings.length > 0) {
                return result.embeddings[0].floatEmbedding;
            }
        }
    } catch (error) {
        console.error("Error en pipeline MediaPipe:", error);
    }
    return null;
};

/**
 * Calcula la similitud coseno entre dos vectores (embeddings).
 * Retorna un valor entre -1 y 1 (donde 1 es idéntico).
 */
export const cosineSimilarity = (vecA, vecB) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ============================================================================
// 3. DETECCIÓN RÁPIDA (SOLO POSICIONAMIENTO)
// ============================================================================
/**
 * Detecta rostros de forma ultra-rápida (sólo coordenadas, sin embedding).
 * Usado para dibujar el recuadro verde/rojo en tiempo real en la UI.
 *
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<Object|null>}
 */
export const detectFaceMediaPipe = async (videoElement) => {
    if (!faceDetector) {
        await loadMediaPipeModels();
    }
    try {
        const timestamp = performance.now();
        const result = faceDetector.detectForVideo(videoElement, timestamp);
        if (result.detections && result.detections.length > 0) {
            return result.detections[0]; // Retornamos la detección más prominente (mayor confianza)
        }
    } catch (error) {
        console.error("Error en detección rápida MediaPipe:", error);
    }
    return null;
};
