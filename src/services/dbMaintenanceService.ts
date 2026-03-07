import { collection, getDocs, query, where, writeBatch, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { searchADCCPlayer } from './adccService';

export interface MaintenanceLog {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: Date;
}

export class DbMaintenanceService {
    private logs: MaintenanceLog[] = [];

    private addLog(type: MaintenanceLog['type'], message: string) {
        this.logs.push({ type, message, timestamp: new Date() });
        console.log(`[Maintenance] ${type.toUpperCase()}: ${message}`);
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    /**
     * Unifica equipos duplicados por nombre.
     */
    async unifyTeams() {
        this.addLog('info', 'Iniciando unificación de equipos...');
        try {
            const teamsRef = collection(db, 'teams');
            const snapshot = await getDocs(teamsRef);
            const teams = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));

            const teamMap = new Map<string, any[]>();
            teams.forEach(team => {
                const name = team.nombre?.trim().toLowerCase();
                if (!name) return;
                if (!teamMap.has(name)) teamMap.set(name, []);
                teamMap.get(name)!.push(team);
            });

            let unifiedCount = 0;
            for (const [name, duplicates] of teamMap.entries()) {
                if (duplicates.length > 1) {
                    this.addLog('warning', `Encontrados ${duplicates.length} duplicados para el equipo: ${name}`);

                    // Elegir el "principal" (el que tenga id numérico si es posible, o el primero)
                    const principal = duplicates.find(t => !isNaN(Number(t.id))) || duplicates[0];
                    const others = duplicates.filter(t => t.id !== principal.id);

                    const batch = writeBatch(db);

                    // Unificar categorías
                    const allCategories = new Set<string>(principal.categories || []);
                    others.forEach(o => {
                        (o.categories || []).forEach((c: string) => allCategories.add(c));
                    });

                    if (allCategories.size > (principal.categories?.length || 0)) {
                        batch.update(doc(db, 'teams', principal.id), {
                            categories: Array.from(allCategories)
                        });
                    }

                    // Mover jugadores de los otros equipos al principal
                    for (const other of others) {
                        const playersRef = collection(db, 'users');
                        const q = query(playersRef, where('team', '==', other.nombre));
                        const playerSnap = await getDocs(q);

                        playerSnap.forEach(pDoc => {
                            batch.update(pDoc.ref, {
                                team: principal.nombre,
                                teamId: principal.id
                            });
                        });

                        // Eliminar el equipo duplicado
                        batch.delete(doc(db, 'teams', other.id));
                    }

                    await batch.commit();
                    unifiedCount++;
                    this.addLog('success', `Equipo '${principal.nombre}' unificado.`);
                }
            }

            this.addLog('success', `Unificación de equipos finalizada. ${unifiedCount} grupos unificados.`);
        } catch (error: any) {
            this.addLog('error', `Error en unificación de equipos: ${error.message}`);
            throw error;
        }
    }

    /**
     * Unifica jugadores duplicados por DNI.
     */
    async unifyPlayers() {
        this.addLog('info', 'Iniciando unificación de jugadores por DNI...');
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            const users = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));

            const dniMap = new Map<string, any[]>();
            users.forEach(user => {
                const dni = user.dni?.toString().trim();
                if (!dni || dni === '0') return;
                if (!dniMap.has(dni)) dniMap.set(dni, []);
                dniMap.get(dni)!.push(user);
            });

            let unifiedCount = 0;
            for (const [dni, duplicates] of dniMap.entries()) {
                if (duplicates.length > 1) {
                    this.addLog('warning', `DNI duplicado detectado: ${dni} (${duplicates.length} registros)`);

                    // Elegir el principal: el que tenga foto y face_api (biometría)
                    const principal = duplicates.find(u => u.photo && u.face_api) ||
                        duplicates.find(u => u.photo) ||
                        duplicates[0];

                    const others = duplicates.filter(u => u.id !== principal.id);
                    const batch = writeBatch(db);

                    // Unificar categorías
                    const allCategories = new Set<string>(principal.categories || []);
                    if (principal.category) allCategories.add(principal.category);

                    others.forEach(o => {
                        (o.categories || []).forEach((c: string) => allCategories.add(c));
                        if (o.category) allCategories.add(o.category);
                    });

                    // Actualizar principal
                    batch.update(doc(db, 'users', principal.id), {
                        categories: Array.from(allCategories),
                        // Asegurar que tenga el campo legacy category si es necesario
                        category: principal.category || Array.from(allCategories)[0] || ''
                    });

                    // Eliminar duplicados
                    others.forEach(o => {
                        batch.delete(doc(db, 'users', o.id));
                    });

                    await batch.commit();
                    unifiedCount++;
                    this.addLog('success', `Jugador DNI ${dni} (${principal.nombre} ${principal.apellido}) unificado.`);
                }
            }

            this.addLog('success', `Unificación de jugadores finalizada. ${unifiedCount} jugadores unificados.`);
        } catch (error: any) {
            this.addLog('error', `Error en unificación de jugadores: ${error.message}`);
            throw error;
        }
    }

    /**
     * Actualiza fotos faltantes desde la API de ADCC.
     */
    async updateMissingPhotos() {
        this.addLog('info', 'Buscando fotos faltantes en API ADCC...');
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('photo', '==', null));
            const snapshot = await getDocs(q);

            this.addLog('info', `Encontrados ${snapshot.size} jugadores sin foto.`);

            let updatedCount = 0;
            for (const uDoc of snapshot.docs) {
                const user = uDoc.data();
                const dni = user.dni?.toString();

                if (!dni) continue;

                try {
                    const adccPlayers = await searchADCCPlayer(dni);
                    const adccPlayer = adccPlayers.find(p => p.dni.toString() === dni);

                    if (adccPlayer && adccPlayer.imagen_url) {
                        await updateDoc(uDoc.ref, {
                            photo: adccPlayer.imagen_url,
                            lastPhotoUpdate: new Date().toISOString()
                        });
                        updatedCount++;
                        this.addLog('success', `Foto actualizada para ${user.nombre} ${user.apellido} (DNI: ${dni})`);
                    }
                } catch (e) {
                    this.addLog('warning', `No se pudo obtener foto para DNI ${dni}: ${e instanceof Error ? e.message : 'Error desconocido'}`);
                }

                // Pequeño delay para no saturar la API
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            this.addLog('success', `Proceso de fotos finalizado. ${updatedCount} fotos nuevas añadidas.`);
        } catch (error: any) {
            this.addLog('error', `Error actualizando fotos: ${error.message}`);
            throw error;
        }
    }
}

export const dbMaintenanceService = new DbMaintenanceService();
