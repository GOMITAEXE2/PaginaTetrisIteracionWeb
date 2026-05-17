import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Completar con las credenciales del proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAIvsQ-pR-wFC6m1sQv0N1gy9DnD3w8fTg",
    authDomain: "proyectoiwtetris.firebaseapp.com",
    projectId: "proyectoiwtetris",
    storageBucket: "proyectoiwtetris.firebasestorage.app",
    messagingSenderId: "176778178686",
    appId: "1:176778178686:web:6ba0c633a4755c93eae82f",
    measurementId: "G-93B4WP3TT5"
};

let db = null;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (err) {
    console.warn("Firebase no inicializado:", err.message);
}

export { db };