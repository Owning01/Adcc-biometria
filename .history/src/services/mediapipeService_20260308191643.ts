/**
 * @file mediapipeService.ts
 * @description UTILIDADES MEDIAPIPE — SOLO FUNCIONES PURAS
 *
 * NOTA ARQUITECTÓNICA:
 * La inicialización de MediaPipe y toda la detección ahora corren
 * DENTRO del face.worker.ts (off-thread, OffscreenCanvas).
 *
 * Este archivo mantiene solo funciones matemáticas puras que
 * pueden ser útiles en el main thread (sin dependencias pesadas).
 */

// ============================================================
// SIMILITUD COSENO (UTILIDAD PURA)
// ============================================================

/**
 * Calcula la similitud coseno entre dos vectores de embeddings.
 * Retorna un valor entre -1 y 1 (donde 1 = idéntico, 0 = sin relación).
 */
export const cosineSimilarity = (vecA: Float32Array | number[], vecB: Float32Array | number[]): number => {
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

/**
 * Calcula la distancia euclidiana entre dos vectores (alternativa al coseno).
 * Face-API usa distancia euclidiana internamente (umbral ~0.6).
 */
export const euclideanDistance = (a: Float32Array | number[], b: Float32Array | number[]): number => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
};

/**
 * Convierte distancia euclidiana a similitud normalizada [0, 1].
 * Útil para mostrar porcentajes de confianza en la UI.
 */
export const distanceToConfidence = (distance: number, maxDistance = 1.0): number => {
    return Math.max(0, 1 - distance / maxDistance);
};
