/**
 * SFX.js  –  8/16-bit procedural sound effects via Web Audio API
 * No external files needed; all sounds are synthesised at runtime.
 */

let audioCtx = null;

function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

/** Ensure AudioContext is resumed (call on first user gesture) */
export function unlockAudio() {
    const a = ctx();
    if (a.state === 'suspended') a.resume();
}

/* ── helpers ─────────────────────────────────────────────────────── */

function playTone(freq, duration, type = 'square', volume = 0.15) {
    const a = ctx();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, a.currentTime);
    gain.gain.setValueAtTime(volume, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    osc.connect(gain).connect(a.destination);
    osc.start(a.currentTime);
    osc.stop(a.currentTime + duration);
}

function noise(duration, volume = 0.08) {
    const a = ctx();
    const bufferSize = a.sampleRate * duration;
    const buffer = a.createBuffer(1, bufferSize, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    const gain = a.createGain();
    gain.gain.setValueAtTime(volume, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    src.connect(gain).connect(a.destination);
    src.start();
}

/* ── public SFX ──────────────────────────────────────────────────── */

/** Piece moves left / right */
export function sfxMove() {
    playTone(200, 0.05, 'square', 0.06);
}

/** Piece rotates */
export function sfxRotate() {
    const a = ctx();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, a.currentTime);
    osc.frequency.linearRampToValueAtTime(500, a.currentTime + 0.06);
    gain.gain.setValueAtTime(0.10, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
    osc.connect(gain).connect(a.destination);
    osc.start(); osc.stop(a.currentTime + 0.08);
}

/** Piece locks in place (soft thud) */
export function sfxLock() {
    playTone(100, 0.12, 'triangle', 0.13);
    noise(0.06, 0.05);
}

/** Hard drop */
export function sfxDrop() {
    const a = ctx();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, a.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
    osc.connect(gain).connect(a.destination);
    osc.start(); osc.stop(a.currentTime + 0.18);
    noise(0.10, 0.07);
}

/** Line(s) cleared – ascending arpeggio, more notes for more lines */
export function sfxLineClear(count = 1) {
    const a = ctx();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    const len = Math.min(count, 4);
    for (let i = 0; i < len; i++) {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(notes[i], a.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.14, a.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.07 + 0.18);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.07 + 0.2);
    }
    // explosion noise
    noise(0.15 + count * 0.05, 0.06 + count * 0.02);
}

/** TETRIS! (4-line) fanfare */
export function sfxTetris() {
    const a = ctx();
    const melody = [523, 659, 784, 1047, 1319, 1568];
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
    noise(0.35, 0.10);
}

/** Level up */
export function sfxLevelUp() {
    const a = ctx();
    [440, 554, 659, 880].forEach((f, i) => {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.12, a.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.09 + 0.22);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.09 + 0.25);
    });
}

/** Game Over */
export function sfxGameOver() {
    const a = ctx();
    [400, 350, 300, 200, 150].forEach((f, i) => {
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, a.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, a.currentTime);
        gain.gain.setValueAtTime(0.10, a.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.15 + 0.30);
        osc.connect(gain).connect(a.destination);
        osc.start(); osc.stop(a.currentTime + i * 0.15 + 0.32);
    });
}

/** Soft drop tick */
export function sfxSoftDrop() {
    playTone(140, 0.04, 'square', 0.05);
}

/** Menu / button press */
export function sfxStart() {
    const a = ctx();
    [262, 330, 392, 523].forEach((f, i) => {
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
