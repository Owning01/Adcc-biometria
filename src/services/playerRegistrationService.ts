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

            // 2. Subir imagen a Firebase Storage (opcional/si el usuario lo requiere como backup o perfil)
            let firebaseImageUrl = player.foto;
            try {
                const response = await fetch(player.foto);
                const blob = await response.blob();
                const storageRef = ref(storage, `players/${player.jleid}/profile.jpg`);
                await uploadBytes(storageRef, blob);
                firebaseImageUrl = await getDownloadURL(storageRef);
            } catch (err) {
                console.warn('Error subiendo a Firebase Storage, usando URL original:', err);
                // No bloqueamos el proceso si esto falla, pero avisamos
            }

            // 3. Guardar en Firestore
            const playerDoc = {
                id: player.jleid,
                dni: player.dni,
                nombre: player.nombre,
                apellido: player.apellido,
                displayName: `${player.nombre} ${player.apellido}`,
                photoURL: firebaseImageUrl,
                face_api: descriptorString,
                updatedAt: new Date().toISOString(),
                registered: true
            };

            await setDoc(doc(db, 'players', String(player.jleid)), playerDoc, { merge: true });

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
