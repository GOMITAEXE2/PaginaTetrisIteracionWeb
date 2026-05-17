import { db } from './firebase-config.js';
import {
    doc, setDoc, updateDoc, getDoc,
    arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// ID de sesión activa
let sessionId = null;

// Ejecuta una promesa sin bloquear
const safe = (p) => p?.catch(e => console.warn("Tracker:", e.message));

function genId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mkEvent(type, extra = {}) {
    return { type, ts: new Date().toISOString(), ...extra };
}

// --- exports ---

export async function trackGameStart() {
    if (!db) return;
    sessionId = genId();
    try {
        await setDoc(doc(db, 'sessions', sessionId), {
            startTime: new Date().toISOString(),
            finalScore: 0,
            linesCleared: 0,
            maxLevel: 1,
            events: [mkEvent('game_start')],
        });
        setStatus(true);
    } catch (e) {
        console.warn("trackGameStart:", e.message);
    }
}

export function trackGameOver(score, lines, level) {
    if (!db || !sessionId) return;
    safe(updateDoc(doc(db, 'sessions', sessionId), {
        events: arrayUnion(mkEvent('game_over', { score, lines, level })),
        endTime: new Date().toISOString(),
        finalScore: score,
        linesCleared: lines,
        maxLevel: level,
    }));
    safe(updateGlobalStats(score, lines));
}

export function trackLinesCleared(count, score) {
    if (!db || !sessionId) return;
    // 4 líneas = "tetris" (evento especial)
    const type = count === 4 ? 'tetris' : 'lines_cleared';
    safe(updateDoc(doc(db, 'sessions', sessionId), {
        events: arrayUnion(mkEvent(type, { count, score })),
    }));
}

export function trackLevelUp(level) {
    if (!db || !sessionId) return;
    safe(updateDoc(doc(db, 'sessions', sessionId), {
        events: arrayUnion(mkEvent('level_up', { level })),
    }));
}

export async function getHighScore() {
    if (!db) return 0;
    try {
        const snap = await getDoc(doc(db, 'stats', 'global'));
        return snap.exists() ? (snap.data().highScore ?? 0) : 0;
    } catch { return 0; }
}

// --- internal ---s

async function updateGlobalStats(score, lines) {
    const ref = doc(db, 'stats', 'global');
    try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, { totalGames: 1, totalLines: lines, highScore: score });
        } else {
            await updateDoc(ref, {
                totalGames: increment(1),
                totalLines: increment(lines),
                highScore: Math.max(snap.data().highScore ?? 0, score),
            });
        }
    } catch (e) { console.warn("updateGlobalStats:", e.message); }
}

function setStatus(online) {
    const el = document.getElementById('fb-status');
    if (!el) return;
    el.textContent = online ? '⬤ ONLINE' : '⬤ OFFLINE';
    el.className = 'fb-status' + (online ? ' online' : '');
}