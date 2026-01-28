import * as faceapi from 'face-api.js';

// URL de la Cloud Function (Asegúrate de que el nombre coincida con el desplegado)
const CLOUD_FUNCTION_URL = 'https://us-central1-recofacial-7cea1.cloudfunctions.net/processFace';

export const loadModels = async () => {
    // Ya no cargamos modelos pesados en el cliente.
    // Solo cargamos la librería base para usar los LabeledFaceDescriptors en el cotejo final.
    console.log("Modo Nube: Cargando motor de cotejo liviano");
    return true;
};

/**
 * MODO NUBE: Envía la imagen al servidor y recibe el descriptor
 */
export const processFaceImage = async (imageSource, onStatus) => {
    if (!imageSource) return null;

    try {
        if (onStatus) onStatus('Enviando a la Nube...');

        // ✅ OPTIMIZACIÓN: Reducir tamaño de imagen para menor transferencia
        const canvas = document.createElement('canvas');
        canvas.width = 320;  // Reducido de 400 a 320
        canvas.height = 320; // Reducido de 400 a 320
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageSource, 0, 0, 320, 320);

        // ✅ OPTIMIZACIÓN: Reducir calidad para menor tamaño (0.7 es suficiente para detección)
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);

        // Llamada a Firebase Cloud Function
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) throw new Error("Error en el servidor de IA.");

        const result = await response.json();

        if (result.success && result.descriptor) {
            return { descriptor: new Float32Array(result.descriptor) };
        } else {
            console.warn("Servidor:", result.message);
            return null;
        }
    } catch (err) {
        console.error("Falla en Modo Nube:", err);
        throw err;
    }
};

export const getFaceDescriptor = async (videoElement) => {
    try {
        const result = await processFaceImage(videoElement);
        return result ? result.descriptor : null;
    } catch (e) {
        return null;
    }
};

export const createMatcher = (users) => {
    if (!users || users.length === 0) return null;

    // El matcher sigue siendo local porque comparar números es instantáneo
    const labeledDescriptors = users
        .filter(u => u.descriptor)
        .map(user => {
            const descriptor = new Float32Array(Object.values(user.descriptor));
            return new faceapi.LabeledFaceDescriptors(user.id, [descriptor]);
        });

    // Ajustamos el umbral a 0.45 (antes 0.6) para que sea más estricto y preciso
    return labeledDescriptors.length > 0 ? new faceapi.FaceMatcher(labeledDescriptors, 0.45) : null;
};
