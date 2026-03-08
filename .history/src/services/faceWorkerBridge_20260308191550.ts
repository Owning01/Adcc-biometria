/**
 * @file faceWorkerBridge.ts
 * @description BRIDGE PRINCIPAL — COMUNICACIÓN MAIN THREAD ↔ WORKER BIOMÉTRICO
 *
 * Responsabilidades:
 * - Gestionar ciclo de vida del Worker (instanciar, destruir, reiniciar)
 * - Capturar frames del video y enviarlos al worker via ImageBitmap (zero-copy)
 * - Cargar embeddings de IndexedDB al iniciar y mantenerlos en worker
 * - Exponer API pública simple para la UI
 * - Throttling de frames configurable
 */
import type { User } from 'firebase/auth';

// ============================================================
// TIPOS
// ============================================================

export interface FaceResult {
    boundingBox: {
        originX: number;
        originY: number;
        width: number;
        height: number;
    } | null;
    identity: string | null;
    userId: string | null;
    confidence: number;
    ms: number;
    status: 'NO_FACE' | 'TOO_FAR' | 'TOO_CLOSE' | 'OK' | 'IDENTIFIED' | 'UNKNOWN';
}

export interface BridgeStatus {
    mediapipe: boolean;
    faceapi: boolean;
    embeddingsLoaded: number;
    ready: boolean;
}

type ResultCallback = (result: FaceResult) => void;

// ============================================================
// INDEXEDDB — CARGA DE EMBEDDINGS
// ============================================================

const IDBNAME = 'FaceEmbeddingsDB';
const IDBSTORE = 'embeddings';

interface StoredEmbedding {
    userId: string;
    name: string;
    descriptor: number[];
}

const loadEmbeddingsFromIDB = (): Promise<StoredEmbedding[]> => {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDBNAME, 1);
            req.onupgradeneeded = (e: any) => {
                const db = e.target.result as IDBDatabase;
                if (!db.objectStoreNames.contains(IDBSTORE)) {
                    db.createObjectStore(IDBSTORE, { keyPath: 'userId' });
                }
            };
            req.onsuccess = (e: any) => {
                const db = e.target.result as IDBDatabase;
                const tx = db.transaction(IDBSTORE, 'readonly');
                const store = tx.objectStore(IDBSTORE);
                const all = store.getAll();
                all.onsuccess = () => resolve(all.result as StoredEmbedding[]);
                all.onerror = () => resolve([]);
            };
            req.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });
};

export const saveEmbeddingToIDB = (embedding: StoredEmbedding): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(IDBNAME, 1);
            req.onsuccess = (e: any) => {
                const db = e.target.result as IDBDatabase;
                const tx = db.transaction(IDBSTORE, 'readwrite');
                tx.objectStore(IDBSTORE).put(embedding);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        } catch (err) {
            reject(err);
        }
    });
};

export const clearEmbeddingsIDB = (): Promise<void> => {
    return new Promise((resolve) => {
        const req = indexedDB.open(IDBNAME, 1);
        req.onsuccess = (e: any) => {
            const db = e.target.result as IDBDatabase;
            const tx = db.transaction(IDBSTORE, 'readwrite');
            tx.objectStore(IDBSTORE).clear();
            tx.oncomplete = () => resolve();
        };
        req.onerror = () => resolve();
    });
};

// ============================================================
// FACE WORKER BRIDGE — SINGLETON
// ============================================================

class FaceWorkerBridgeClass {
    private worker: Worker | null = null;
    private status: BridgeStatus = { mediapipe: false, faceapi: false, embeddingsLoaded: 0, ready: false };
    private onResult: ResultCallback | null = null;
    private animFrameId: number | null = null;
    private videoRef: HTMLVideoElement | null = null;
    private lastSentMs = 0;
    private frameThrottleMs = 100; // Enviar un frame cada 100ms máximo (10fps de procesamiento)

    // ============================================================
    // INIT
    // ============================================================

    async init(): Promise<BridgeStatus> {
        if (this.status.ready) return this.status;

        return new Promise(async (resolve) => {
            // Crear Worker usando Vite's ?worker import
            this.worker = new Worker(
                new URL('./face.worker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = async (e: MessageEvent) => {
                const { type, payload } = e.data;

                if (type === 'INIT_RESULT') {
                    this.status.mediapipe = payload.mediapipe;
                    this.status.faceapi = payload.faceapi;

                    // Cargar embeddings desde IndexedDB y enviarlos al Worker
                    const embeddings = await loadEmbeddingsFromIDB();
                    this.status.embeddingsLoaded = embeddings.length;

                    this.worker!.postMessage({ type: 'LOAD_EMBEDDINGS', payload: embeddings });
                    return;
                }

                if (type === 'EMBEDDINGS_LOADED') {
                    this.status.embeddingsLoaded = payload.count;
                    this.status.ready = this.status.mediapipe;
                    resolve(this.status);
                    return;
                }

                if (type === 'FRAME_RESULT') {
                    this.onResult?.(payload as FaceResult);
                    return;
                }

                if (type === 'ERROR') {
                    console.error('[FaceWorkerBridge] Worker error:', payload?.error ?? e.data.error);
                }
            };

            this.worker.onerror = (err) => {
                console.error('[FaceWorkerBridge] Worker fatal:', err);
            };

            this.worker.postMessage({ type: 'INIT' });
        });
    }

    // ============================================================
    // RELOAD EMBEDDINGS (llamar después de registrar nuevo usuario)
    // ============================================================

    async reloadEmbeddings(): Promise<number> {
        if (!this.worker) return 0;
        const embeddings = await loadEmbeddingsFromIDB();
        this.worker.postMessage({ type: 'LOAD_EMBEDDINGS', payload: embeddings });
        this.status.embeddingsLoaded = embeddings.length;
        return embeddings.length;
    }

    // ============================================================
    // BUCLE DE CAPTURA DE FRAMES
    // ============================================================

    /**
     * Inicia el loop de captura de frames del video y envío al Worker.
     * Usa requestAnimationFrame para capturar al ritmo del display,
     * pero aplica throttling antes de enviar al Worker.
     */
    startCapture(video: HTMLVideoElement, onResult: ResultCallback): void {
        this.stopCapture();
        this.videoRef = video;
        this.onResult = onResult;

        const loop = () => {
            this.animFrameId = requestAnimationFrame(loop);
            if (!this.worker || !this.videoRef || this.videoRef.readyState < 2) return;

            const now = performance.now();
            if (now - this.lastSentMs < this.frameThrottleMs) return;
            this.lastSentMs = now;

            // createImageBitmap es asíncrono pero muy rápido — no bloquea
            createImageBitmap(this.videoRef).then((bitmap) => {
                this.worker!.postMessage(
                    { type: 'PROCESS_FRAME', payload: { bitmap } },
                    [bitmap]   // Transferir ownership (zero-copy)
                );
            }).catch(() => {/* video no listo */ });
        };

        this.animFrameId = requestAnimationFrame(loop);
    }

    stopCapture(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.videoRef = null;
        this.onResult = null;
    }

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================

    setFrameThrottle(ms: number): void {
        this.frameThrottleMs = Math.max(50, ms);
    }

    getStatus(): BridgeStatus { return { ...this.status }; }

    // ============================================================
    // DESTRUCCIÓN
    // ============================================================

    destroy(): void {
        this.stopCapture();
        this.worker?.terminate();
        this.worker = null;
        this.status = { mediapipe: false, faceapi: false, embeddingsLoaded: 0, ready: false };
    }
}

// Exportar como singleton
export const FaceWorkerBridge = new FaceWorkerBridgeClass();
