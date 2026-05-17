/**
 * stats-panel.js — Inline real-time stats panel for the game page.
 * Reads Firestore via onSnapshot, pauses/resumes game via window.game.
 */

import { db } from './firebase-config.js';
import {
    collection, doc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let unsubs = [];
let panelOpen = false;

const $ = (id) => document.getElementById(id);

/* ── open / close ──────────────────────────────────────────────── */

export function togglePanel() {
    if (panelOpen) {
        closePanel();
    } else {
        openPanel();
    }
}

export function openPanel() {
    const panel = $('stats-panel');
    if (!panel || panelOpen) return;
    panelOpen = true;
    panel.classList.add('open');
    document.body.classList.add('stats-open');

    // Pause game silently (no overlay)
    const g = window.game;
    if (g && g.running && !g.paused) {
        g.paused = true;
        clearInterval(g._timer);
    }

    startListeners();
}

export function closePanel() {
    const panel = $('stats-panel');
    if (!panel || !panelOpen) return;
    panelOpen = false;
    panel.classList.remove('open');
    document.body.classList.remove('stats-open');

    // Resume game
    const g = window.game;
    if (g && g.running && g.paused) {
        g.paused = false;
        g._startTimer();
    }

    stopListeners();
}

function stopListeners() {
    unsubs.forEach(fn => fn());
    unsubs = [];
}

/* ── listeners ─────────────────────────────────────────────────── */

function startListeners() {
    stopListeners();
    if (!db) {
        $('sp-body').innerHTML = '<p class="sp-empty">Firebase no conectado</p>';
        return;
    }

    // A) Global stats
    unsubs.push(
        onSnapshot(doc(db, 'stats', 'global'), (snap) => {
            const d = snap.exists() ? snap.data() : {};
            renderGlobal(d);
        }, (err) => console.warn('stats-panel global:', err.message))
    );

    // B+D) Sessions — NO orderBy, sort client-side
    unsubs.push(
        onSnapshot(collection(db, 'sessions'), (snap) => {
            const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort by startTime desc
            sessions.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
            renderRecent(sessions.slice(0, 8));
            renderAnalysis(sessions);
        }, (err) => console.warn('stats-panel sessions:', err.message))
    );
}

/* ── render helpers ────────────────────────────────────────────── */

function renderGlobal(d) {
    const el = $('sp-global');
    if (!el) return;
    const games = d.totalGames || 0;
    const lines = d.totalLines || 0;
    const hi = d.highScore || 0;
    const avgS = games ? Math.round((hi > 0 ? (lines * 30) : 0) / Math.max(games, 1)) : 0;
    const avgL = games ? (lines / games).toFixed(1) : '0';

    el.innerHTML = `
        <div class="sp-cards">
            <div class="sp-card"><span class="sp-card__val">${games}</span><span class="sp-card__lbl">PARTIDAS</span></div>
            <div class="sp-card"><span class="sp-card__val sp-card__val--hi">${hi.toLocaleString()}</span><span class="sp-card__lbl">HI-SCORE</span></div>
            <div class="sp-card"><span class="sp-card__val">${lines.toLocaleString()}</span><span class="sp-card__lbl">LÍNEAS</span></div>
        </div>
        <div class="sp-cards">
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
        const evts = eventSummary(s.events || []);
        html += `<div class="sp-session">
            <div class="sp-session__top">
                <span class="sp-session__date">${date}</span>
                <span class="sp-session__dur">${dur}</span>
            </div>
            <div class="sp-session__mid">
                <span class="sp-session__score">${(s.finalScore || 0).toLocaleString()}</span>
                <span class="sp-session__meta">L${s.maxLevel || 1} · ${s.linesCleared || 0}lin</span>
            </div>
            <div class="sp-session__evts">${evts}</div>
        </div>`;
    }
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

/* ── utils ─────────────────────────────────────────────────────── */

function formatDuration(start, end) {
    if (!start || !end) return '--:--';
    const ms = new Date(end) - new Date(start);
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

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

/* ── wiring ────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    const btnStats = $('btn-stats');
    const chk = $('chk-inline');
    const btnClose = $('sp-close');

    if (btnStats) {
        btnStats.addEventListener('click', () => {
            if (chk && chk.checked) {
                togglePanel();
            } else {
                window.location.href = 'stats.html';
            }
        });
    }

    if (btnClose) btnClose.addEventListener('click', closePanel);
});
