import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, query, where, getDoc } from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const USERS_V2_COLLECTION = 'users_v2';

export const getUsers = async (forceRefresh = false) => {
    try {
        // ✅ OPTIMIZACIÓN: Cachear usuarios en localStorage
        const cached = localStorage.getItem('users_cache');
        if (cached && !forceRefresh) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 10 * 60 * 1000) {
                console.log('📦 Usando cache de usuarios');
                return data;
            }
        }

        console.log('🔄 Cargando usuarios desde Firestore' + (forceRefresh ? ' (FORZADO)' : ''));
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id }; // Forzamos que el id sea siempre el de Firestore
        });

        localStorage.setItem('users_cache', JSON.stringify({
            data: users,
            timestamp: Date.now()
        }));

        return users;
    } catch (error) {
        console.error("Error getting users: ", error);

        // FALLBACK OFF-LINE: Si falla la red, usamos el caché aunque esté vencido
        const cached = localStorage.getItem('users_cache');
        if (cached) {
            console.warn("⚠️ Sin conexión: Usando datos en caché (posiblemente antiguos)");
            const { data } = JSON.parse(cached);
            return data;
        }

        return [];
    }
};

export const subscribeToUsers = (callback) => {
    return onSnapshot(collection(db, USERS_COLLECTION), (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id };
        });

        // Mantener el cache actualizado con los datos reales
        localStorage.setItem('users_cache', JSON.stringify({
            data: users,
            timestamp: Date.now()
        }));

        callback(users);
    });
};

export const saveUser = async (user) => {
    try {
        const docRef = await addDoc(collection(db, USERS_COLLECTION), user);
        console.log("User written with ID: ", docRef.id);

        // ✅ OPTIMIZACIÓN: Invalidar cache al guardar nuevo usuario
        localStorage.removeItem('users_cache');
        console.log('🗑️ Cache de usuarios invalidado');

        return { ...user, id: docRef.id };
    } catch (e) {
        console.error("Error adding user: ", e);
        throw e;
    }
};

export const deleteUser = async (userId) => {
    try {
        await deleteDoc(doc(db, USERS_COLLECTION, userId));
        // ✅ OPTIMIZACIÓN: Invalidar cache al eliminar usuario
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error deleting user: ", error);
        throw error;
    }
};

export const checkDniExists = async (dni) => {
    try {
        const users = await getUsers();
        return users.some(u => u.dni === dni);
    } catch (error) {
        console.error("Error checking DNI:", error);
        return false;
    }
};

export const updateUserStatus = async (userId, newStatus, category) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);

        if (category) {
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            const categoryStatuses = userData.categoryStatuses || {};
            categoryStatuses[category] = newStatus;

            await updateDoc(userRef, {
                categoryStatuses: categoryStatuses,
                // Opcional: Mantener status legacy actualizado si es la categoría principal
                status: newStatus
            });
        } else {
            // Comportamiento global legado
            await updateDoc(userRef, { status: newStatus });
        }

        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error updating user status:", error);
        throw error;
    }
};

export const clearAllUsers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error clearing database:", error);
        throw error;
    }
};

export const updateTeamName = async (oldName, newName) => {
    try {
        const q = query(collection(db, USERS_COLLECTION), where("team", "==", oldName));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);

        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { team: newName });
        });

        await batch.commit();
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error updating team name:", error);
        throw error;
    }
};

export const updateTeamCategory = async (teamName, oldCat, newCat) => {
    try {
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
        console.error("Error updating team category:", error);
        throw error;
    }
};

// --- V2 (MediaPipe) ---
export const getUsersV2 = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_V2_COLLECTION));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.error("Error getting users V2: ", error);
        return [];
    }
};

export const saveUserV2 = async (user) => {
    try {
        const docRef = await addDoc(collection(db, USERS_V2_COLLECTION), user);
        return { ...user, id: docRef.id };
    } catch (e) {
        console.error("Error adding user V2: ", e);
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
        console.error("Error clearing database V2:", error);
        throw error;
    }
};

export const updateUser = async (userId, data) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, data);
        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
};

/**
 * Gestiona el movimiento o adición de categorías para un usuario.
 * @param {string} userId 
 * @param {string} oldCat Categoría de origen (para "mover") o null (para "añadir")
 * @param {string} newCat Categoría de destino
 * @param {string} mode 'move' o 'add'
 */
export const updateUserCategories = async (userId, oldCat, newCat, mode) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) throw new Error("Usuario no encontrado");
        const user = userSnap.data();

        let categories = Array.isArray(user.categories) ? [...user.categories] : (user.category ? [user.category] : []);

        if (mode === 'move') {
            if (oldCat) {
                categories = categories.map(c => c === oldCat ? newCat : c);
            } else {
                categories = [newCat];
            }
        } else if (mode === 'add') {
            if (!categories.includes(newCat)) {
                categories.push(newCat);
            }
        } else if (mode === 'remove') {
            categories = categories.filter(c => c !== oldCat);
            // Si se queda sin categorías, podemos dejar un string vacío o manejarlo según lógica de negocio
            // En este caso, si queda vacío, la compatibilidad legacy pondrá ''
        }

        const finalCategories = [...new Set(categories)].filter(Boolean);

        await updateDoc(userRef, {
            categories: finalCategories,
            category: finalCategories[0] || ''
        });

        localStorage.removeItem('users_cache');
        return true;
    } catch (error) {
        console.error("Error updating user categories:", error);
        throw error;
    }
};
