import * as faceapi from 'face-api.js';

// URL de la Cloud Function de Firebase.
// Esta función procesa la imagen en el servidor (backend) para reducir la carga en dispositivos móviles lentos.
const CLOUD_FUNCTION_URL = 'https://us-central1-adccbiometric.cloudfunctions.net/processFace';

/**
 * Inicializa el servicio en modo nube.
 * A diferencia del modo local, aquí no necesitamos cargar modelos pesados de TensorFlow en el navegador.
 * Solo necesitamos la librería base para manejar las estructuras de datos (descriptores).
 */
/**
 * Inicializa el servicio en modo local.
 * Carga los modelos de face-api.js desde la carpeta public/ai_models.
 */
export const loadModels = async () => {
    try {
        const MODEL_URL = '/ai_models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * MODO LOCAL: Procesa un frame de video o imagen usando face-api.js en el navegador.
 * Prioriza SsdMobilenetv1 para mayor precisión en extracción de descriptores.
 * 
 * @param {HTMLVideoElement|HTMLImageElement} imageSource - Fuente de la imagen.
 * @param {Function} [onStatus] - Callback opcional para reportar estado.
 * @returns {Promise<{descriptor: Float32Array}|null>}
 */
export const processFaceImage = async (imageSource: HTMLVideoElement | HTMLImageElement, onStatus?: (status: string) => void): Promise<{ descriptor: Float32Array } | null> => {
    if (!imageSource) return null;

    try {
        if (onStatus) onStatus('🔍 Procesando localmente con alta precisión...');

        // 1. Intentar con SSD Mobilenet V1 (Máxima precisión para login)
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        let result = await faceapi.detectSingleFace(imageSource, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        // 2. Fallback a Tiny Face Detector
        if (!result) {
            const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
            result = await faceapi.detectSingleFace(imageSource, tinyOptions)
                .withFaceLandmarks()
                .withFaceDescriptor();
        }

        if (result) {
            return { descriptor: result.descriptor };
        }
        return null;
    } catch (err) {
        throw err;
    }
};

/**
 * Wrapper para obtener solo el descriptor.
 */
export const getFaceDescriptor = async (videoElement: HTMLVideoElement | HTMLImageElement) => {
    try {
        const result = await processFaceImage(videoElement);
        return result ? result.descriptor : null;
    } catch (e) {
        return null;
    }
};

/**
 * Crea una instancia de FaceMatcher para comparar descriptores.
 * 
 * @param {Array} users - Lista de usuarios con descriptores guardados.
 * @returns {faceapi.FaceMatcher|null}
 */
export const createMatcher = (users: any[]): faceapi.FaceMatcher | null => {
    if (!users || users.length === 0) return null;

    const labeledDescriptors = users
        .filter(u => u.descriptor)
        .map(user => {
            // Reconstituir Float32Array desde el objeto guardado en Firestore/JSON
            const descriptor = new Float32Array(Object.values(user.descriptor));
            return new faceapi.LabeledFaceDescriptors(user.id, [descriptor]);
        });

    // Umbral de distancia Euclideana (0.0 = idéntico, > umbral = diferente)
    // 0.42 es mucho más estricto que 0.5 para evitar falsos positivos y asegurar que 
    // identificamos a la persona correcta, dado que el modelo puede confundir rostros similares 
    // a 0.5.
    return labeledDescriptors.length > 0 ? new faceapi.FaceMatcher(labeledDescriptors, 0.42) : null;
};
