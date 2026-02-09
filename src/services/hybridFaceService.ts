/**
 * @file hybridFaceService.ts
 * @description ORQUESTADOR CENTRAL DE BIOMETRÍA
 * Este servicio actúa como puente entre:
 * 1. Detección Rápida (MediaPipe) - Para UI fluida y tracking.
 * 2. Reconocimiento Profundo (Face-API) - Para extracción de descriptores y matching seguro.
 */
import { loadModelsLocal, getFaceDataLocal } from './faceServiceLocal';
import { loadMediaPipeModels } from './mediapipeService';

let isInitialized = false;

// ============================================================================
// 1. INICIALIZACIÓN DEL MOTOR (PARALELO)
// ============================================================================
/**
 * Inicializa el motor híbrido de reconocimiento facial.
 * Combina la velocidad de MediaPipe para detección con la precisión de Face-API/TensorFlow para descriptores.
 * Carga ambos conjuntos de modelos en paralelo para reducir el tiempo de inicio.
 *
 * @returns {Promise<Object>} - Objeto con { success: true } o { success: false, error: string }
 */
export const initHybridEngine = async () => {
    if (isInitialized) return { success: true };

    try {
        console.log("🧬 Inicializando Motor Híbrido (Fast Sentinel + Deep Recognition)...");

        // Carga en paralelo para velocidad óptima de arranque
        const [faceApiResult, mediaPipeResult] = await Promise.all([
            loadModelsLocal(),      // Modelos pesados (reconocimiento)
            loadMediaPipeModels()   // Modelos ligeros (detección rápida)
        ]);

        if (faceApiResult.success && mediaPipeResult) {
            isInitialized = true;
            console.log("✅ Motor Híbrido listo para operar.");
            return { success: true };
        } else {
            throw new Error(faceApiResult.error || "Error al cargar motores de IA");
        }
    } catch (error) {
        console.error("❌ Fallo crítico en Motor Híbrido:", error);
        return { success: false, error: error.message };
    }
};

// ============================================================================
// 2. CONTROL DE CALIDAD Y DISTANCIA
// ============================================================================
/**
 * Evalúa la calidad de la detección facial en tiempo real para asegurar un buen registro/reconocimiento.
 * Verifica principalmente que el usuario esté a la distancia correcta.
 *
 * @param {Object} detection - El resultado de la detección (MediaPipe o FaceAPI).
 * @param {HTMLVideoElement} video - El elemento de video source para calcular proporciones.
 * @returns {Object} - { ok: boolean, reason: string, code: string, ratio: number }
 */
export const checkFaceQuality = (detection, video) => {
    if (!detection || !video) return { ok: false, reason: 'No se detecta rostro', code: 'NO_FACE' };

    const videoWidth = video.videoWidth;
    // Soporta estructura de datos tanto de FaceAPI (box) como de MediaPipe (boundingBox)
    const faceWidth = detection.box ? detection.box.width : (detection.boundingBox ? detection.boundingBox.width : 0);

    // Calcula qué porcentaje del ancho del video ocupa el rostro
    const faceRatio = faceWidth / videoWidth;

    // 1. Validación de Distancia Mínima (Lejania)
    // Si el rostro ocupa menos del 22% del ancho, está muy lejos y los pixels son insuficientes para un descriptor preciso.
    if (faceRatio < 0.22) {
        return { ok: false, reason: 'Acércate más a la cámara', code: 'DISTANCE_TOO_FAR', ratio: faceRatio };
    }

    // 2. Validación de Distancia Máxima (Cercanía)
    // Si ocupa más del 60%, puede estar deformado por la lente (fisheye effect) o cortado.
    if (faceRatio > 0.60) {
        return { ok: false, reason: 'Aléjate un poco', code: 'DISTANCE_TOO_CLOSE', ratio: faceRatio };
    }

    // 3. Validación de Centrado (Futura implementación)
    // Es ideal que el rostro esté en el centro geométrico del frame.

    return { ok: true, reason: 'Calidad Óptima', code: 'OK', ratio: faceRatio };
};
