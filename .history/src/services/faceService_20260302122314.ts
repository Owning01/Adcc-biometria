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
            faceapi.nets.tinyFaceDetector.loadFromDisk ? faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL) : faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * MODO NUBE: Procesa un frame de video o imagen enviándolo al servidor.
 * 
 * Flujo:
 * 1. Captura el frame en un canvas temporal.
 * 2. Redimensiona a 320x320 para optimizar ancho de banda.
 * 3. Comprime a JPEG calidad 0.7.
 * 4. Envía a Cloud Function.
 * 5. Recibe el vector numérico (descriptor) de 128 dimensiones.
 * 
 * @param {HTMLVideoElement|HTMLImageElement} imageSource - Fuente de la imagen.
 * @param {Function} [onStatus] - Callback opcional para reportar estado.
 * @returns {Promise<{descriptor: Float32Array}|null>}
 */
/**
 * MODO LOCAL: Procesa un frame de video o imagen usando face-api.js en el navegador.
 * 
 * @param {HTMLVideoElement|HTMLImageElement} imageSource - Fuente de la imagen.
 * @param {Function} [onStatus] - Callback opcional para reportar estado.
 * @returns {Promise<{descriptor: Float32Array}|null>}
 */
export const processFaceImage = async (imageSource: HTMLVideoElement | HTMLImageElement, onStatus?: (status: string) => void): Promise<{ descriptor: Float32Array } | null> => {
    if (!imageSource) return null;

    try {
        if (onStatus) onStatus('🔍 Procesando localmente...');

        const result = await faceapi.detectSingleFace(
            imageSource,
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptor();

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
 * Aunque la detección sea en la nube, el COTEJO (matching) se hace localmente.
 * ¿Por qué? Porque comparar vectores de números es computacionalmente trivial (microsegundos).
 * Esto permite tener la base de datos de usuarios en el cliente (caché) y cotejar sin enviar todos los usuarios al servidor.
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

    // Umbral de distancia Euclideana (0.0 = idéntico, > 0.6 = diferente)
    // 0.6 es el estándar de face-api.js. 0.45 era demasiado estricto.
    return labeledDescriptors.length > 0 ? new faceapi.FaceMatcher(labeledDescriptors, 0.6) : null;
};
