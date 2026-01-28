import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export const loadModelsLocal = async () => {
    if (modelsLoaded) return { success: true };

    try {
        console.log("🚀 Forzando motor GPU (WebGL)...");
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
        console.log("✅ Motor GPU activo:", faceapi.tf.getBackend());
    } catch (e) {
        console.warn("⚠️ No se pudo activar WebGL, usando motor por defecto:", e.message);
    }

    const verifyAndLoad = async (baseUrl) => {
        const manifestUrl = `${baseUrl}/tiny_face_detector_model-weights_manifest.json`;
        console.log(`🔍 Verificando acceso a: ${manifestUrl}`);

        try {
            // 1. Pre-check: Intentar fetch HEAD o simple GET del manifest
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(manifestUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Status ${response.status} (${response.statusText})`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error(`Detectado HTML en lugar de JSON. Posible 404 o página de login.`);
            }

            // Validar que sea JSON válido
            try {
                const clone = response.clone();
                await clone.json();
            } catch (jsonErr) {
                throw new Error(`El archivo no es un JSON válido.`);
            }

            console.log(`✅ Pre-check OK para ${baseUrl}. Cargando modelos...`);

            // 2. Carga real via Face-API
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
                faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
                faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl)
            ]);

            console.log(`🏆 CARGA EXITOSA desde: ${baseUrl}`);
            return baseUrl;

        } catch (error) {
            console.warn(`⚠️ Falló intento en ${baseUrl}: ${error.message}`);
            throw error; // Relanzar para que Promise.any lo descarte
        }
    };

    const origin = window.location.origin;
    const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    try {
        // Intentamos cargar desde múltiples fuentes en paralelo
        // El pre-check filtrará las respuestas HTML erróneas (como 404s personalizados)
        await Promise.any([
            verifyAndLoad('https://recofacial-7cea1.web.app/models'), // Nube (Prioridad)
            verifyAndLoad(`${base}/models`),                          // Local App Absoluto
            verifyAndLoad('/models'),                                 // Local Web Relativo
            verifyAndLoad('models')                                   // Local Fallback
        ]);

        modelsLoaded = true;
        return { success: true };
    } catch (aggregateError) {
        console.error("❌ TODOS LOS INTENTOS DE CARGA FALLARON", aggregateError);

        // Recopilar mensajes de error legibles
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
 * RECONOCIMIENTO LOCAL: Procesa la imagen directamente en el navegador
 * Retorna el descriptor y los datos de detección (para validar tamaño/distancia)
 */
export const getFaceDataLocal = async (videoElement) => {
    if (!videoElement) return null;

    try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

        const result = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (result) {
            return {
                descriptor: result.descriptor,
                detection: result.detection // Contiene el cuadro (box) con width, height, etc.
            };
        }
        return null;
    } catch (err) {
        console.error("Error en detección local:", err);
        return null;
    }
};

export const getFaceDescriptorLocal = async (videoElement) => {
    const data = await getFaceDataLocal(videoElement);
    return data ? data.descriptor : null;
};
