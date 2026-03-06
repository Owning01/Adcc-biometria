/**
 * @file db.ts
 * @description SERVICIO DE BASE DE DATOS (USUARIOS)
 * Capa de abstracción para operar sobre la colección 'users' en Firestore.
 * Incluye caché local, validaciones y sincronización en tiempo real.
 */
import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, query, where, getDoc, getCountFromServer } from 'firebase/firestore';
import { logEvent, getCurrentUserAudit } from './auditService';
import { getMatches } from './matchesService';

// ============================================================================
// 1. CONSTANTS & INTERFACES
// ============================================================================
// Nombres de las colecciones en Firestore
const USERS_COLLECTION = 'users'; // Colección principal de usuarios
const USERS_V2_COLLECTION = 'users_v2'; // Colección para la versión 2 (posiblemente con estructura de datos faciales diferente)

export interface User {
    id: string;
    name: string;
    nombre?: string;
    apellido?: string;
    displayName?: string;
    dni: string;
    team: string;
    category: string;
    categories: string[];
    photo?: string;
    photoURL?: string;
    descriptor?: any;
    face_api?: string;
    status: string;
    categoryStatuses?: Record<string, string>;
    [key: string]: any;
}

// ============================================================================
// 2. READ OPERATIONS (GETTERS)
// ============================================================================
/**
 * Obtiene la cantidad total de usuarios registrados.
 */
export const getUserCount = async (): Promise<number> => {
    try {
        const coll = collection(db, USERS_COLLECTION);
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    } catch (error) {
        console.error("Error fetching user count:", error);
        return 0;
    }
};

/**
 * Obtiene la lista completa de usuarios desde Firestore.
 * Implementa un sistema de caché en localStorage para reducir lecturas a la base de datos.
 *
 * @param {boolean} forceRefresh - Si es true, ignora el caché y fuerza una lectura nueva desde Firestore.
 * @returns {Promise<User[]>} - Retorna un array con los objetos de usuario.
 */
export const getUsers = async (forceRefresh = false): Promise<User[]> => {
    try {
        // ✅ OPTIMIZACIÓN: Cachear usuarios en localStorage para mejorar el rendimiento y reducir costos.
        const cached = localStorage.getItem('users_cache');

        // Si hay caché y no se fuerza actualización, verificamos la validez del caché
        if (cached && !forceRefresh) {
            const { data, timestamp } = JSON.parse(cached);
            // El caché es válido por 60 minutos para evitar descargas masivas frecuentes
            if (Date.now() - timestamp < 60 * 60 * 1000) {
                return data;
            }
        }


        // Solicita todos los documentos de la colección 'users'
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));

        // Mapea los documentos para incluir el ID de Firestore dentro del objeto de datos
        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id } as User; // Forzamos que el id sea siempre el de Firestore
        });

        // Guardamos los datos nuevos en el localStorage con un timestamp
        localStorage.setItem('users_cache', JSON.stringify({
            data: users,
            timestamp: Date.now()
        }));

        return users;
    } catch (error) {

        // FALLBACK OFF-LINE: Si falla la red (error), intentamos usar el caché local aunque esté "vencido"
        const cached = localStorage.getItem('users_cache');
        if (cached) {
            const { data } = JSON.parse(cached);
            return data;
        }

        // Si falla todo, retornamos array vacío
        return [];
    }
};

/**
 * Obtiene SOLAMENTE los usuarios que pertenecen a equipos que juegan hoy (status: live o scheduled).
 * Previene el colapso de memoria al no descargar miles de vectores faciales innecesarios.
 */
export const getMatchDayUsers = async (forceRefresh = false): Promise<User[]> => {
    try {
        const cached = localStorage.getItem('matchday_users_cache');
        if (cached && !forceRefresh) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 10 * 60 * 1000) return data;
        }

        // 1. Obtener partidos activos (scheduled o live)
        const matches = await getMatches();
        const activeMatches = matches.filter((m: any) => m.status === 'live' || m.status === 'scheduled');

        // 2. Extraer nombres de equipos únicos
        const activeTeams = new Set<string>();
        activeMatches.forEach((m: any) => {
            if (m.teamA?.name) activeTeams.add(m.teamA.name);
            if (m.teamB?.name) activeTeams.add(m.teamB.name);
        });

        if (activeTeams.size === 0) return []; // No hay partidos hoy

        const teamList = Array.from(activeTeams);
        const users: User[] = [];

        // 3. Consultar Firestore en lotes de 10 (límite de 'in')
        for (let i = 0; i < teamList.length; i += 10) {
            const chunk = teamList.slice(i, i + 10);
            const q = query(collection(db, USERS_COLLECTION), where('team', 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                users.push({ ...doc.data(), id: doc.id } as User);
            });
        }

        localStorage.setItem('matchday_users_cache', JSON.stringify({
            data: users,
            timestamp: Date.now()
        }));

        return users;
    } catch (error) {
        const cached = localStorage.getItem('matchday_users_cache');
        if (cached) return JSON.parse(cached).data;
        return [];
    }
};


