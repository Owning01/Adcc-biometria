
import { db } from './src/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function diagnose() {
    console.log("--- Diagnóstico de Firestore ---");

    const collections = ['matches', 'tournaments', 'users'];

    for (const collName of collections) {
        try {
            console.log(`\nRevisando colección: ${collName}`);
            const q = query(collection(db, collName), limit(5));
            const snap = await getDocs(q);
            console.log(`Total documentos encontrados (limit 5): ${snap.size}`);
            snap.forEach(doc => {
                const data = doc.data();
                console.log(`Documento ID: ${doc.id}`);
                console.log(`  createdAt: ${data.createdAt}`);
                console.log(`  Campos: ${Object.keys(data).join(', ')}`);
            });
        } catch (e) {
            console.error(`Error en ${collName}:`, e);
        }
    }
}

// Para ejecutarlo podemos pegarlo en un useEffect temporal o usar un script de node (si hay configuración de firebase-admin)
// Pero como estamos en un entorno web, lo mejor es crear un componente temporal de diagnóstico.
