/**
 * stats-panel.js — Panel lateral de estadísticas en tiempo real
 * 
 * Este módulo gestiona el panel desplegable que se muestra dentro
 * de la página del juego (index.html). Cuando el usuario activa
 * el checkbox "VER EN PANTALLA" y presiona STATS, el panel se
 * despliega en la mitad derecha de la pantalla mostrando datos
 * en vivo desde Firebase Firestore usando onSnapshot (escucha
 * en tiempo real).
 * 
 * Funcionalidades:
 * - Abre/cierra el panel con animación suave
 * - Pausa el juego automáticamente al abrir, lo reanuda al cerrar
 * - Muestra estadísticas globales, sesiones recientes y análisis de eventos
 * - Toggle: el botón STATS abre o cierra según el estado actual
 */

// Importamos la conexión a Firestore
import { db } from './firebase-config.js';
import {
    collection,  // Referencia a una colección de documentos
    doc,         // Referencia a un documento específico
    onSnapshot   // Escucha en tiempo real (se actualiza automáticamente)
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Array de funciones para cancelar las suscripciones a Firestore
// Cada onSnapshot devuelve una función "unsubscribe" que debemos llamar al cerrar
let unsubs = [];

// Estado del panel (abierto o cerrado)
let panelOpen = false;

// Función auxiliar para obtener elementos del DOM por ID
const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════
// ABRIR / CERRAR / TOGGLE — Control del panel
// ═══════════════════════════════════════════════════════════════

/**
 * Alterna el estado del panel: si está abierto lo cierra, si está cerrado lo abre
 * Se llama al hacer click en el botón STATS cuando el checkbox está activado
 */
export function togglePanel() {
    if (panelOpen) {
        closePanel();
    } else {
        openPanel();
    }
}

/**
 * Abre el panel de estadísticas:
 * 1. Muestra el panel con animación CSS (clase 'open')
 * 2. Agrega clase 'stats-open' al body para reorganizar el layout
 * 3. Pausa el juego silenciosamente (sin mostrar el overlay de PAUSED)
 * 4. Inicia los listeners de Firestore para datos en tiempo real
 */
export function openPanel() {
    const panel = $('stats-panel');
    if (!panel || panelOpen) return; // Ya está abierto o no existe
    panelOpen = true;
    panel.classList.add('open');                    // Anima el panel entrando
    document.body.classList.add('stats-open');      // Empuja el juego a la izquierda

    // Pausar el juego silenciosamente (sin overlay de pausa)
    // Accedemos a la instancia global del juego via window.game
    const g = window.game;
    if (g && g.running && !g.paused) {
        g.paused = true;
        clearInterval(g._timer); // Detenemos el timer de gravedad
    }

    // Iniciamos las escuchas en tiempo real de Firestore
    startListeners();
}

/**
 * Cierra el panel de estadísticas:
 * 1. Oculta el panel con animación CSS
 * 2. Restaura el layout original del juego
 * 3. Reanuda el juego si estaba pausado
 * 4. Cancela todos los listeners de Firestore (ahorra recursos)
 */
export function closePanel() {
    const panel = $('stats-panel');
    if (!panel || !panelOpen) return;
    panelOpen = false;
    panel.classList.remove('open');
    document.body.classList.remove('stats-open');

    // Reanudar el juego
    const g = window.game;
    if (g && g.running && g.paused) {
        g.paused = false;
        g._startTimer(); // Reiniciamos el timer de gravedad
    }

    // Cancelamos todas las suscripciones de Firestore
    stopListeners();
}

/**
 * Cancela todos los listeners activos de Firestore
 * Cada onSnapshot devuelve una función unsubscribe que al llamarla
 * deja de escuchar cambios (importante para no desperdiciar conexiones)
 */
function stopListeners() {
    unsubs.forEach(fn => fn()); // Llamamos cada función de cancelación
    unsubs = [];                 // Limpiamos el array
}

// ═══════════════════════════════════════════════════════════════
// LISTENERS DE FIRESTORE — Escuchas en tiempo real
// ═══════════════════════════════════════════════════════════════

/**
 * Inicia dos listeners con onSnapshot:
 * A) Escucha el documento "stats/global" para estadísticas acumuladas
 * B) Escucha la colección "sessions" para sesiones recientes y análisis
 * 
 * onSnapshot es diferente a getDoc: en vez de leer una sola vez,
 * se queda "escuchando" y ejecuta el callback cada vez que los datos
 * cambian en Firestore (en tiempo real, sin recargar la página)
 */
function startListeners() {
    stopListeners(); // Primero cancelamos listeners anteriores
    if (!db) {
        $('sp-body').innerHTML = '<p class="sp-empty">Firebase no conectado</p>';
        return;
    }

    // A) Escuchamos el documento de estadísticas globales
    unsubs.push(
        onSnapshot(doc(db, 'stats', 'global'), (snap) => {
            const d = snap.exists() ? snap.data() : {};
            renderGlobal(d); // Actualizamos la UI con los nuevos datos
        }, (err) => console.warn('stats-panel global:', err.message))
    );

    // B) Escuchamos TODA la colección de sesiones
    // No usamos orderBy para evitar necesitar un índice en Firestore
    // En su lugar, ordenamos en el cliente (más simple de configurar)
    unsubs.push(
        onSnapshot(collection(db, 'sessions'), (snap) => {
            const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            sessions.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
            renderRecent(sessions.slice(0, 8));
            // Ranking por puntaje (top 5 para el panel)
            const byScore = [...sessions].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
            renderRanking(byScore.slice(0, 5));
            renderAnalysis(sessions);
        }, (err) => console.warn('stats-panel sessions:', err.message))
    );
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE RENDERIZADO
// ═══════════════════════════════════════════════════════════════

function renderGlobal(d) {
    const el = $('sp-global');
    if (!el) return;
    const games = d.totalGames || 0;
    const lines = d.totalLines || 0;
    const hi = d.highScore || 0;
    const avgS = games ? Math.round(hi / games) : 0;
    const avgL = games ? (lines / games).toFixed(1) : '0';

    el.innerHTML = `
        <div class="sp-cards">
            <div class="sp-card"><span class="sp-card__val">${games}</span><span class="sp-card__lbl">PARTIDAS</span></div>
            <div class="sp-card"><span class="sp-card__val sp-card__val--hi">${hi.toLocaleString()}</span><span class="sp-card__lbl">HI-SCORE</span></div>
            <div class="sp-card"><span class="sp-card__val">${lines.toLocaleString()}</span><span class="sp-card__lbl">LÍNEAS</span></div>
            <div class="sp-card"><span class="sp-card__val">${avgS.toLocaleString()}</span><span class="sp-card__lbl">AVG SCORE</span></div>
            <div class="sp-card"><span class="sp-card__val">${avgL}</span><span class="sp-card__lbl">AVG LÍN</span></div>
        </div>`;
}

function renderRecent(sessions) {
    const el = $('sp-recent');
    if (!el) return;
    if (!sessions.length) { el.innerHTML = '<p class="sp-empty">Sin sesiones</p>'; return; }

    let html = '';
    for (const s of sessions) {
        const date = s.startTime ? new Date(s.startTime).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
        const dur = formatDuration(s.startTime, s.endTime);
        const dist = `×1:${s.linesSingle||0} ×2:${s.linesDouble||0} ×3:${s.linesTriple||0} T:${s.linesTetris||0}`;
        html += `<div class="sp-session">
            <div class="sp-session__top">
                <span class="sp-session__date">${date}</span>
                <span class="sp-session__dur">${dur}</span>
            </div>
            <div class="sp-session__mid">
                <span class="sp-session__score">${(s.finalScore || 0).toLocaleString()}</span>
                <span class="sp-session__meta">L${s.maxLevel || 1} · ${s.linesCleared || 0}lin</span>
            </div>
            <div class="sp-session__evts">${dist}</div>
        </div>`;
    }
    el.innerHTML = html;
}

function renderRanking(sessions) {
    const el = $('sp-ranking');
    if (!el) return;
    if (!sessions.length) { el.innerHTML = '<p class="sp-empty">Sin datos</p>'; return; }

    let html = '';
    sessions.forEach((s, i) => {
        html += `<div class="sp-session">
            <div class="sp-session__top">
                <span class="sp-session__date">#${i + 1}</span>
                <span class="sp-session__dur">L${s.maxLevel || 1}</span>
            </div>
            <div class="sp-session__mid">
                <span class="sp-session__score">${(s.finalScore || 0).toLocaleString()}</span>
                <span class="sp-session__meta">${s.linesCleared || 0}lin · T:${s.linesTetris||0}</span>
            </div>
        </div>`;
    });
    el.innerHTML = html;
}

function renderAnalysis(sessions) {
    const el = $('sp-analysis');
    if (!el) return;

    let tetrisCount = 0, levelUps = 0;
    const lineDist = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (const s of sessions) {
        for (const ev of (s.events || [])) {
            if (ev.type === 'tetris') { tetrisCount++; lineDist[4]++; }
            if (ev.type === 'level_up') levelUps++;
            if (ev.type === 'lines_cleared') lineDist[ev.count] = (lineDist[ev.count] || 0) + 1;
        }
    }

    el.innerHTML = `
        <div class="sp-analysis-row"><span>TETRIS (×4)</span><span class="sp-val--green">${tetrisCount}</span></div>
        <div class="sp-analysis-row"><span>LEVEL UPS</span><span class="sp-val--green">${levelUps}</span></div>
        <div class="sp-sep">── distribución ──</div>
        <div class="sp-analysis-row"><span>1 línea</span><span>${lineDist[1]}</span></div>
        <div class="sp-analysis-row"><span>2 líneas</span><span>${lineDist[2]}</span></div>
        <div class="sp-analysis-row"><span>3 líneas</span><span>${lineDist[3]}</span></div>
        <div class="sp-analysis-row"><span>4 líneas</span><span class="sp-val--green">${lineDist[4]}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula la duración de una sesión en formato "m:ss"
 * @param {string} start - ISO timestamp de inicio
 * @param {string} end - ISO timestamp de fin
 */
function formatDuration(start, end) {
    if (!start || !end) return '--:--';
    const ms = new Date(end) - new Date(start); // Diferencia en milisegundos
    const s = Math.floor(ms / 1000);             // Convertimos a segundos
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Resume los eventos importantes de una sesión en texto corto
 * Ejemplo: "2× TETRIS · 3× LVL UP"
 */
function eventSummary(events) {
    let t = 0, l = 0;
    for (const e of events) {
        if (e.type === 'tetris') t++;
        if (e.type === 'level_up') l++;
    }
    const p = [];
    if (t) p.push(`${t}× TETRIS`);
    if (l) p.push(`${l}× LVL UP`);
    return p.join(' · ') || '—';
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN — Conectamos los botones al cargar la página
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const btnStats = $('btn-stats');   // Botón "STATS" en el panel derecho
    const chk = $('chk-inline');       // Checkbox "VER EN PANTALLA"
    const btnClose = $('sp-close');    // Botón [X] del panel de stats

    if (btnStats) {
        btnStats.addEventListener('click', () => {
            if (chk && chk.checked) {
                // Si el checkbox está marcado → toggle del panel inline
                togglePanel();
            } else {
                // Si NO está marcado → navegar a la página completa de stats
                window.location.href = 'stats.html';
            }
        });
    }

    // Botón [X] cierra el panel
    if (btnClose) btnClose.addEventListener('click', closePanel);
});
