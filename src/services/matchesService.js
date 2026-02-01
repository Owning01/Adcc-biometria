import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, deleteDoc, doc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Nombres de las colecciones en Firestore
const TOURNAMENTS_COLLECTION = 'tournaments';
const MATCHES_COLLECTION = 'matches';

// --- Torneos (Tournaments) ---

/**
 * Obtiene la lista de todos los torneos, ordenados por fecha de creación (descendente).
 * 
 * @returns {Promise<Array>} - Array de objetos torneo.
 */
export const getTournaments = async () => {
    try {
        const q = query(collection(db, TOURNAMENTS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        // Mapped to include ID
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.error("Error getting tournaments: ", error);
        return [];
    }
};

/**
 * Suscribe a la lista de torneos para recibir actualizaciones en tiempo real.
 * 
 * @param {Function} callback - Función a ejecutar con los datos actualizados.
 * @returns {Function} - Unsubscribe function.
 */
export const subscribeToTournaments = (callback) => {
    const q = query(collection(db, TOURNAMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const tournaments = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(tournaments);
    });
};

/**
 * Crea un nuevo torneo en la base de datos.
 * 
 * @param {Object} tournament - Datos del torneo.
 * @returns {Promise<Object>} - El torneo creado con su ID.
 */
export const saveTournament = async (tournament) => {
    try {
        const docRef = await addDoc(collection(db, TOURNAMENTS_COLLECTION), {
            ...tournament,
            createdAt: new Date()
        });
        return { ...tournament, id: docRef.id };
    } catch (e) {
        console.error("Error adding tournament: ", e);
        throw e;
    }
};

/**
 * Elimina un torneo permanentemente.
 * Note: Esto no elimina automáticamente los partidos asociados (debería implementarse si se requiere limpieza en cascada).
 * 
 * @param {string} tournamentId 
 * @returns {Promise<boolean>}
 */
export const deleteTournament = async (tournamentId) => {
    try {
        await deleteDoc(doc(db, TOURNAMENTS_COLLECTION, tournamentId));
        return true;
    } catch (error) {
        console.error("Error deleting tournament: ", error);
        throw error;
    }
};

// --- Partidos (Matches) ---

/**
 * Obtiene un partido individual por su ID.
 * Intenta usar un hack con getDocs primero, y luego la forma correcta con getDoc.
 * 
 * @param {string} matchId 
 * @returns {Promise<Object|null>}
 */
export const getMatch = async (matchId) => {
    try {
        const docRef = doc(db, MATCHES_COLLECTION, matchId);
        // Nota: La siguiente línea parece redundante si usamos getDoc abajo, pero se mantiene por compatibilidad o debugging previo.
        const docSnap = await getDocs(query(collection(db, MATCHES_COLLECTION), where('__name__', '==', matchId)));

        // Import dinámico (podría moverse arriba) para asegurar que tenemos getDoc
        const { getDoc } = await import('firebase/firestore');
        const snap = await getDoc(docRef);

        if (snap.exists()) return { ...snap.data(), id: snap.id };
        return null;
    } catch (error) {
        console.error("Error getting match: ", error);
        return null;
    }
};

/**
 * Suscribe a un solo partido para recibir actualizaciones en vivo (goles, tiempo, tarjetas).
 * 
 * @param {string} matchId 
 * @param {Function} callback 
 * @returns {Function} - Unsubscribe.
 */
export const subscribeToMatch = (matchId, callback) => {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId);
    return onSnapshot(matchRef, (doc) => {
        if (doc.exists()) {
            callback({ ...doc.data(), id: doc.id });
        }
    });
};

/**
 * Obtiene partidos, opcionalmente filtrados por torneo.
 * 
 * @param {string|null} tournamentId - ID del torneo para filtrar (opcional).
 * @returns {Promise<Array>}
 */
export const getMatches = async (tournamentId = null) => {
    try {
        let q = collection(db, MATCHES_COLLECTION);
        if (tournamentId) {
            q = query(q, where('tournamentId', '==', tournamentId));
        }
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.error("Error getting matches: ", error);
        return [];
    }
};

/**
 * Suscribe a la colección completa de partidos.
 * Útil para la pantalla de Home o lista general.
 * 
 * @param {Function} callback 
 * @returns {Function}
 */
export const subscribeToMatches = (callback) => {
    return onSnapshot(collection(db, MATCHES_COLLECTION), (querySnapshot) => {
        const matches = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(matches);
    });
};

/**
 * Crea un nuevo partido con estado inicial 'scheduled' y marcador 0-0.
 * 
 * @param {Object} match - Datos del partido (equipos, fecha, etc).
 * @returns {Promise<Object>}
 */
export const saveMatch = async (match) => {
    try {
        const docRef = await addDoc(collection(db, MATCHES_COLLECTION), {
            ...match,
            status: 'scheduled', // Estados: scheduled, live, halftime, finished
            score: { a: 0, b: 0 },
            createdAt: new Date()
        });
        return { ...match, id: docRef.id };
    } catch (e) {
        console.error("Error adding match: ", e);
        throw e;
    }
};

/**
 * Actualiza datos de un partido (goles, estado, eventos).
 * 
 * @param {string} matchId 
 * @param {Object} data - Campos a actualizar.
 * @returns {Promise<boolean>}
 */
export const updateMatch = async (matchId, data) => {
    try {
        const matchRef = doc(db, MATCHES_COLLECTION, matchId);
        await updateDoc(matchRef, data);
        return true;
    } catch (error) {
        console.error("Error updating match:", error);
        throw error;
    }
};

/**
 * Actualiza datos de un torneo.
 * 
 * @param {string} tournamentId 
 * @param {Object} data 
 * @returns {Promise<boolean>}
 */
export const updateTournament = async (tournamentId, data) => {
    try {
        const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, tournamentId);
        await updateDoc(tournamentRef, data);
        return true;
    } catch (error) {
        console.error("Error updating tournament:", error);
        throw error;
    }
};

