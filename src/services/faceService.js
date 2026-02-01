import * as faceapi from 'face-api.js';

// URL de la Cloud Function de Firebase.
// Esta función procesa la imagen en el servidor (backend) para reducir la carga en dispositivos móviles lentos.
const CLOUD_FUNCTION_URL = 'https://us-central1-recofacial-7cea1.cloudfunctions.net/processFace';

/**
 * Inicializa el servicio en modo nube.
 * A diferencia del modo local, aquí no necesitamos cargar modelos pesados de TensorFlow en el navegador.
 * Solo necesitamos la librería base para manejar las estructuras de datos (descriptores).
 */
export const loadModels = async () => {
    console.log("☁️ Modo Nube Activado: Usando motor de inferencia remoto");
    return true;
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
export const processFaceImage = async (imageSource, onStatus) => {
    if (!imageSource) return null;

    try {
        if (onStatus) onStatus('☁️ Enviando a la Nube...');

        // 1. Preprocesamiento en cliente (Edge)
        const canvas = document.createElement('canvas');
        canvas.width = 320;  // Resolución óptima para FaceNet (input nativo aprox 160px a 320px)
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageSource, 0, 0, 320, 320);

        // Convertir a base64 (JPEG es más liviano que PNG)
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);

        // 2. Inferencia en Serverless (Cloud Function)
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();

        if (result.success && result.descriptor) {
            // Convertimos el array genérico a Float32Array para compatibilidad con face-api.js
            return { descriptor: new Float32Array(result.descriptor) };
        } else {
            console.warn("⚠️ Respuesta del servidor:", result.message);
            return null;
        }
    } catch (err) {
        console.error("❌ Falla en Modo Nube:", err);
        throw err;
    }
};

/**
 * Wrapper para obtener solo el descriptor.
 */
export const getFaceDescriptor = async (videoElement) => {
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
export const createMatcher = (users) => {
    if (!users || users.length === 0) return null;

    const labeledDescriptors = users
        .filter(u => u.descriptor)
        .map(user => {
            // Reconstituir Float32Array desde el objeto guardado en Firestore/JSON
            const descriptor = new Float32Array(Object.values(user.descriptor));
            return new faceapi.LabeledFaceDescriptors(user.id, [descriptor]);
        });

    // Umbral de distancia Euclideana (0.0 = idéntico, > 0.6 = diferente)
    // 0.45 es un valor estricto para evitar falsos positivos en seguridad.
    return labeledDescriptors.length > 0 ? new faceapi.FaceMatcher(labeledDescriptors, 0.45) : null;
};
