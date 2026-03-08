/**
 * @file face.worker.ts
 * @description WORKER BIOMÉTRICO OPTIMIZADO — PIPELINE COMPLETO OFF-THREAD
 *
 * Pipeline:
 *   ImageBitmap (zero-copy transfer)
 *   → MediaPipe FaceDetector (BlazeFace — detección ultrarrápida)
 *   → OffscreenCanvas crop 160×160
 *   → TF.js WebGL + faceRecognitionNet (embedding 128-D)
 *   → Cosine similarity vs. embeddings en memoria
 *   → Resultado tipado + latencia en ms
 *
 * IMPORTANTE: Este worker NO toca el DOM. Todo procesamiento de imagen
 * usa OffscreenCanvas para evitar cualquier bloqueo del main thread.
 */

// ============================================================
// TIPOS
// ============================================================

interface KnownEmbedding {
    userId: string;
    name: string;
    descriptor: number[];
}

interface FrameResult {
    boundingBox: { originX: number; originY: number; width: number; height: number } | null;
    identity: string | null;
    userId: string | null;
    confidence: number;
    ms: number;
    status: 'NO_FACE' | 'TOO_FAR' | 'TOO_CLOSE' | 'OK' | 'IDENTIFIED' | 'UNKNOWN';
}

// ============================================================
// ESTADO INTERNO DEL WORKER
// ============================================================

let faceDetector: any = null;          // MediaPipe FaceDetector
let faceApiLoaded = false;             // TF.js + faceRecognitionNet
let knownEmbeddings: KnownEmbedding[] = [];
let frameCanvas: OffscreenCanvas | null = null;
let cropCanvas: OffscreenCanvas | null = null;
let lastFrameMs = 0;
let isProcessing = false;

const DETECTION_THROTTLE_MS = 50;  // mínimo ms entre frames procesados
const RECOGNITION_THROTTLE_MS = 300; // ms entre inferencias de embedding
let lastRecognitionMs = 0;

// ============================================================
// 1. INICIALIZACIÓN DE MEDIAPIPE (DENTRO DEL WORKER)
// ============================================================

const initMediaPipe = async (): Promise<boolean> => {
    if (faceDetector) return true;
    try {
        const { FilesetResolver, FaceDetector } = await import(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/+esm'
        ) as any;

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        );

        faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                delegate: 'GPU'
            },
            runningMode: 'IMAGE',
            minDetectionConfidence: 0.5
        });

        frameCanvas = new OffscreenCanvas(320, 240);
        cropCanvas = new OffscreenCanvas(160, 160);
        return true;
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', error: `MediaPipe init: ${err.message}` });
        return false;
    }
};

// ============================================================
// 2. INICIALIZACIÓN DE FACE-API (TF.js + WebGL)
// ============================================================

const initFaceApi = async (): Promise<boolean> => {
    if (faceApiLoaded) return true;
    try {
        // Importar TF.js con backend WebGL
        const tf = await import('@tensorflow/tfjs') as any;
        await tf.setBackend('webgl');
        await tf.ready();

        // Importar face-api después de tener TF listo
        const faceapi = await import('face-api.js') as any;

        // Cargar SOLO faceRecognitionNet (128-D embeddings, compatible con base de datos actual)
        const modelBase = 'https://adccbiometric.web.app/ai_models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelBase);

        // Guardar referencia global para uso en detectFace
        (self as any).__faceapi = faceapi;

        faceApiLoaded = true;
        return true;
    } catch (err: any) {
        // Fallback a /ai_models local
        try {
            const faceapi = await import('face-api.js') as any;
            await faceapi.nets.tinyFaceDetector.loadFromUri('/ai_models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/ai_models');
            (self as any).__faceapi = faceapi;
            faceApiLoaded = true;
            return true;
        } catch (e2: any) {
            self.postMessage({ type: 'ERROR', error: `FaceAPI init: ${e2.message}` });
            return false;
        }
    }
};

// ============================================================
// 3. UTILIDADES DE IMAGEN
// ============================================================

/**
 * Dibuja un ImageBitmap en el OffscreenCanvas de frames (320×240)
 * retornando el contexto listo para operar — sin copia adicional.
 */
const drawToFrameCanvas = (bitmap: ImageBitmap): OffscreenCanvasRenderingContext2D | null => {
    if (!frameCanvas) return null;
    frameCanvas.width = bitmap.width;
    frameCanvas.height = bitmap.height;
    const ctx = frameCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0);
    return ctx;
};

/**
 * Recorta el rostro del frameCanvas y lo escala a 160×160 en cropCanvas.
 * Añade 30% de padding para incluir frente y mentón.
 */
const cropFace = (
    box: { originX: number; originY: number; width: number; height: number },
    frameW: number,
    frameH: number
): OffscreenCanvas | null => {
    if (!cropCanvas || !frameCanvas) return null;

    const pad = Math.max(box.width, box.height) * 0.30;
    const x = Math.max(0, box.originX - pad);
    const y = Math.max(0, box.originY - pad);
    const side = Math.min(box.width + pad * 2, box.height + pad * 2);
    const w = Math.min(side, frameW - x);
    const h = Math.min(side, frameH - y);

    cropCanvas.width = 160;
    cropCanvas.height = 160;
    const ctx = cropCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(frameCanvas, x, y, w, h, 0, 0, 160, 160);
    return cropCanvas;
};

