import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAdccImageUrl } from '../utils/imageUtils';

/**
 * Comprime una imagen desde una URL externa (vía proxy si es ADCC)
 * y la sube a Firebase Storage en formato WebP optimizado.
 * 
 * @param url - La URL original de la imagen.
 * @param teamId - El ID del equipo para nombrar el archivo.
 * @returns La URL de descarga de Firebase Storage.
 */
export const compressAndUploadLogo = async (url: string, teamId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const proxyUrl = getAdccImageUrl(url);

        // Importante para poder manipular la imagen en Canvas si viene de otro dominio
        img.crossOrigin = "anonymous";

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("No se pudo obtener el contexto del canvas"));

            // Dimensiones máximas para el logo (suficiente para UI y ocupa poco espacio)
            const maxWidth = 128;
            const maxHeight = 128;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Dibujar imagen escalada
            ctx.drawImage(img, 0, 0, width, height);

            // Convertir a BloB en formato WebP (más liviano que PNG/JPG)
            canvas.toBlob(async (blob) => {
                if (!blob) return reject(new Error("Error al crear el Blob de la imagen"));

                try {
                    const storageRef = ref(storage, `logos/${teamId}.webp`);

                    // Subir a Firebase Storage
                    const metadata = { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' };
                    await uploadBytes(storageRef, blob, metadata);

                    // Obtener la URL pública
                    const downloadURL = await getDownloadURL(storageRef);
                    resolve(downloadURL);
                } catch (e) {
                    console.error("Error subiendo logo a Storage:", e);
                    reject(e);
                }
            }, 'image/webp', 0.8); // 80% de calidad es óptimo
        };

        img.onerror = (e) => {
            console.error("Error cargando imagen para compresión:", url, e);
            reject(new Error("No se pudo cargar la imagen original"));
        };

        img.src = proxyUrl;
    });
};
