import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, deleteDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';

const TOURNAMENTS_COLLECTION = 'tournaments';
const MATCHES_COLLECTION = 'matches';

// --- Tournaments ---
export const getTournaments = async () => {
    try {
        const q = query(collection(db, TOURNAMENTS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.error("Error getting tournaments: ", error);
        return [];
    }
};

export const subscribeToTournaments = (callback) => {
    const q = query(collection(db, TOURNAMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const tournaments = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(tournaments);
    });
};

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

export const deleteTournament = async (tournamentId) => {
    try {
        await deleteDoc(doc(db, TOURNAMENTS_COLLECTION, tournamentId));
        return true;
    } catch (error) {
        console.error("Error deleting tournament: ", error);
        throw error;
    }
};

// --- Matches ---
export const getMatch = async (matchId) => {
    try {
        const docRef = doc(db, MATCHES_COLLECTION, matchId);
        const docSnap = await getDocs(query(collection(db, MATCHES_COLLECTION), where('__name__', '==', matchId))); // Hack to use getDocs logic or just getDoc
        // Better:
        const { getDoc } = await import('firebase/firestore');
        const snap = await getDoc(docRef);
        if (snap.exists()) return { ...snap.data(), id: snap.id };
        return null;
    } catch (error) {
        console.error("Error getting match: ", error);
        return null;
    }
};

export const subscribeToMatch = (matchId, callback) => {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId);
    return onSnapshot(matchRef, (doc) => {
        if (doc.exists()) {
            callback({ ...doc.data(), id: doc.id });
        }
    });
};

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

export const subscribeToMatches = (callback) => {
    return onSnapshot(collection(db, MATCHES_COLLECTION), (querySnapshot) => {
        const matches = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(matches);
    });
};

export const saveMatch = async (match) => {
    try {
        const docRef = await addDoc(collection(db, MATCHES_COLLECTION), {
            ...match,
            status: 'scheduled', // scheduled, live, halftime, finished
            score: { a: 0, b: 0 },
            createdAt: new Date()
        });
        return { ...match, id: docRef.id };
    } catch (e) {
        console.error("Error adding match: ", e);
        throw e;
    }
};

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

export const deleteMatch = async (matchId) => {
    try {
        await deleteDoc(doc(db, MATCHES_COLLECTION, matchId));
        return true;
    } catch (error) {
        console.error("Error deleting match:", error);
        throw error;
    }
};