// ============================================================
// 4. SIMILITUD COSENO
// ============================================================

const cosineSimilarity = (a: Float32Array | number[], b: Float32Array | number[]): number => {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ============================================================
// 5. DETECCIÓN DE CALIDAD
// ============================================================

const checkQuality = (
    box: { originX: number; originY: number; width: number; height: number },
    frameW: number
): 'TOO_FAR' | 'TOO_CLOSE' | 'OK' => {
    const ratio = box.width / frameW;
    if (ratio < 0.20) return 'TOO_FAR';
    if (ratio > 0.65) return 'TOO_CLOSE';
    return 'OK';
};

// ============================================================
// 6. PIPELINE PRINCIPAL
// ============================================================

const processFrame = async (bitmap: ImageBitmap): Promise<FrameResult> => {
    const t0 = performance.now();

    // Throttle de frames
    if (t0 - lastFrameMs < DETECTION_THROTTLE_MS) {
        bitmap.close();
        return { boundingBox: null, identity: null, userId: null, confidence: 0, ms: 0, status: 'NO_FACE' };
    }
    lastFrameMs = t0;

    // Dibujar en OffscreenCanvas
    drawToFrameCanvas(bitmap);
    const frameW = bitmap.width;
    const frameH = bitmap.height;
    bitmap.close(); // liberar memoria inmediatamente

    // -- DETECCIÓN RÁPIDA (MediaPipe) --
    if (!faceDetector) {
        return { boundingBox: null, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'NO_FACE' };
    }

    let detection: any = null;
    try {
        const result = faceDetector.detect(frameCanvas);
        if (result.detections && result.detections.length > 0) {
            detection = result.detections[0];
        }
    } catch (_) {
        return { boundingBox: null, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'NO_FACE' };
    }

    if (!detection) {
        return { boundingBox: null, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'NO_FACE' };
    }

    const box = detection.boundingBox;
    const quality = checkQuality(box, frameW);
    if (quality !== 'OK') {
        return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: quality };
    }

    // -- EMBEDDING (throttled, solo si hay calidad y modelos listos) --
    const now = performance.now();
    if (!faceApiLoaded || (now - lastRecognitionMs < RECOGNITION_THROTTLE_MS)) {
        return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: now - t0, status: 'OK' };
    }
    lastRecognitionMs = now;

    // Crop del rostro
    const faceCanvas = cropFace(box, frameW, frameH);
    if (!faceCanvas) {
        return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'OK' };
    }

    try {
        const faceapi = (self as any).__faceapi;
        const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.15 });
        const faceResult = await faceapi.detectSingleFace(faceCanvas, tinyOptions)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        if (!faceResult) {
            return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'OK' };
        }

        const descriptor = faceResult.descriptor;

        // Comparar con embeddings conocidos
        if (knownEmbeddings.length === 0) {
            return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'OK' };
        }

        let bestScore = -1;
        let bestMatch: KnownEmbedding | null = null;

        for (const known of knownEmbeddings) {
            const score = cosineSimilarity(descriptor, known.descriptor);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = known;
            }
        }

        const THRESHOLD = 0.65; // Umbral de identificación (cosine similarity)
        const ms = performance.now() - t0;

        if (bestScore >= THRESHOLD && bestMatch) {
            return {
                boundingBox: box,
                identity: bestMatch.name,
                userId: bestMatch.userId,
                confidence: bestScore,
                ms,
                status: 'IDENTIFIED'
            };
        } else {
            return {
                boundingBox: box,
                identity: null,
                userId: null,
                confidence: bestScore,
                ms,
                status: 'UNKNOWN'
            };
        }
    } catch (err: any) {
        return { boundingBox: box, identity: null, userId: null, confidence: 0, ms: performance.now() - t0, status: 'OK' };
    }
};

// ============================================================
// 7. MANEJADOR DE MENSAJES
// ============================================================

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    // -- INIT: cargar modelos en paralelo --
    if (type === 'INIT') {
        const [mpOk, faOk] = await Promise.all([initMediaPipe(), initFaceApi()]);
        self.postMessage({
            type: 'INIT_RESULT',
            payload: { mediapipe: mpOk, faceapi: faOk }
        });
        return;
    }

    // -- LOAD_EMBEDDINGS: cargar base de datos de identidades --
    if (type === 'LOAD_EMBEDDINGS') {
        knownEmbeddings = payload as KnownEmbedding[];
        self.postMessage({ type: 'EMBEDDINGS_LOADED', payload: { count: knownEmbeddings.length } });
        return;
    }

    // -- PROCESS_FRAME: procesar frame de video --
    if (type === 'PROCESS_FRAME') {
        if (isProcessing) {
            // Descartar frame si el anterior no terminó (backpressure)
            if (payload?.bitmap) {
                (payload.bitmap as ImageBitmap).close?.();
            }
            return;
        }
        isProcessing = true;
        try {
            const result = await processFrame(payload.bitmap as ImageBitmap);
            self.postMessage({ type: 'FRAME_RESULT', payload: result });
        } finally {
            isProcessing = false;
        }
        return;
    }

    // -- SET_THRESHOLD: ajustar umbral de reconocimiento --
    if (type === 'SET_CONFIG') {
        if (typeof payload?.recognitionThrottleMs === 'number') {
            (self as any).__recognitionThrottle = payload.recognitionThrottleMs;
        }
        return;
    }
};
