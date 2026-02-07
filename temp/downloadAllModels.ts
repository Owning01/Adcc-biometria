import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = path.join(__dirname, 'public', 'models');

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// LISTA COMPLETA DE ARCHIVOS NECESARIOS
const files = [
    // Tiny Face Detector
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',

    // Face Recognition
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2', // A veces hay shard2

    // Face Landmarks 68
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',

    // SSD Mobilenet (Backup)
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2'
];

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const downloadFile = (file) => {
    const filePath = path.join(modelsDir, file);
    const fileUrl = `${baseUrl}/${file}`;

    console.log(`Checking ${file}...`);

    const fileStream = fs.createWriteStream(filePath);
    https.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
            console.log(`❌ File not found on server (might be optional): ${file}`);
            fs.unlink(filePath, () => { });
            return;
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`✅ Downloaded ${file}`);
        });
    }).on('error', (err) => {
        fs.unlink(filePath, () => { });
        console.error(`Error downloading ${file}: ${err.message}`);
    });
};

console.log("Iniciando descarga masiva de modelos...");
files.forEach(downloadFile);