/**
 * Suscribe a los cambios en tiempo real de la colección de usuarios.
 * Mantiene la UI sincronizada automáticamente cuando hay cambios en la base de datos.
 * 
 * @param {Function} callback - Función que se ejecutará cada vez que cambien los datos.
 * @returns {Function} - Función para desuscribirse (unsubscribe).
 */
export const subscribeToUsers = (callback: (users: User[]) => void) => {
    // onSnapshot escucha cambios en la colección
    return onSnapshot(collection(db, USERS_COLLECTION), (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id } as User;
        });

        // Mantener el cache local actualizado con los datos reales que llegan del socket
        localStorage.setItem('users_cache', JSON.stringify({
            data: users,
            timestamp: Date.now()
        }));

        // Ejecutamos el callback para actualizar el estado del componente React
        callback(users);
    });
};

/**
 * Suscribe a los usuarios de un equipo específico.
 * Optimiza el rendimiento al no descargar toda la base de datos.
 */
export const subscribeToUsersByTeam = (team: string, callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where('team', '==', team));
    return onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        callback(users);
    });
};

/**
 * Suscribe a los usuarios de una categoría específica.
 */
export const subscribeToUsersByCategory = (category: string, callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where('categories', 'array-contains', category));
    return onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        callback(users);
    });
};

/**
 * Realiza una búsqueda de usuarios en el servidor con límite.
 * Útil para búsquedas globales sin descargar miles de registros.
 */
export const searchUsersServerSide = async (searchTerm: string, limitCount = 50): Promise<User[]> => {
    try {
        if (!searchTerm || searchTerm.length < 2) return [];

        const term = searchTerm.toLowerCase();

        // Check offline/matchday cache first for snappy results
        const cachedMatchDay = localStorage.getItem('matchday_users_cache');
        if (cachedMatchDay) {
            const { data } = JSON.parse(cachedMatchDay);
            const matchDayResults = data.filter((u: User) =>
                u.name?.toLowerCase().includes(term) ||
                u.dni?.includes(term)
            );
            if (matchDayResults.length > 5) return matchDayResults.slice(0, limitCount);
        }

        const isNumeric = /^\d+$/.test(searchTerm);
        let q;

        if (isNumeric) {
            q = query(collection(db, USERS_COLLECTION), where('dni', '==', searchTerm));
        } else {
            // Placeholder: Para nombres, lo ideal es usar un índice de búsqueda (Algolia/Typesense).
            // Como no tenemos, limitamos la búsqueda o usamos el caché si está disponible.
            const users = await getUsers();
            return users.filter(u =>
                u.name?.toLowerCase().includes(term) ||
                u.dni?.includes(term)
            ).slice(0, limitCount);
        }

        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (error) {
        console.error("Error en searchUsersServerSide:", error);
        return [];
    }
};

// ============================================================================
// 3. WRITE OPERATIONS (CRUD)
// ============================================================================
/**
 * Guarda un nuevo usuario en la base de datos.
 *
 * @param {Object} user - Objeto con los datos del usuario a guardar.
 * @returns {Promise<User>} - Retorna el usuario guardado con su nuevo ID.
 */
export const saveUser = async (user: any): Promise<User> => {
    try {
        // addDoc crea un nuevo documento con ID autogenerado
        const docRef = await addDoc(collection(db, USERS_COLLECTION), user);

        // ✅ OPTIMIZACIÓN: Al guardar datos nuevos, el caché actual queda obsoleto.
        // Lo eliminamos para forzar una recarga limpia la próxima vez o dejar que subscribeToUsers lo actualice.
        localStorage.removeItem('users_cache');

        return { ...user, id: docRef.id };
    } catch (e) {
        throw e;
    }
};

/**
 * Elimina un usuario por su ID.
 * 
 * @param {string} userId - ID del documento en Firestore.
 * @returns {Promise<boolean>} - True si tuvo éxito.
 */
export const deleteUser = async (userId: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, USERS_COLLECTION, userId));

        const currentUser = getCurrentUserAudit();
        await logEvent({
            type: 'deletion',
            user: currentUser,
            entity: 'user',
            entityId: userId,
            description: `Usuario eliminado (ID: ${userId})`
        });

        // Invalidar caché tras eliminación
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        throw error;
    }
};

