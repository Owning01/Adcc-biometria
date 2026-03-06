import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import * as faceapi from 'face-api.js';
import { registerPlayerBiometrics } from './adccService';
import { getAdccImageUrl } from '../utils/imageUtils';

export interface RegistrationResult {
    success: boolean;
    step: 'photo_download' | 'face_detection' | 'firebase_upload' | 'api_sync';
    error?: string;
    imageUrl?: string;
    descriptor?: string;
}

/**
 * Servicio centralizado para el registro de jugadores (Biometría + Firebase + API ADCC).
 */
export const playerRegistrationService = {
    /**
     * Procesa un jugador completo: extrae biometría, sube a Firebase y sincroniza con API externa.
     */
    async registerPlayer(player: {
        jleid: number;
        dni: number | string;
        nombre: string;
        apellido: string;
        foto: string;
    }): Promise<RegistrationResult> {
        try {
            // 1. Cargar imagen con URL segura (Proxy CORS) y extraer descriptor
            const safeUrl = getAdccImageUrl(player.foto);

            try {
                // Test fetch to see detailed error headers in console
                const testRes = await fetch(safeUrl, { method: 'HEAD' });
                if (!testRes.ok) {
                    console.error(`Fetch test failed for ${safeUrl}: ${testRes.status} ${testRes.statusText}`);
                }
            } catch (e) {
                console.error(`Fetch attempt failed for ${safeUrl}:`, e);
            }

            let img: HTMLImageElement;
            try {
                img = await faceapi.fetchImage(safeUrl);
            } catch (fetchErr) {
                // Fallback robusto usando Image DOM element si fetch falla
                img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.crossOrigin = 'anonymous';
                    image.onload = () => resolve(image);
                    image.onerror = () => reject(new Error(`No se pudo descargar la imagen proxy: ${safeUrl}`));
                    image.src = safeUrl;
                });
            }
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                return { success: false, step: 'face_detection', error: 'No se detectó rostro en la imagen proporcionada' };
            }

            const descriptorArray = Array.from(detection.descriptor);
            const descriptorString = JSON.stringify(descriptorArray);

            // 2. Procesar y Subir imagen a Firebase Storage (600x600 .webp)
            let firebaseImageUrl = player.foto;
            try {
                // Función para redimensionar a 600x600 y convertir a WebP
                const processImage = async (image: HTMLImageElement): Promise<Blob> => {
                    const canvas = document.createElement('canvas');
                    const SIZE = 600; // Tamaño solicitado 600x600
                    canvas.width = SIZE;
                    canvas.height = SIZE;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Could not get canvas context');

                    // Dibujamos la imagen centrada y recortada (Center Crop)
                    const scale = Math.max(SIZE / image.width, SIZE / image.height);
                    const x = (SIZE / 2) - (image.width / 2) * scale;
                    const y = (SIZE / 2) - (image.height / 2) * scale;

                    ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

                    return new Promise((resolve, reject) => {
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Canvas toBlob failed'));
                        }, 'image/webp', 0.9); // WebP con alta calidad
                    });
                };

                const processedBlob = await processImage(img);
                const storageRef = ref(storage, `players/${player.jleid}/profile.webp`);
                await uploadBytes(storageRef, processedBlob);
                firebaseImageUrl = await getDownloadURL(storageRef);
            } catch (err) {
                console.warn('Error procesando imagen para Storage, usando original:', err);
            }

            // 3. Guardar en Firestore (Lógica de Upsert)
            // Buscamos si ya existe un usuario con este id (jleid) o DNI
            const collectionName = 'users';
            let finalDocId = String(player.jleid);

            // Intentar encontrar por ID primero
            const docRef = doc(db, collectionName, finalDocId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                // Si no existe por ID, intentamos buscar por DNI en la colección
                const { query, where, getDocs, collection } = await import('firebase/firestore');
                const q = query(collection(db, collectionName), where('dni', '==', player.dni));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    finalDocId = querySnap.docs[0].id;
                }
            }

            const playerDoc = {
                id: player.jleid, // ID de ADCC
                dni: player.dni,
                nombre: player.nombre,
                apellido: player.apellido,
                displayName: `${player.nombre} ${player.apellido}`,
                photoURL: firebaseImageUrl,
                descriptor: descriptorArray, // Usamos el array directo para face-api.js local
                face_api: descriptorString,  // String para compatibilidad API
                updatedAt: new Date().toISOString(),
                registered: true,
                status: 'habilitado' // Aseguramos que el jugador se cree habilitado
            };

            await setDoc(doc(db, collectionName, finalDocId), playerDoc, { merge: true });

            // 4. Sincronizar con API externa ADCC
            const apiRes = await registerPlayerBiometrics(player.jleid, descriptorString);

            if (!apiRes || (apiRes.ok === false)) {
                return {
                    success: false,
                    step: 'api_sync',
                    error: apiRes?.error || 'La API externa no aceptó el registro',
                    descriptor: descriptorString,
                    imageUrl: firebaseImageUrl
                };
            }

            return {
                success: true,
                step: 'api_sync',
                descriptor: descriptorString,
                imageUrl: firebaseImageUrl
            };

        } catch (error) {
            console.error('Error in registerPlayer:', error);
            return {
                success: false,
                step: 'photo_download',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