/**
 * Elimina un partido.
 * 
 * @param {string} matchId 
 * @returns {Promise<boolean>}
 */
export const deleteMatch = async (matchId) => {
    try {
        await deleteDoc(doc(db, MATCHES_COLLECTION, matchId));
        return true;
    } catch (error) {
        console.error("Error deleting match:", error);
        throw error;
    }
};

/**
 * Registra un evento de partido (gol, tarjeta, sub, inicio, fin) 
 * utilizando un enfoque de Event Sourcing (Append-only).
 * Genera un UUID local para asegurar idempotencia offline.
 * 
 * @param {string} matchId 
 * @param {Object} eventData - { type, team, playerId, playerName, minute, ... }
 * @returns {Promise<string>} - ID del evento creado.
 */
export const recordMatchEvent = async (matchId, eventData) => {
    try {
        const eventId = uuidv4();
        const eventRef = collection(db, MATCHES_COLLECTION, matchId, 'events');

        const fullEvent = {
            ...eventData,
            eventId, // ID generado localmente
            serverTimestamp: serverTimestamp(),
            localTimestamp: new Date().toISOString(),
            status: 'pending' // Firestore cambiará esto a 'synced' implícitamente
        };

        await addDoc(eventRef, fullEvent);
        return eventId;
    } catch (error) {
        console.error("Error recording match event:", error);
        throw error;
    }
};

/**
 * Suscribe a los eventos de un partido en tiempo real.
 * 
 * @param {string} matchId 
 * @param {Function} callback 
 * @returns {Function} - Unsubscribe.
 */
export const subscribeToMatchEvents = (matchId, callback) => {
    const eventsRef = collection(db, MATCHES_COLLECTION, matchId, 'events');
    const q = query(eventsRef, orderBy('serverTimestamp', 'asc'));

    return onSnapshot(q, (querySnapshot) => {
        const events = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            // Fallback para timestamp si aún no llega del servidor
            timestamp: doc.data().serverTimestamp?.toDate() || new Date(doc.data().localTimestamp)
        }));
        callback(events);
    });
};
