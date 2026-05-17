/**
 * firebase-config.js — Configuración e inicialización de Firebase
 * 
 * Este módulo importa Firebase desde el CDN oficial de Google,
 * configura la conexión con el proyecto "proyectoiwtetris" y
 * exporta la instancia de Firestore (db) para que los demás
 * módulos puedan leer y escribir datos en la base de datos.
 */

// Importamos las funciones necesarias del SDK de Firebase (versión modular ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Credenciales del proyecto Firebase (obtenidas de la consola de Firebase)
// Estas claves identifican al proyecto y permiten la conexión desde el navegador
const firebaseConfig = {
    apiKey: "AIzaSyAIvsQ-pR-wFC6m1sQv0N1gy9DnD3w8fTg",
    authDomain: "proyectoiwtetris.firebaseapp.com",
    projectId: "proyectoiwtetris",
    storageBucket: "proyectoiwtetris.firebasestorage.app",
    messagingSenderId: "176778178686",
    appId: "1:176778178686:web:6ba0c633a4755c93eae82f",
    measurementId: "G-93B4WP3TT5"
};

// Variable que almacenará la conexión a Firestore
// Se inicializa como null por si la conexión falla
let db = null;

try {
    // Inicializamos la aplicación Firebase con las credenciales
    const app = initializeApp(firebaseConfig);
    // Obtenemos la referencia a la base de datos Firestore
    db = getFirestore(app);
} catch (err) {
    // Si hay un error de conexión, lo mostramos en consola sin detener la app
    console.warn("Firebase no inicializado:", err.message);
}

// Exportamos la instancia de Firestore para que otros módulos la usen
export { db };