
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
    apiKey: "AIzaSyBJT3nG7tRsr8MsYX8D3yK5G2TPG060Iws",
    authDomain: "recofacial-7cea1.firebaseapp.com",
    projectId: "recofacial-7cea1",
    storageBucket: "recofacial-7cea1.firebasestorage.app",
    messagingSenderId: "556775203131",
    appId: "1:556775203131:web:01536f40ad02a2c3c0171e",
    measurementId: "G-K8SP4ZQMRY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
