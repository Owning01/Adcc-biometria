import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';

const AUDIT_COLLECTION = 'audit_logs';

export interface AuditLog {
    id?: string;
    timestamp: Timestamp | any;
    type: 'access' | 'modification' | 'deletion';
    user: {
        uid: string;
        name: string;
        role: string;
    };
    entity?: string;
    entityId?: string;
    description: string;
    details?: any;
}

/**
 * Registra un evento en el historial de auditoría.
 */
export const logEvent = async (params: Omit<AuditLog, 'timestamp'>) => {
    try {
        await addDoc(collection(db, AUDIT_COLLECTION), {
            ...params,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging event:", error);
    }
};

/**
 * Obtiene los últimos registros de auditoría.
 */
export const getAuditLogs = async (maxResults = 100): Promise<AuditLog[]> => {
    try {
        const q = query(
            collection(db, AUDIT_COLLECTION),
            orderBy('timestamp', 'desc'),
            limit(maxResults)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AuditLog));
    } catch (error) {
        console.error("Error getting audit logs:", error);
        return [];
    }
};

/**
 * Helper para obtener datos básicos del usuario actual para auditoría.
 */
export const getCurrentUserAudit = () => {
    const { auth } = require('../firebase');
    const user = auth.currentUser;
    if (!user) return { uid: 'anonymous', name: 'Anónimo', role: 'public' };

    // El rol es difícil de obtener síncronamente aquí sin el estado de React, 
    // pero podemos intentar inferirlo de los emails como en App.tsx o dejarlo como 'user'
    return {
        uid: user.uid,
        name: user.displayName || user.email || 'Usuario',
        role: 'authed' // El rol exacto se podría pasar si es necesario
    };
};