// ============================================================================
// 4. UTILITY FUNCTIONS
// ============================================================================
/**
 * Verifica si un DNI ya existe en la base de datos para evitar duplicados.
 *
 * @param {string} dni - El DNI a buscar.
 * @returns {Promise<boolean>} - True si existe, False si no.
 */
export const checkDniExists = async (dni: string): Promise<boolean> => {
    try {
        // ✅ OPTIMIZACIÓN: Hacer una query directa en lugar de descargar todos los usuarios.
        const q = query(collection(db, USERS_COLLECTION), where('dni', '==', dni));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (error) {
        return false;
    }
};

/**
 * Actualiza el estado (habilitado/deshabilitado) de un usuario en una categoría específica o globalmente.
 * 
 * @param {string} userId - ID del usuario.
 * @param {string} newStatus - Nuevo estado ('habilitado' o 'deshabilitado').
 * @param {string|null} category - Categoría específica a actualizar. Si es null, actualiza estado global (legacy).
 * @returns {Promise<boolean>}
 */
export const updateUserStatus = async (userId: string, newStatus: string, category: string | null): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);

        if (category) {
            // Lógica para manejar estados por categoría
            // Primero obtenemos el usuario actual para no sobrescribir otros estados
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            if (!userData) throw new Error("User not found");

            // Obtenemos o inicializamos el objeto de estados por categoría
            const categoryStatuses = (userData.categoryStatuses as Record<string, string>) || {};
            categoryStatuses[category] = newStatus; // Actualizamos solo la categoría solicitada

            // Guardamos el objeto actualizado
            await updateDoc(userRef, {
                categoryStatuses: categoryStatuses,
                // Opcional: Mantener status legacy actualizado si se deseara sincronizar
                // status: newStatus 
            });
        } else {
            // Comportamiento global legado (para usuarios sin categorías o compatibilidad antigua)
            await updateDoc(userRef, { status: newStatus });
        }

        // Invalidamos caché para reflejar cambios
        localStorage.removeItem('users_cache');

        const currentUser = getCurrentUserAudit();
        await logEvent({
            type: 'modification',
            user: currentUser,
            entity: 'user',
            entityId: userId,
            description: `Estado actualizado a ${newStatus} ${category ? `en categoría ${category}` : 'global'}`
        });

        return true;
    } catch (error) {
        throw error;
    }
};

/**
 * ¡PELIGRO! Borra TODOS los usuarios de la base de datos.
 * Se usa para el botón "RESET TOTAL" o limpieza masiva.
 * 
 * @returns {Promise<boolean>}
 */
export const clearAllUsers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        // Genera un array de promesas de eliminación para ejecutar en paralelo
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        throw error;
    }
};

/**
 * Actualiza el nombre de un equipo en todos los usuarios que pertenezcan a él.
 * Utiliza 'writeBatch' para realizar múltiples escrituras de forma atómica.
 * 
 * @param {string} oldName - Nombre actual del equipo.
 * @param {string} newName - Nuevo nombre del equipo.
 * @returns {Promise<boolean>}
 */
export const updateTeamName = async (oldName: string, newName: string): Promise<boolean> => {
    try {
        // Buscamos todos los usuarios de ese equipo
        const q = query(collection(db, USERS_COLLECTION), where("team", "==", oldName));
        const querySnapshot = await getDocs(q);

        // Iniciamos un lote de escritura (batch)
        const batch = writeBatch(db);

        // Agregamos cada operación de actualización al lote
        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { team: newName });
        });

        // Ejecutamos todas las actualizaciones juntas
        await batch.commit();

        localStorage.removeItem('users_cache');

        const currentUser = getCurrentUserAudit();
        await logEvent({
            type: 'modification',
            user: currentUser,
            entity: 'team',
            entityId: oldName,
            description: `Equipo renombrado de ${oldName} a ${newName}`
        });

        return true;
    } catch (error) {
        throw error;
    }
};

