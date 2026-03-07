/**
 * @file faceServiceLocal.ts
 * @description CLIENT-SIDE FACE RECOGNITION (FACE-API.JS)
 * Implementa el reconocimiento facial profundo usando TensorFlow.js en el cliente.
 * 
 * Funciones Principales:
 * 1. Carga de modelos neuronales (SSD Mobilenet V1, Landmarks, Recognition).
 * 2. Extracción de descriptores faciales (128 floats) de video e imágenes.
 * 3. Fallback inteligente de carga de modelos (Local -> Nube).
 */
import * as faceapi from 'face-api.js';

let modelsLoaded = false;

// ============================================================================
// 1. CARGA DE MODELOS (CLIENT-SIDE)
// ============================================================================
/**
 * Carga los modelos de reconocimiento facial en el cliente (navegador).
 * Utiliza Face-API.js sobre TensorFlow.js.
 * Implementa una estrategia de redundancia (fallback) para intentar cargar los modelos
 * desde múltiples fuentes (Nube o Local) si alguna falla.
 *
 * @returns {Promise<Object>} - Resultado de la carga {success: boolean, error?: string}
 */
export const loadModelsLocal = async () => {
    if (modelsLoaded) return { success: true };

    try {
        // Intentar backends en orden de rendimiento: WebGL > WASM > CPU
        const backends = ['webgl', 'wasm', 'cpu'];
        for (const backend of backends) {
            try {
                await faceapi.tf.setBackend(backend);
                await faceapi.tf.ready();
                break; // Éxito, salir del loop
            } catch (_e) {
                // Probar el siguiente
            }
        }
    } catch (e: any) {
        // Error configurando backend
    }

    /**
     * Función auxiliar para verificar y cargar.
     */
    const verifyAndLoad = async (baseUrl: string) => {
        // Normalizar URL (quitar barra al final si existe)
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const manifestUrl = `${cleanBase}/tiny_face_detector_model-weights_manifest.json`;


        try {
            // 1. Pre-vuelo con tiempo de espera corto
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(manifestUrl, {
                method: 'HEAD',
                signal: controller.signal
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (response && !response.ok && response.status !== 405) { // 405 Method Not Allowed es aceptable para HEAD
                throw new Error(`[HTTP ${response.status}]`);
            }

            // 2. Carga real de redes
            // Cargamos tanto Tiny como SSD para tener opciones
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(cleanBase),
                faceapi.nets.ssdMobilenetv1.loadFromUri(cleanBase),
                faceapi.nets.faceLandmark68Net.loadFromUri(cleanBase),
                faceapi.nets.faceRecognitionNet.loadFromUri(cleanBase)
            ]);

            return cleanBase;

        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            // Fallo en origen
            throw new Error(`${cleanBase}: ${detail}`);
        }
    };

    const origin = window.location.origin;
    const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    try {
        // Estrategia de carga multi-fuente
        await Promise.any([
            verifyAndLoad(`${base}/ai_models`),                          // 1. Local App Absoluto (Prioridad 1)
            verifyAndLoad('/ai_models'),                                 // 2. Local Web Relativo
            verifyAndLoad('https://adccbiometric.web.app/ai_models'),    // 3. Nube (Mirror)
            verifyAndLoad('ai_models')                                   // 4. Fallback final
        ]);

        modelsLoaded = true;
        return { success: true };
    } catch (aggregateError: any) {
        // FALLARON TODOS LOS ORÍGENES DE MODELOS

        let errorMsg = "Error crítico: No se pudieron cargar los modelos de IA.\nVerifica tu conexión a internet o los archivos del servidor.";

        return {
            success: false,
            error: errorMsg
        };
    }
};

// ============================================================================
// 2. PROCESAMIENTO FACIAL (VIDEO & IMAGEN)
// ============================================================================
/**
 * Procesa la imagen del video directamente en el navegador para obtener datos faciales.
 *
 * @param {HTMLVideoElement} videoElement - Elemento de video HTML5.
 * @returns {Promise<Object|null>} - Objeto con { descriptor, detection } o null si no hay rostro.
 */
