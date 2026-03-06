import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import https from "https";

// Configuración de Firebase obtenida de src/firebase.ts
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

// Directorio de destino solicitado por el usuario
const downloadPath = "G:\\Descargas\\fotos prueba adcc";

/**
 * Descarga una imagen desde una URL y la guarda en el sistema de archivos.
 */
async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                // Manejo básico de redirecciones
                if (response.statusCode === 301 || response.statusCode === 302) {
                    downloadImage(response.headers.location, filename).then(resolve).catch(reject);
                    return;
                }
                reject(new Error(`Error al obtener '${url}' (Código: ${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            fs.unlink(filename, () => reject(err));
        });
    });
}

/**
 * Adapta la URL para eludir bloqueos de CORS o 403 (mismo método que la app).
 */
function getAdccImageUrl(url) {
    if (!url) return null;
    if (url.includes('adcc.com.ar')) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=https://ui-avatars.com/api/?name=ADCC`;
    }
    return url;
}

async function start() {
    console.log("=== SCRIPT DE DESCARGA DE FOTOS ADCC ===");

    try {
        if (!fs.existsSync(downloadPath)) {
            console.log(`Creando directorio: ${downloadPath}`);
            fs.mkdirSync(downloadPath, { recursive: true });
        }
    } catch (e) {
        console.error(`ERROR: No se pudo crear el directorio ${downloadPath}.`);
        console.error("Asegúrate de que la unidad G: esté conectada y tengas permisos de escritura.");
        process.exit(1);
    }

    console.log("Consultando base de datos Firebase...");
    let usersSnapshot;
    try {
        usersSnapshot = await getDocs(collection(db, "users"));
    } catch (e) {
        console.error("ERROR de conexión a Firebase:", e.message);
        process.exit(1);
    }

    const count = usersSnapshot.size;
    console.log(`Encontrados ${count} registros de jugadores.`);

    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    const docs = usersSnapshot.docs;
    for (let i = 0; i < docs.length; i++) {
        const userData = docs[i].data();
        const photoUrl = userData.photoURL || userData.photo;

        if (photoUrl) {
            const finalUrl = getAdccImageUrl(photoUrl);
            const dni = userData.dni || docs[i].id;
            // Limpiar nombre de caracteres no válidos para archivos
            const name = (userData.name || "sin-nombre").trim().replace(/[/\\?%*:|"<>]/g, '-');

            // Determinar extensión
            let ext = 'jpg';
            const lowerUrl = photoUrl.toLowerCase();
            if (lowerUrl.includes('.png')) ext = 'png';
            else if (lowerUrl.includes('.jpeg')) ext = 'jpeg';
            else if (lowerUrl.includes('.webp')) ext = 'webp';

            const filename = path.join(downloadPath, `${dni}_${name}.${ext}`);

            try {
                process.stdout.write(`[${i + 1}/${count}] ${name}... `);
                await downloadImage(finalUrl, filename);
                console.log("DESCARGADO");
                downloaded++;
            } catch (err) {
                console.log("FALLÓ: " + err.message);
                errors++;
            }
        } else {
            skipped++;
        }
    }

    console.log("\n========================================");
    console.log("PROCESO FINALIZADO");
    console.log(`- Descargadas: ${downloaded}`);
    console.log(`- Sin foto:    ${skipped}`);
    console.log(`- Errores:     ${errors}`);
    console.log(`- Total:       ${count}`);
    console.log("========================================\n");
    process.exit(0);
}

start().catch(err => {
    console.error("ERROR FATAL:", err);
    process.exit(1);
});
