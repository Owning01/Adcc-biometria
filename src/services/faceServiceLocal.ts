import * as faceapi from 'face-api.js';

let modelsLoaded = false;

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
        console.log("🚀 Forzando motor GPU (WebGL) para Face-API...");
        // Configura el backend de TensorFlow para usar aceleración por hardware (WebGL)
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
        console.log("✅ Motor GPU activo:", faceapi.tf.getBackend());
    } catch (e) {
        console.warn("⚠️ No se pudo activar WebGL, usando motor por defecto (CPU o WASM):", e.message);
    }

    /**
     * Función auxiliar para verificar si existe el archivo de modelos via HTTP antes de intentar cargarlo.
     * Esto evita errores internos de Face-API difíciles de capturar.
     */
    const verifyAndLoad = async (baseUrl) => {
        const manifestUrl = `${baseUrl}/tiny_face_detector_model-weights_manifest.json`;
        console.log(`🔍 Verificando modelos en: ${manifestUrl}`);

        try {
            // 1. Diagnóstico de Red
            const response = await fetch(manifestUrl, { method: 'HEAD' });

            if (!response.ok) {
                throw new Error(`[HTTP ${response.status}] No accesible`);
            }

            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');

            if (contentType && contentType.includes('text/html')) {
                throw new Error(`[MIME Error] Se recibió HTML en lugar de JSON. Posible 404 SPA.`);
            }

            // 2. Carga real
            console.log(`✅ Pre-check OK (${contentLength || '?'} bytes). Cargando...`);

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
                faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
                faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl)
            ]);

            console.log(`🏆 CARGA EXITOSA desde: ${baseUrl}`);
            return baseUrl;

        } catch (error) {
            // Error detallado para el reporte final
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️ Fallo ${baseUrl}: ${detail}`);
            throw new Error(`${baseUrl}: ${detail}`);
        }
    };

    const origin = window.location.origin;
    const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    try {
        // Intentamos cargar desde múltiples fuentes en paralelo hasta que una funcione (Promise.any)
        await Promise.any([
            // Estrategia de Cache Busting: Usamos 'ai_models' en lugar de 'models'
            verifyAndLoad('https://adccbiometric.web.app/ai_models'),    // 1. Nube (URL Correcta)
            verifyAndLoad(`${base}/ai_models`),                          // 2. Local App Absoluto
            verifyAndLoad('/ai_models'),                                 // 3. Local Web Relativo
            verifyAndLoad('ai_models')                                   // 4. Fallback final
        ]);

        modelsLoaded = true;
        return { success: true };
    } catch (aggregateError) {
        console.error("❌ TODOS LOS INTENTOS DE CARGA FALLARON", aggregateError);

        // Generar reporte de error detallado
        let errorMsg = "No se pudieron cargar los modelos de IA.\n";
        if (aggregateError.errors) {
            aggregateError.errors.forEach((e, i) => {
                errorMsg += `\nFuente ${i + 1}: ${e.message}`;
            });
        } else {
            errorMsg += aggregateError.message;
        }

        return {
            success: false,
            error: errorMsg
        };
    }
};

/**
 * Procesa la imagen del video directamente en el navegador para obtener datos faciales.
 * 
 * @param {HTMLVideoElement} videoElement - Elemento de video HTML5.
 * @returns {Promise<Object|null>} - Objeto con { descriptor, detection } o null si no hay rostro.
 */
export const getFaceDataLocal = async (videoElement) => {
    if (!videoElement) return null;

    try {
        // Opciones optimizadas para velocidad: inputSize pequeño (320px)
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

        // Detección + Puntos Faciales + Descriptor (Vector de 128 floats)
        const result = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

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
export const getFaceDescriptorLocal = async (videoElement) => {
    const data = await getFaceDataLocal(videoElement);
    return data ? data.descriptor : null;
};

/**
 * Procesa una imagen estática para obtener datos faciales.
 * @param {HTMLImageElement} imageElement 
 * @returns {Promise<Object|null>}
 */
export const getFaceDataFromImage = async (imageElement) => {
    if (!imageElement) return null;
    try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
        const result = await faceapi.detectSingleFace(imageElement, options)
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
        console.error("Error en detección desde imagen:", err);
        return null;
    }
};
