import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDF6zB5DtXdyPkGPHbbvVNZ9KOUXEh7nNk",
    authDomain: "adccbiometric.firebaseapp.com",
    projectId: "adccbiometric",
    storageBucket: "adccbiometric.firebasestorage.app",
    messagingSenderId: "794425851145",
    appId: "1:794425851145:web:8cc36940a07eb6ea2567d8",
    measurementId: "G-HRQJXESGHH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteCollection(collectionName) {
    try {
        console.log(`Conectando a Firestore para limpiar la colección: ${collectionName}...`);
        const q = collection(db, collectionName);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('La colección ya está vacía.');
            process.exit(0);
        }

        console.log(`Encontrados ${snapshot.size} documentos. Iniciando borrado masivo...`);

        const deletions = snapshot.docs.map(async (d) => {
            await deleteDoc(doc(db, collectionName, d.id));
            console.log(`   ✔ Borrado: ${d.id}`);
        });

        await Promise.all(deletions);

        console.log('\n✨ Limpieza completada con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante la limpieza:', err);
        process.exit(1);
    }
}

deleteCollection('matches');
