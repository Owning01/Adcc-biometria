import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const imgDir = path.join(process.cwd(), 'src', 'img');
const publicDir = path.join(process.cwd(), 'public');
const rootDir = path.join(process.cwd());

const filesToCompress = [
    { source: path.join(rootDir, 'Applogo.png'), dest: path.join(rootDir, 'Applogo.webp') },
    { source: path.join(imgDir, 'Logo ADCC.png'), dest: path.join(imgDir, 'Logo ADCC.webp') },
    { source: path.join(imgDir, 'arco abstracto futurista.png'), dest: path.join(imgDir, 'arco abstracto futurista.webp') },
    { source: path.join(imgDir, 'estadio.png'), dest: path.join(imgDir, 'estadio.webp') },
    { source: path.join(imgDir, 'Pelota.png'), dest: path.join(imgDir, 'Pelota.webp') }
];

async function compressImages() {
    for (const file of filesToCompress) {
        if (fs.existsSync(file.source)) {
            try {
                await sharp(file.source)
                    .webp({ quality: 80 })
                    .toFile(file.dest);
                console.log(`✅ Successfully compressed: ${path.basename(file.dest)}`);

                // Optional: Remove original PNG to save space
                // fs.unlinkSync(file.source);
                // console.log(`🗑️ Deleted original: ${path.basename(file.source)}`);
            } catch (error) {
                console.error(`❌ Error compressing ${file.source}:`, error);
            }
        } else {
            console.warn(`⚠️ Source file not found: ${file.source}`);
        }
    }
}

compressImages();
