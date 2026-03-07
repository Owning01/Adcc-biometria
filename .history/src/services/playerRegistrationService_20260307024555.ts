import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import * as faceapi from 'face-api.js';
import { registerPlayerBiometrics } from './adccService';
import { getAdccImageUrl } from '../utils/imageUtils';
import { getTeam, saveTeam } from './teamsService';

export interface PlayerData {
    id: string | number;
    dni: string | number;
    nombre: string;
    apellido: string;
    foto: string;
    team?: string;
    category?: string;
    jleid?: string | number;
    name?: string;
    displayName?: string;
}

export interface RegistrationResult {
    success: boolean;
    step: 'photo_download' | 'face_detection' | 'firebase_upload' | 'api_sync';
    error?: string;
    imageUrl?: string;
    descriptor?: string;
    alreadyRegistered?: boolean;
}

/**
 * Servicio centralizado para el registro de jugadores (Biometría + Firebase + API ADCC).
 */
export const playerRegistrationService = {
    /**
     * Procesa un jugador completo: extrae biometría, sube a Firebase y sincroniza con API externa.
     */
    async registerPlayer(player: PlayerData, options?: { syncWithApi?: boolean; forceUpdate?: boolean }): Promise<RegistrationResult> {
        try {
            const collectionName = 'users';
            const rawId = player.id || player.jleid || player.dni;
            const finalDocId = rawId ? String(rawId) : String(Date.now());

            // 0. Verificación Previa: ¿Ya existe en Firebase con Biometría?
            if (!options?.forceUpdate) {
                try {
                    const docRef = doc(db, collectionName, finalDocId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.face_api && data.photoURL) {
                            return {
                                success: true,
                                step: 'firebase_upload',
                                descriptor: data.face_api,
                                imageUrl: data.photoURL,
                                alreadyRegistered: true
                            };
                        }
                    }
                } catch (err) {
                    console.warn('Error en verificación previa Firestore:', err);
                }
            }

            // 1. Cargar imagen con URL segura (Proxy CORS) y extraer descriptor
            const safeUrl = getAdccImageUrl(player.foto);

            let img: HTMLImageElement;
            try {
                img = await faceapi.fetchImage(safeUrl);
            } catch (fetchErr) {
                // Fallback robusto usando Image DOM element si fetch falla
                img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.crossOrigin = 'anonymous';
                    image.onload = () => resolve(image);
                    image.onerror = () => reject(new Error(`No se pudo descargar la imagen (Weserv Proxy): ${safeUrl}`));
                    image.src = safeUrl;
                });
            }

            // IMPORTANTE: Usamos el servicio local que ya tiene configurado SSD Mobilenet V1 
            // con los mismos parámetros que el Login para asegurar sintonía total.
            const { getFaceDataFromImage } = await import('./faceServiceLocal');
            const data = await getFaceDataFromImage(img);

            let descriptorArray: number[] = [];
            let descriptorString: string = '';

            if (data) {
                descriptorArray = Array.from(data.descriptor);
                descriptorString = JSON.stringify(descriptorArray);
            } else {
                console.warn('No se detectó rostro en la imagen, se procederá solo con el guardado de la foto.');
            }

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

            // 3. Guardar en Firestore (Lógica de Upsert) - Nota: collectionName y finalDocId ya definidos arriba
            let actualDocId = finalDocId;

            // Intentar encontrar por ID primero
            const docRefSearch = doc(db, collectionName, actualDocId);
            const docSnapSearch = await getDoc(docRefSearch);

            let existingTeam = '';
            let existingCategory = '';

            if (docSnapSearch.exists()) {
                const data = docSnapSearch.data();
                existingTeam = data.team || '';
                existingCategory = data.category || '';
            } else if (player.dni !== undefined && player.dni !== null && player.dni !== '') {
                // Si no existe por ID, intentamos buscar por DNI en la colección
                const { query, where, getDocs, collection } = await import('firebase/firestore');
                const q = query(collection(db, collectionName), where('dni', '==', player.dni));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    actualDocId = querySnap.docs[0].id;
                    const data = querySnap.docs[0].data();
                    existingTeam = data.team || '';
                    existingCategory = data.category || '';
                }
            }

            const name = (player.nombre || player.apellido)
                ? `${player.nombre || ''} ${player.apellido || ''}`.trim()
                : player.displayName || player.name || 'Jugador Sin Nombre';

            const playerDoc = {
                id: player.id || player.jleid || player.dni || finalDocId,
                jleid: player.jleid || player.id || '',
                dni: player.dni ? String(player.dni) : '',
                nombre: player.nombre || name.split(' ')[0] || '',
                apellido: player.apellido || name.split(' ').slice(1).join(' ') || '',
                name: name,
                displayName: name,
                photo: firebaseImageUrl || player.foto || '',
                photoURL: firebaseImageUrl || player.foto || '',
                descriptor: descriptorArray || [],
                face_api: descriptorString || '',
                updatedAt: new Date().toISOString(),
                registered: true,
                status: 'habilitado',
                team: player.team || existingTeam || 'null',
                category: player.category || existingCategory || 'null',
            };

            // 3.5 Gestión de equipo y categoría (NUEVO REQUERIMIENTO)
            if (player.team && player.team !== 'null') {
                try {
                    const teamId = player.team;
                    const existingTeamData = await getTeam(teamId);
                    const categoryToAdd = player.category || 'General';

                    if (!existingTeamData) {
                        // Crear equipo si no existe
                        await saveTeam({
                            id: teamId,
                            name: teamId,
                            categories: [categoryToAdd]
                        });
                    } else {
                        // Si existe, verificar si la categoría ya está listada
                        const currentCategories = existingTeamData.categories || [];
                        if (!currentCategories.includes(categoryToAdd)) {
                            await saveTeam({
                                ...existingTeamData,
                                categories: [...currentCategories, categoryToAdd]
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error gestionando equipo/categoría:', err);
                }
            }

            await setDoc(doc(db, collectionName, actualDocId), playerDoc, { merge: true });

            // 4. Sincronizar con API externa ADCC (Opcional)
            if (options?.syncWithApi) {
                const apiRes = await registerPlayerBiometrics(Number(player.jleid), descriptorString);

                if (!apiRes || (apiRes.ok === false)) {
                    return {
                        success: false,
                        step: 'api_sync',
                        error: apiRes?.error || 'La API externa no aceptó el registro',
                        descriptor: descriptorString,
                        imageUrl: firebaseImageUrl
                    };
                }
            }

            return {
                success: true,
                step: options?.syncWithApi ? 'api_sync' : 'firebase_upload',
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
    },

    /**
     * Registra el éxito de una inscripción en una colección histórica/log.
     */
    async logSuccessfulRegistration(player: {
        id: string | number;
        nombre: string;
        apellido: string;
        team?: string;
        category?: string;
    }): Promise<void> {
        try {
            const logId = `${player.id}_${Date.now()}`;
            await setDoc(doc(db, 'registered_log', String(player.id)), {
                id: player.id,
                nombre: player.nombre,
                apellido: player.apellido,
                team: player.team || 'null',
                category: player.category || 'null',
                registeredAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error logging registration success:', error);
        }
    }
};
