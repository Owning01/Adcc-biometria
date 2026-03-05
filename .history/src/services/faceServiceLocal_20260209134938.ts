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
        console.log("🚀 Iniciando carga de modelos Face-API...");

        // Intentar activar WebGL si está disponible para aceleración
        try {
            await faceapi.tf.setBackend('webgl');
            await faceapi.tf.ready();
            console.log("✅ Motor GPU (WebGL) activo:", faceapi.tf.getBackend());
        } catch (e: any) {
            console.warn("⚠️ WebGL no disponible, usando CPU:", e.message);
            await faceapi.tf.setBackend('cpu');
        }
    } catch (e: any) {
        console.warn("⚠️ Error configurando backend:", e.message);
    }

    /**
     * Función auxiliar para verificar y cargar.
     */
    const verifyAndLoad = async (baseUrl: string) => {
        // Normalizar URL (quitar barra al final si existe)
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const manifestUrl = `${cleanBase}/tiny_face_detector_model-weights_manifest.json`;

        console.log(`🔍 Intentando desde: ${cleanBase}`);

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

            console.log(`🏆 CARGA EXITOSA desde: ${cleanBase}`);
            return cleanBase;

        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`❌ Fallo en ${cleanBase}: ${detail}`);
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
        console.error("❌ FALLARON TODOS LOS ORÍGENES DE MODELOS:", aggregateError);

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
        // 1. Intentar con SSD Mobilenet V1 (Máxima precisión para login)
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        let result = await faceapi.detectSingleFace(videoElement, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        // 2. Fallback a Tiny Face Detector si falla el primero
        if (!result) {
            console.log("🔄 Reintentando con TinyFaceDetector...");
            const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
            result = await faceapi.detectSingleFace(videoElement, tinyOptions)
                .withFaceLandmarks()
                .withFaceDescriptor();
        }

        if (result) {
            return {
                descriptor: result.descriptor,
                detection: result.detection // Contiene el cuadro (box) con width, height, etc. para validar calidad
            };
        }
        return null; // No se detectó rostro
    } catch (err) {
        console.error("Error en detección local:", err);
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
        let result = await faceapi.detectSingleFace(imageElement, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!result) {
            const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
            result = await faceapi.detectSingleFace(imageElement, tinyOptions)
                .withFaceLandmarks()
                .withFaceDescriptor();
        }

        if (result) {
            return {
                descriptor: result.descriptor,
                detection: result.detection
            };
        }
        return null;
    } catch (err) {
        console.error("Error en detección desde imagen:", err);
        return null;
    }
};
