/**
 * @file hybridFaceService.ts
 * @description ORQUESTADOR CENTRAL — NUEVA ARQUITECTURA OPTIMIZADA
 *
 * Delega todo el procesamiento al FaceWorkerBridge (Worker off-thread).
 * Mantiene la API pública compatible con App.tsx y AltaLocal.tsx.
 *
 * Pipeline web optimizado:
 *   Main thread: captura frame → crea ImageBitmap → transfer al Worker
 *   Worker thread: MediaPipe detect → crop → TF.js WebGL embed → compare
 *   Main thread: recibe FaceResult (boundingBox + identity + ms)
 */
import { FaceWorkerBridge, FaceResult, BridgeStatus } from './faceWorkerBridge';

export type { FaceResult, BridgeStatus };

let isInitialized = false;

// ============================================================================
// 1. INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa el motor de reconocimiento facial.
 * Carga MediaPipe y FaceRecognitionNet en el Worker (WebGL backend).
 * Carga embeddings de IndexedDB en memoria del Worker.
 */
export const initHybridEngine = async (): Promise<{ success: boolean; error?: string; status?: BridgeStatus }> => {
    if (isInitialized) return { success: true };

    try {
        const status = await FaceWorkerBridge.init();
        isInitialized = status.mediapipe;
        return { success: isInitialized, status };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// ============================================================================
// 2. CAPTURA CONTINUA (API PRINCIPAL)
// ============================================================================

/**
 * Inicia el bucle de captura y reconocimiento facial.
 * Llama al callback en cada resultado disponible (~10fps de procesamiento).
 *
 * @param videoElement - El elemento <video> de la cámara
 * @param onResult     - Callback con el resultado por frame
 */
export const startFaceRecognition = (
    videoElement: HTMLVideoElement,
    onResult: (result: FaceResult) => void
): void => {
    FaceWorkerBridge.startCapture(videoElement, onResult);
};

/**
 * Detiene el bucle de captura.
 */
export const stopFaceRecognition = (): void => {
    FaceWorkerBridge.stopCapture();
};

// ============================================================================
// 3. COMPATIBILIDAD — APIs LEGACY (App.tsx / AltaLocal.tsx)
// ============================================================================

/**
 * @deprecated Usar startFaceRecognition() con el bucle de captura.
 * Mantenido para compatibilidad con componentes existentes.
 * Detecta un frame único e invoca el callback con el resultado.
 */
export const detectFaceMediaPipe = async (videoElement: HTMLVideoElement): Promise<FaceResult | null> => {
    return new Promise((resolve) => {
        if (!videoElement || videoElement.readyState < 2) {
            resolve(null);
            return;
        }
        // Captura un frame instantáneo usando createImageBitmap
        createImageBitmap(videoElement).then((bitmap) => {
            const tempWorkerMsg = (e: MessageEvent) => {
                if (e.data.type === 'FRAME_RESULT') {
                    resolve(e.data.payload as FaceResult);
                }
            };
            // Para uso legacy, iniciamos y detenemos el bridge temporalmente
            const oldCallback = (result: FaceResult) => resolve(result);
            FaceWorkerBridge.startCapture(videoElement, oldCallback);
            setTimeout(() => {
                FaceWorkerBridge.stopCapture();
            }, 500);
        }).catch(() => resolve(null));
    });
};

/**
 * Verifica la calidad del resultado de detección.
 * Ahora la calidad viene directamente en el FaceResult.status del Worker.
 *
 * @param result - FaceResult del Worker
 * @returns objeto de calidad compatible con la API anterior
 */
export const checkFaceQuality = (result: FaceResult | null, _video?: HTMLVideoElement) => {
    if (!result || !result.boundingBox) {
        return { ok: false, reason: 'No se detecta rostro', code: 'NO_FACE' };
    }
    if (result.status === 'TOO_FAR') {
        return { ok: false, reason: 'Acércate más a la cámara', code: 'DISTANCE_TOO_FAR' };
    }
    if (result.status === 'TOO_CLOSE') {
        return { ok: false, reason: 'Aléjate un poco', code: 'DISTANCE_TOO_CLOSE' };
    }
    return { ok: true, reason: 'Calidad Óptima', code: 'OK' };
};

// ============================================================================
// 4. GESTIÓN DE EMBEDDINGS
// ============================================================================

/**
 * Recarga los embeddings desde IndexedDB al Worker.
 * Llamar después de registrar un nuevo usuario.
 */
export const reloadEmbeddings = (): Promise<number> => {
    return FaceWorkerBridge.reloadEmbeddings();
};

/**
 * Obtiene el estado del sistema.
 */
export const getEngineStatus = (): BridgeStatus => {
    return FaceWorkerBridge.getStatus();
};

/**
 * Destruye el Worker y libera recursos.
 */
export const destroyHybridEngine = (): void => {
    FaceWorkerBridge.destroy();
    isInitialized = false;
};
