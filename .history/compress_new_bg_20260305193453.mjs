import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgDir = path.join(process.cwd(), 'src/img');

const filesToCompress = [
    'fondo para boton.jpeg'
];

async function compressImages() {
    for (const file of filesToCompress) {
        const inputPath = path.join(imgDir, file);
        const fileName = path.parse(file).name;
        const outputPath = path.join(imgDir, `fondo_boton.webp`);

        if (fs.existsSync(inputPath)) {
            try {
                await sharp(inputPath)
                    .webp({ quality: 75 })
                    .resize({ width: 1280, height: 720, fit: 'cover', withoutEnlargement: true })
                    .toFile(outputPath);
                console.log(`Compressed: ${file} -> fondo_boton.webp`);
            } catch (err) {
                console.error(`Error compressing ${file}:`, err);
            }
        } else {
            console.warn(`File not found: ${inputPath}`);
        }
    }
}

compressImages();
