import { initializeApp } from "firebase/app";
import {
    getFirestore,
    enableMultiTabIndexedDbPersistence,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDF6zB5DtXdyPkGPHbbvVNZ9KOUXEh7nNk",
    authDomain: "adccbiometric.firebaseapp.com",
    projectId: "adccbiometric",
    storageBucket: "adccbiometric.firebasestorage.app",
    messagingSenderId: "794425851145",
    appId: "1:794425851145:web:8cc36940a07eb6ea2567d8",
    measurementId: "G-HRQJXESGHH"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

/**
 * Inicializamos Firestore con persistencia local habilitada.
 * Esto permite que la app funcione sin internet (Modo Offline).
 * Los datos se guardan en IndexedDB y se sincronizan automáticamente al recuperar conexión.
 */
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);

export { db, auth };
