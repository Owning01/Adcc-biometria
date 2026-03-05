import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import * as faceapi from 'face-api.js';
import { registerPlayerBiometrics } from './adccService';

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
            // 1. Cargar imagen y extraer descriptor
            const img = await faceapi.fetchImage(player.foto);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                return { success: false, step: 'face_detection', error: 'No se detectó rostro en la imagen proporcionada' };
            }

            const descriptorArray = Array.from(detection.descriptor);
            const descriptorString = JSON.stringify(descriptorArray);

            // 2. Subir imagen a Firebase Storage con COMPRESIÓN
            let firebaseImageUrl = player.foto;
            try {
                // Función interna para comprimir via Canvas
                const compressImage = async (image: HTMLImageElement): Promise<Blob> => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 400; // Máximo 400px para ahorrar espacio
                    let width = image.width;
                    let height = image.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(image, 0, 0, width, height);

                    return new Promise((resolve, reject) => {
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Canvas toBlob failed'));
                        }, 'image/jpeg', 0.7); // Calidad 0.7
                    });
                };

                const compressedBlob = await compressImage(img);
                const storageRef = ref(storage, `players/${player.jleid}/profile.jpg`);
                await uploadBytes(storageRef, compressedBlob);
                firebaseImageUrl = await getDownloadURL(storageRef);
            } catch (err) {
                console.warn('Error subiendo/comprimiendo en Storage, usando URL original:', err);
                // No bloqueamos el proceso si esto falla
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
