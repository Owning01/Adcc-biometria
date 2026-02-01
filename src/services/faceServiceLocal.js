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
        console.log(`🔍 Verificando acceso a modelos en: ${manifestUrl}`);

        try {
            // 1. Pre-check: Fetch simple para ver si el archivo existe y es accesible
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout de red

            const response = await fetch(manifestUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Status HTTP ${response.status} (${response.statusText})`);
            }

            // Verificamos que no nos devuelva una página HTML (común en errores 404 de SPA)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error(`Detectado HTML en lugar de JSON. Posible 404 o redirección.`);
            }

            // Validar que sea JSON válido
            try {
                const clone = response.clone();
                await clone.json();
            } catch (jsonErr) {
                throw new Error(`El archivo manifiesto no es un JSON válido.`);
            }

            console.log(`✅ Pre-check OK para ${baseUrl}. Iniciando carga de modelos...`);

            // 2. Carga real via Face-API
            // Cargamos: Detector ligero (Tiny), Puntos faciales (Landmark), Reconocimiento (Recognition)
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
                faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
                faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl)
            ]);

            console.log(`🏆 CARGA EXITOSA desde: ${baseUrl}`);
            return baseUrl;

        } catch (error) {
            console.warn(`⚠️ Falló intento de carga desde ${baseUrl}: ${error.message}`);
            throw error; // Relanzar para que Promise.any pruebe el siguiente
        }
    };

    const origin = window.location.origin;
    const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    try {
        // Intentamos cargar desde múltiples fuentes en paralelo hasta que una funcione (Promise.any)
        await Promise.any([
            verifyAndLoad('https://recofacial-7cea1.web.app/models'), // 1. Nube (Firebase Hosting) - Prioridad por velocidad/cache
            verifyAndLoad(`${base}/models`),                          // 2. Local App Absoluto
            verifyAndLoad('/models'),                                 // 3. Local Web Relativo
            verifyAndLoad('models')                                   // 4. Fallback final
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