export const getFaceDataLocal = async (videoElement: HTMLVideoElement | HTMLImageElement) => {
    if (!videoElement) return null;

    try {
        // 1. Usar exclusivamente SSD Mobilenet V1 (Máxima precisión)
        // Eliminamos TinyFaceDetector para evitar discrepancias entre registro y login.
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        const result = await faceapi.detectSingleFace(videoElement, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (result) {
            return {
                descriptor: result.descriptor,
                detection: result.detection // Contiene el cuadro (box) con width, height, etc. para validar calidad
            };
        }
        return null; // No se detectó rostro con SSD
    } catch (err) {
        // Error en detección local
        return null;
    }
};

/**
 * Wrapper simplificado para obtener solo el descriptor.
 */
export const getFaceDescriptorLocal = async (videoElement: HTMLVideoElement | HTMLImageElement) => {
    const data = await getFaceDataLocal(videoElement);
    return data ? data.descriptor : null;
};

/**
 * Procesa una imagen estática para obtener datos faciales.
 * @param {HTMLImageElement} imageElement 
 * @returns {Promise<Object|null>}
 */
export const getFaceDataFromImage = async (imageElement: HTMLImageElement) => {
    if (!imageElement) return null;
    try {
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        const result = await faceapi.detectSingleFace(imageElement, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (result) {
            return {
                descriptor: result.descriptor,
                detection: result.detection
            };
        }
        return null;
    } catch (err) {
        // Error en detección desde imagen
        return null;
    }
};

// ============================================================================
// 3. CROP-FIRST: RECORTE INTELIGENTE + RECONOCIMIENTO RÁPIDO
// ============================================================================

/**
 * Recorta el rostro detectado por MediaPipe en un canvas pequeño.
 * Reducir la resolución de entrada del modelo es la optimización principal.
 *
 * @param videoElement - El video element de react-webcam.
 * @param boundingBox  - El boundingBox retornado por MediaPipe (originX, originY, width, height).
 * @param paddingFactor - Cuánto margen añadir al recorte (0.35 = 35% extra alrededor).
 * @param outputSize   - Tamaño del canvas de salida en píxeles (por defecto 160x160).
 * @returns HTMLCanvasElement con solo la cara o null si falla.
 */
export const cropFaceFromVideo = (
    videoElement: HTMLVideoElement,
    boundingBox: { originX: number; originY: number; width: number; height: number },
    paddingFactor = 0.35,
    outputSize = 160
): HTMLCanvasElement | null => {
    try {
        const { originX, originY, width, height } = boundingBox;
        const vW = videoElement.videoWidth;
        const vH = videoElement.videoHeight;

        // Añadir margen proporcional al tamaño del rostro para incluir frente y mentón
        const pad = Math.max(width, height) * paddingFactor;
        const x = Math.max(0, originX - pad);
        const y = Math.max(0, originY - pad);
        const w = Math.min(width + pad * 2, vW - x);
        const h = Math.min(height + pad * 2, vH - y);

        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(videoElement, x, y, w, h, 0, 0, outputSize, outputSize);
        return canvas;
    } catch {
        return null;
    }
};

/**
 * Extrae un descriptor facial de un canvas PRE-RECORTADO.
 * La cara ya está aislada, así que usamos TinyFaceDetector primero (ultra-rápido).
 * Esto es hasta 6x más rápido que procesar el frame completo con SSD.
 *
 * @param croppedCanvas - Canvas con solo el rostro (ej. 160x160).
 * @returns Float32Array descriptor (128 floats) o null.
 */
export const getFaceDescriptorFromCrop = async (croppedCanvas: HTMLCanvasElement): Promise<Float32Array | null> => {
    if (!croppedCanvas) return null;
    try {
        // Intento 1: TinyFaceDetector — rápido, suficiente para imagen ya recortada
        const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.15 });
        let result = await faceapi.detectSingleFace(croppedCanvas, tinyOptions)
            .withFaceLandmarks(true)   // true = usar el modelo de 68 landmarks ligero
            .withFaceDescriptor();

        if (result) return result.descriptor;

        // Intento 2: SSD como fallback si Tiny no encontró nada
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 });
        result = await faceapi.detectSingleFace(croppedCanvas, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor() as any;

        return result ? result.descriptor : null;
    } catch {
        return null;
    }
};
