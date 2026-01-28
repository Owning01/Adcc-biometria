import { loadModelsLocal, getFaceDataLocal } from './faceServiceLocal';
import { loadMediaPipeModels } from './mediapipeService';

let isInitialized = false;

/**
 * Inicializa ambos motores de IA (Face-API y MediaPipe)
 */
export const initHybridEngine = async () => {
    if (isInitialized) return { success: true };

    try {
        console.log("🧬 Inicializando Motor Híbrido (Fast Sentinel + Deep Recognition)...");

        // Carga en paralelo para velocidad
        const [faceApiResult, mediaPipeResult] = await Promise.all([
            loadModelsLocal(),
            loadMediaPipeModels()
        ]);

        if (faceApiResult.success && mediaPipeResult) {
            isInitialized = true;
            return { success: true };
        } else {
            throw new Error(faceApiResult.error || "Error al cargar motores de IA");
        }
    } catch (error) {
        console.error("❌ Fallo crítico en Motor Híbrido:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Evalúa la calidad del rostro usando parámetros de MediaPipe o Face-API
 * @param {Object} detection - El cuadro de detección
 * @param {HTMLVideoElement} video - El elemento de video
 */
export const checkFaceQuality = (detection, video) => {
    if (!detection || !video) return { ok: false, reason: 'No face' };

    const videoWidth = video.videoWidth;
    const faceWidth = detection.box ? detection.box.width : (detection.boundingBox ? detection.boundingBox.width : 0);
    const faceRatio = faceWidth / videoWidth;

    // 1. Validación de Distancia (Ratio del rostro en pantalla)
    if (faceRatio < 0.22) {
        return { ok: false, reason: 'Muy lejos', code: 'DISTANCE_TOO_FAR' };
    }
    if (faceRatio > 0.60) {
        return { ok: false, reason: 'Muy cerca', code: 'DISTANCE_TOO_CLOSE' };
    }

    // 2. Validación de Centrado (Opcional pero recomendado para precisión)
    // Podríamos añadir lógica aquí para verificar si el rostro está en el "sweet spot"

    return { ok: true, ratio: faceRatio };
};
