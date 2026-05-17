/**
 * SFX.js — Motor de efectos de sonido procedurales (8/16-bit)
 * 
 * Genera todos los sonidos del juego en tiempo real usando la Web Audio API.
 * No necesita archivos de audio externos: cada sonido se sintetiza
 * matemáticamente con osciladores (ondas cuadradas, triangulares, etc.)
 * y ruido blanco generado proceduralmente.
 * 
 * Tipos de onda usados:
 * - square (cuadrada): sonido "chiptuneado" clásico de 8-bit
 * - triangle (triangular): sonidos más suaves y graves
 * - sawtooth (diente de sierra): sonidos ásperos (usado en game over)
 */

// Contexto de audio global — se crea una sola vez y se reutiliza
let audioCtx = null;

/**
 * Obtiene o crea el contexto de audio del navegador
 * AudioContext es la interfaz principal de Web Audio API
 */
function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

/**
 * Desbloquea el audio del navegador (necesario en Chrome/Safari)
 * Los navegadores modernos requieren un gesto del usuario antes de
 * reproducir audio. Se llama al presionar START.
 */
export function unlockAudio() {
    const a = ctx();
    if (a.state === 'suspended') a.resume();
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES — Generadores base de sonido
// ═══════════════════════════════════════════════════════════════

/**
 * Reproduce un tono simple con frecuencia, duración y tipo de onda
 * @param {number} freq - Frecuencia en Hz (ej: 440 = nota La)
 * @param {number} duration - Duración en segundos
 * @param {string} type - Tipo de onda ('square', 'triangle', 'sawtooth')
 * @param {number} volume - Volumen de 0 a 1
 */
function playTone(freq, duration, type = 'square', volume = 0.15) {
    const a = ctx();
    const osc = a.createOscillator();      // Crea un oscilador (genera la onda sonora)
    const gain = a.createGain();            // Crea un nodo de ganancia (controla volumen)
    osc.type = type;                        // Tipo de onda
    osc.frequency.setValueAtTime(freq, a.currentTime); // Frecuencia inicial
    gain.gain.setValueAtTime(volume, a.currentTime);    // Volumen inicial
    // Fade out exponencial: el sonido se apaga gradualmente
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    // Conectamos: oscilador → ganancia → parlantes
    osc.connect(gain).connect(a.destination);
    osc.start(a.currentTime);
    osc.stop(a.currentTime + duration);
}

/**
 * Genera ruido blanco (sonido de explosión/impacto)
 * Se crea un buffer con valores aleatorios entre -1 y 1
 * que simula el sonido de estática/explosión
 */
function noise(duration, volume = 0.08) {
    const a = ctx();
    const bufferSize = a.sampleRate * duration;           // Cantidad de muestras
    const buffer = a.createBuffer(1, bufferSize, a.sampleRate); // Buffer mono
    const data = buffer.getChannelData(0);
    // Llenamos con valores aleatorios (ruido blanco puro)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    const gain = a.createGain();
    gain.gain.setValueAtTime(volume, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    src.connect(gain).connect(a.destination);
    src.start();
}

// ═══════════════════════════════════════════════════════════════
// EFECTOS DE SONIDO EXPORTADOS — Se llaman desde game.js
// ═══════════════════════════════════════════════════════════════

/** Pieza se mueve a izquierda o derecha — tono corto y suave */
export function sfxMove() {
    playTone(200, 0.05, 'square', 0.06);
}

/** Pieza rota — barrido de frecuencia ascendente (300→500 Hz) */
export function sfxRotate() {
    const a = ctx();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, a.currentTime);
    // La frecuencia sube rápidamente simulando un "giro"
    osc.frequency.linearRampToValueAtTime(500, a.currentTime + 0.06);
    gain.gain.setValueAtTime(0.10, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
    osc.connect(gain).connect(a.destination);
    osc.start(); osc.stop(a.currentTime + 0.08);
}

/** Pieza se fija en su posición — golpe grave + ruido de impacto */
export function sfxLock() {
    playTone(100, 0.12, 'triangle', 0.13);
    noise(0.06, 0.05);
}

/** Hard drop (caída instantánea) — frecuencia descendente + impacto */
export function sfxDrop() {
    const a = ctx();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    // La frecuencia baja rápido (160→50 Hz) simulando una caída
    osc.frequency.setValueAtTime(160, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, a.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
    osc.connect(gain).connect(a.destination);
    osc.start(); osc.stop(a.currentTime + 0.18);
    noise(0.10, 0.07); // Explosión de impacto
}

/**
 * Línea(s) completada(s) — arpegio ascendente (do-mi-sol-do)
 * Más notas para más líneas completadas simultáneamente
 */
export function sfxLineClear(count = 1) {
    const a = ctx();
    const notes = [523, 659, 784, 1047]; // Do5, Mi5, Sol5, Do6 (acorde mayor)
    const len = Math.min(count, 4);       // Máximo 4 notas
    for (let i = 0; i < len; i++) {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'square';
        // Cada nota empieza 70ms después de la anterior (arpegio)
        osc.frequency.setValueAtTime(notes[i], a.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.14, a.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.07 + 0.18);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.07 + 0.2);
    }
    // Ruido de explosión proporcional a las líneas completadas
    noise(0.15 + count * 0.05, 0.06 + count * 0.02);
}

/** TETRIS! (4 líneas) — fanfarria especial con 6 notas ascendentes */
export function sfxTetris() {
    const a = ctx();
    const melody = [523, 659, 784, 1047, 1319, 1568]; // Do5→Sol6
    melody.forEach((f, i) => {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.14, a.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.06 + 0.25);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.06 + 0.28);
    });
    noise(0.35, 0.10); // Explosión grande
}

/** Subida de nivel — arpegio con onda triangular (más suave) */
export function sfxLevelUp() {
    const a = ctx();
    [440, 554, 659, 880].forEach((f, i) => { // La4, Do#5, Mi5, La5
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'triangle'; // Onda triangular = sonido más limpio
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.12, a.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.09 + 0.22);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.09 + 0.25);
    });
}

/** Game Over — melodía descendente con onda diente de sierra (sonido triste) */
export function sfxGameOver() {
    const a = ctx();
    [400, 350, 300, 200, 150].forEach((f, i) => {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'sawtooth'; // Diente de sierra = sonido áspero/dramático
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.10, a.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.15 + 0.30);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.15 + 0.32);
    });
}

/** Soft drop (bajada suave) — tick muy corto */
export function sfxSoftDrop() {
    playTone(140, 0.04, 'square', 0.05);
}

/** Sonido de inicio — acorde ascendente al presionar START */
export function sfxStart() {
    const a = ctx();
    [262, 330, 392, 523].forEach((f, i) => { // Do4, Mi4, Sol4, Do5
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.13, a.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.08 + 0.18);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.08 + 0.20);
    });
}
