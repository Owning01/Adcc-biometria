import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgDir = path.join(process.cwd(), 'src/img');

const filesToCompress = [
    '1_abstracto_geomtrico.png',
    '2 Frosted_glass_panels.jpeg',
    '3 Artificial_grass.jpeg'
];

async function compressImages() {
    for (const file of filesToCompress) {
        const inputPath = path.join(imgDir, file);
        const fileName = path.parse(file).name;
        const outputPath = path.join(imgDir, `${fileName}.webp`);

        if (fs.existsSync(inputPath)) {
            try {
                await sharp(inputPath)
                    .webp({ quality: 60 }) // High compression
                    .resize({ width: 1920, withoutEnlargement: true }) // Max width 1920px
                    .toFile(outputPath);
                console.log(`Compressed: ${file} -> ${fileName}.webp`);
            } catch (err) {
                console.error(`Error compressing ${file}:`, err);
            }
        } else {
            console.warn(`File not found: ${inputPath}`);
        }
    }
}

compressImages();