/**
 * Actualiza el nombre de una categoría para un equipo específico.
 * 
 * @param {string} teamName - Nombre del equipo.
 * @param {string} oldCat - Nombre anterior de la categoría.
 * @param {string} newCat - Nuevo nombre de la categoría.
 * @returns {Promise<boolean>}
 */
export const updateTeamCategory = async (teamName: string, oldCat: string, newCat: string): Promise<boolean> => {
    try {
        // Query compuesta: Equipo Y Categoría
        const q = query(collection(db, USERS_COLLECTION),
            where("team", "==", teamName),
            where("category", "==", oldCat)
        );
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);

        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { category: newCat });
        });

        await batch.commit();
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        throw error;
    }
};

// --- V2 (MediaPipe) ---
// Funciones placeholder para una futura versión o migraciones, posiblemente con vectores faciales distintos.

export const getUsersV2 = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_V2_COLLECTION));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        // Error getting users V2
        return [];
    }
};

export const saveUserV2 = async (user: any): Promise<User> => {
    try {
        const docRef = await addDoc(collection(db, USERS_V2_COLLECTION), user);
        return { ...user, id: docRef.id };
    } catch (e) {
        // Error adding user V2
        throw e;
    }
};

export const clearAllUsersV2 = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_V2_COLLECTION));
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        return true;
    } catch (error) {
        // Error clearing database V2
        throw error;
    }
};

/**
 * Actualiza cualquier campo de un usuario de forma genérica.
 * 
 * @param {string} userId - ID del usuario.
 * @param {Object} data - Objeto con los campos a actualizar.
 * @returns {Promise<boolean>}
 */
export const updateUser = async (userId: string, data: Partial<User>): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, data);
        localStorage.removeItem('users_cache');

        const currentUser = getCurrentUserAudit();
        await logEvent({
            type: 'modification',
            user: currentUser,
            entity: 'user',
            entityId: userId,
            description: `Campos actualizados: ${Object.keys(data).join(', ')}`
        });

        return true;
    } catch (error) {
        // Error updating user
        throw error;
    }
};

/**
 * Gestiona la lógica compleja de movimiento o adición de categorías para un usuario (Multicategoría).
 * Maneja arrays de categorías y mantiene la compatibilidad con el campo 'category' (singular).
 * 
 * @param {string} userId - ID del usuario.
 * @param {string|null} oldCat - Categoría de origen (para "mover") o null (para "añadir").
 * @param {string} newCat - Categoría de destino.
 * @param {string} mode - 'move' (reemplazar), 'add' (agregar), 'remove' (quitar).
 */
export const updateUserCategories = async (userId: string, oldCat: string | null, newCat: string | null, mode: 'move' | 'add' | 'remove'): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) throw new Error("Usuario no encontrado");
        const user = userSnap.data();

        // Obtener categorías actuales o crear array si solo existe el campo legado string
        let categories = Array.isArray(user.categories) ? [...user.categories] : (user.category ? [user.category] : []);

        // Lógica según el modo de operación
        if (mode === 'move') {
            // Reemplaza la categoría vieja por la nueva en el array
            if (oldCat) {
                categories = categories.map(c => c === oldCat ? newCat : c);
            } else {
                // Si no había vieja, simplemente se establece la nueva
                categories = [newCat];
            }
        } else if (mode === 'add') {
            // Agrega solo si no existe ya
            if (!categories.includes(newCat)) {
                categories.push(newCat);
            }
        } else if (mode === 'remove') {
            // Filtra para eliminar la categoría
            categories = categories.filter(c => c !== oldCat);
        }

        // Limpieza: eliminar duplicados y valores nulos/vacíos
        const finalCategories = [...new Set(categories)].filter(Boolean);

        // Actualizamos en Firestore
        // Importante: Actualizamos 'category' (singular) con el primer elemento para mantener compatibilidad
        await updateDoc(userRef, {
            categories: finalCategories,
            category: finalCategories[0] || ''
        });

        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        // Error updating user categories
        throw error;
    }
};

/**
 * Elimina todos los jugadores que pertenecen a un equipo específico.
 * 
 * @param {string} teamName - Nombre del equipo a eliminar.
 * @returns {Promise<number>} - Cantidad de jugadores eliminados.
 */
export const deletePlayersByTeam = async (teamName: string): Promise<number> => {
    try {
        const q = query(collection(db, USERS_COLLECTION), where("team", "==", teamName));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;

        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            localStorage.removeItem('users_cache');
        }

        return count;
    } catch (error) {
        console.error("Error deleting players by team:", error);
        throw error;
    }
};
