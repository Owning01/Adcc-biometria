import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = path.join(__dirname, 'public', 'models');

const files = [
    {
        name: 'face_embedder.tflite',
        url: 'https://storage.googleapis.com/mediapipe-models/face_embedder/face_embedder/float16/1/face_embedder.tflite'
    }
];

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const downloadFile = (file) => {
    const filePath = path.join(modelsDir, file.name);

    console.log(`Checking ${file.name}...`);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file.name} already exists.`);
        return;
    }

    const fileStream = fs.createWriteStream(filePath);
    https.get(file.url, (response) => {
        if (response.statusCode !== 200) {
            console.log(`❌ Error: Status ${response.statusCode} for ${file.name}`);
            fs.unlink(filePath, () => { });
            return;
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`✅ Downloaded ${file.name}`);
        });
    }).on('error', (err) => {
        fs.unlink(filePath, () => { });
        console.error(`Error downloading ${file.name}: ${err.message}`);
    });
};

files.forEach(downloadFile);
