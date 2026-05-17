/**
 * Tracker.js — Módulo de seguimiento (tracking) de eventos del juego
 * 
 * Se encarga de registrar cada partida y sus eventos en Firebase Firestore
 * en tiempo real. Cada partida genera un documento en la colección "sessions"
 * con un ID único. Los eventos (inicio, líneas, nivel, game over) se agregan
 * como un array dentro del documento de la sesión.
 * 
 * También mantiene un documento "stats/global" con estadísticas acumuladas
 * (total de partidas, total de líneas, puntaje más alto).
 */

// Importamos la conexión a Firestore desde el módulo de configuración
import { db } from './firebase-config.js';

// Importamos funciones de Firestore para manipular documentos
import {
    doc,          // Referencia a un documento específico
    setDoc,       // Crear o reemplazar un documento
    updateDoc,    // Actualizar campos de un documento existente
    getDoc,       // Leer un documento
    arrayUnion,   // Agregar elementos a un array sin duplicar
    increment     // Incrementar un campo numérico atómicamente
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// ID de la sesión (partida) actual — se genera nuevo en cada partida
let sessionId = null;

/**
 * Ejecuta una promesa de forma segura (sin bloquear el juego si falla)
 * Si hay un error, solo lo muestra en consola sin detener la ejecución
 */
const safe = (p) => p?.catch(e => console.warn("Tracker:", e.message));

/**
 * Genera un ID único combinando la fecha actual en base 36
 * con un string aleatorio. Ejemplo: "m3kx8a2-h9f3k"
 */
function genId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Crea un objeto de evento con tipo, timestamp ISO y datos extra
 * @param {string} type - Tipo de evento ('game_start', 'lines_cleared', etc.)
 * @param {object} extra - Datos adicionales del evento (score, level, etc.)
 */
function mkEvent(type, extra = {}) {
    return { type, ts: new Date().toISOString(), ...extra };
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES EXPORTADAS — Se llaman desde game.js
// ═══════════════════════════════════════════════════════════════

/**
 * Registra el inicio de una nueva partida
 * Crea un documento nuevo en la colección "sessions" con los datos iniciales
 */
export async function trackGameStart() {
    if (!db) return; // Si Firebase no está conectado, no hacemos nada
    sessionId = genId(); // Generamos un ID único para esta sesión
    try {
        // Creamos el documento de la sesión con datos iniciales
        await setDoc(doc(db, 'sessions', sessionId), {
            startTime: new Date().toISOString(),
            finalScore: 0,
            linesCleared: 0,
            maxLevel: 1,
            linesSingle: 0,   // Líneas individuales completadas
            linesDouble: 0,   // Dobles completados
            linesTriple: 0,   // Triples completados
            linesTetris: 0,   // TETRIS (4 líneas) completados
            events: [mkEvent('game_start')],
        });
        setStatus(true); // Actualizamos el indicador visual a "ONLINE"
    } catch (e) {
        console.warn("trackGameStart:", e.message);
    }
}

/**
 * Registra el fin de la partida (Game Over)
 * Actualiza la sesión con puntaje final, líneas y nivel
 * También actualiza las estadísticas globales
 */
export function trackGameOver(score, lines, level) {
    if (!db || !sessionId) return;
    // Actualizamos el documento de la sesión con los resultados finales
    safe(updateDoc(doc(db, 'sessions', sessionId), {
        events: arrayUnion(mkEvent('game_over', { score, lines, level })),
        endTime: new Date().toISOString(),  // Hora de finalización
        finalScore: score,                   // Puntaje final
        linesCleared: lines,                 // Total de líneas completadas
        maxLevel: level,                     // Nivel máximo alcanzado
    }));
    // Actualizamos las estadísticas globales (total de partidas, hi-score, etc.)
    safe(updateGlobalStats(score, lines));
}

/**
 * Registra cuando el jugador completa líneas
 * Si son 4 líneas, se registra como evento especial "tetris"
 */
export function trackLinesCleared(count, score) {
    if (!db || !sessionId) return;
    const type = count === 4 ? 'tetris' : 'lines_cleared';
    // Determinamos qué campo incrementar según la cantidad de líneas
    const distField = { 1: 'linesSingle', 2: 'linesDouble', 3: 'linesTriple', 4: 'linesTetris' };
    const updateData = {
        events: arrayUnion(mkEvent(type, { count, score })),
    };
    // Incrementamos el contador correspondiente (singles, doubles, triples o tetris)
    if (distField[count]) updateData[distField[count]] = increment(1);
    safe(updateDoc(doc(db, 'sessions', sessionId), updateData));
}

/**
 * Registra cuando el jugador sube de nivel
 */
export function trackLevelUp(level) {
    if (!db || !sessionId) return;
    safe(updateDoc(doc(db, 'sessions', sessionId), {
        events: arrayUnion(mkEvent('level_up', { level })),
    }));
}

/**
 * Obtiene el puntaje más alto registrado en las estadísticas globales
 * Se usa para mostrar el HI-SCORE al inicio de cada partida
 */
export async function getHighScore() {
    if (!db) return 0;
    try {
        const snap = await getDoc(doc(db, 'stats', 'global'));
        return snap.exists() ? (snap.data().highScore ?? 0) : 0;
    } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES INTERNAS
// ═══════════════════════════════════════════════════════════════

/**
 * Actualiza el documento "stats/global" con los resultados de la partida
 * - Incrementa el contador de partidas totales
 * - Suma las líneas al total acumulado
 * - Actualiza el hi-score si el puntaje actual es mayor
 */
async function updateGlobalStats(score, lines) {
    const ref = doc(db, 'stats', 'global');
    try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            // Si no existe el documento global, lo creamos con los datos iniciales
            await setDoc(ref, { totalGames: 1, totalLines: lines, highScore: score });
        } else {
            // Si ya existe, actualizamos incrementando los contadores
            await updateDoc(ref, {
                totalGames: increment(1),                              // +1 partida
                totalLines: increment(lines),                          // +N líneas
                highScore: Math.max(snap.data().highScore ?? 0, score), // Máximo entre el actual y el nuevo
            });
        }
    } catch (e) { console.warn("updateGlobalStats:", e.message); }
}

/**
 * Actualiza el indicador visual de conexión Firebase en la interfaz
 * Muestra "⬤ ONLINE" (verde) o "⬤ OFFLINE" (rojo)
 */
function setStatus(online) {
    const el = document.getElementById('fb-status');
    if (!el) return;
    el.textContent = online ? '⬤ ONLINE' : '⬤ OFFLINE';
    el.className = 'fb-status' + (online ? ' online' : '');
}