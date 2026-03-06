import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, onSnapshot, query, where, getDoc, deleteDoc } from 'firebase/firestore';

const TEAMS_COLLECTION = 'teams';

export interface Team {
    id: string; // Team name or slug
    name: string;
    logoUrl?: string; // URL from Firebase Storage
    adccLogoUrl?: string; // Original URL from ADCC
    categories?: string[]; // Listed categories for this team
    lastUpdated?: number;
}

/**
 * Obtiene todos los equipos.
 */
export const getTeams = async (): Promise<Team[]> => {
    const querySnapshot = await getDocs(collection(db, TEAMS_COLLECTION));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Team));
};

/**
 * Obtiene un equipo por su ID.
 */
export const getTeam = async (id: string): Promise<Team | null> => {
    const docRef = doc(db, TEAMS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { ...docSnap.data(), id: docSnap.id } as Team;
};

/**
 * Suscribe a los cambios en la colección de equipos.
 */
export const subscribeToTeams = (callback: (teams: Team[]) => void) => {
    return onSnapshot(collection(db, TEAMS_COLLECTION), (querySnapshot) => {
        const teams = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Team));
        callback(teams);
    });
};

/**
 * Guarda o actualiza un equipo.
 */
export const saveTeam = async (team: Team) => {
    const teamRef = doc(db, TEAMS_COLLECTION, team.id);
    await setDoc(teamRef, {
        ...team,
        lastUpdated: Date.now()
    }, { merge: true });
};

/**
 * Elimina un equipo.
 */
export const deleteTeam = async (id: string) => {
    const teamRef = doc(db, TEAMS_COLLECTION, id);
    await deleteDoc(teamRef);
};
