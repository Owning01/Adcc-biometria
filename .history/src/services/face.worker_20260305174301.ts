import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://adccbiometric.web.app/models';

// Configuración del Worker
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'LOAD_MODELS') {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();

            self.postMessage({ type: 'MODELS_LOADED' });
        } catch (err) {
            self.postMessage({ type: 'ERROR', error: err.message });
        }
    }

    if (type === 'DETECT_FACE') {
        try {
            const { imageData, width, height } = payload;

            // Reconstruimos la imagen en el worker
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
            ctx.putImageData(imgData, 0, 0);

            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 });
            const result = await faceapi.detectSingleFace(canvas, options)
                .withFaceLandmarks()
                .withFaceDescriptor();

            self.postMessage({
                type: 'DETECTION_RESULT',
                payload: result ? { descriptor: Array.from(result.descriptor) } : null
            });
        } catch (err) {
            self.postMessage({ type: 'ERROR', error: err.message });
        }
    }
};
