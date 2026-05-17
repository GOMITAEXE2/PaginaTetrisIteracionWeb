import {
    trackGameStart, trackGameOver,
    trackLinesCleared, trackLevelUp,
    getHighScore,
} from '../Scripts/Tracker.js';

// --- constants ---

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const TETROMINOES = [
    { shape: [[1, 1, 1, 1]], color: '#00f5ff' }, // I
    { shape: [[1, 1], [1, 1]], color: '#ffd60a' }, // O
    { shape: [[0, 1, 0], [1, 1, 1]], color: '#bf5af2' }, // T
    { shape: [[0, 1, 1], [1, 1, 0]], color: '#30d158' }, // S
    { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff375f' }, // Z
    { shape: [[1, 0, 0], [1, 1, 1]], color: '#0a84ff' }, // J
    { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff9f0a' }, // L
];

const SCORE_TABLE = [0, 100, 300, 500, 800];
const speed = (lvl) => Math.max(80, 800 - (lvl - 1) * 75);

// --- Piece class ---

class Piece {
    constructor(def) {
        this.shape = def.shape.map(r => [...r]);
        this.color = def.color;
        this.x = 3;
        this.y = 0;
    }

    get w() { return this.shape[0].length; }
    get h() { return this.shape.length; }

    rotated() {
        const rows = this.h, cols = this.w;
        return Array.from({ length: cols }, (_, c) =>
            Array.from({ length: rows }, (_, r) => this.shape[rows - 1 - r][c])
        );
    }

    cells() {
        const out = [];
        for (let r = 0; r < this.h; r++)
            for (let c = 0; c < this.w; c++)
                if (this.shape[r][c]) out.push([this.x + c, this.y + r]);
        return out;
    }
}

// --- Game class ---

class Tetris {
    constructor() {
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.nCanvas = document.getElementById('next');
        this.nCtx = this.nCanvas.getContext('2d');

        this.board = null;
        this.current = null;
        this.next = null;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.hiScore = 0;
        this.running = false;
        this.paused = false;
        this._timer = null;
        this._raf = null;

        this._bindUI();
        this._bindKeys();
        this._bindTouch();
    }

    // --- init ---

    _newBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    }

    _randomPiece() {
        const def = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
        const p = new Piece(def);
        p.x = Math.floor((COLS - p.w) / 2);
        return p;
    }

    async start() {
        this.board = this._newBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.running = true;
        this.paused = false;
        this.hiScore = await getHighScore();
        this.next = this._randomPiece();
        this._spawn();
        this._updateUI();
        trackGameStart();
        this._startTimer();
        this._raf = requestAnimationFrame(() => this._drawLoop());
    }

    _spawn() {
        this.current = this.next;
        this.current.x = Math.floor((COLS - this.current.w) / 2);
        this.current.y = 0;
        this.next = this._randomPiece();
        if (this._collides(this.current, 0, 0)) this._gameOver();
    }

    // --- collision ---

    _collides(piece, dx = 0, dy = 0) {
        for (const [x, y] of piece.cells()) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && this.board[ny][nx]) return true;
        }
        return false;
    }

    // --- actions ---

    moveLeft() { if (this._ok() && !this._collides(this.current, -1, 0)) this.current.x--; }
    moveRight() { if (this._ok() && !this._collides(this.current, 1, 0)) this.current.x++; }

    rotate() {
        if (!this._ok()) return;
        const rotated = this.current.rotated();
        const orig = this.current.shape;
        this.current.shape = rotated;
        for (const dx of [0, -1, 1, -2, 2]) {
            if (!this._collides(this.current, dx, 0)) {
                this.current.x += dx;
                return;
            }
        }
        this.current.shape = orig;
    }

    softDrop() {
        if (!this._ok()) return;
        if (!this._collides(this.current, 0, 1)) {
            this.current.y++;
            this.score += 1;
        } else {
            this._lock();
        }
        this._restartTimer();
    }

    hardDrop() {
        if (!this._ok()) return;
        let dropped = 0;
        while (!this._collides(this.current, 0, 1)) { this.current.y++; dropped++; }
        this.score += dropped * 2;
        this._lock();
    }

    _ok() { return this.running && !this.paused && this.current; }

    // --- lock & clear ---

    _lock() {
        for (const [x, y] of this.current.cells())
            if (y >= 0) this.board[y][x] = this.current.color;
        this._clearLines();
        this._spawn();
        this._updateUI();
    }

    _clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.board[r].every(c => c !== null)) {
                this.board.splice(r, 1);
                this.board.unshift(Array(COLS).fill(null));
                cleared++;
                r++;
            }
        }
        if (!cleared) return;

        this.score += SCORE_TABLE[Math.min(cleared, 4)] * this.level;
        this.lines += cleared;
        trackLinesCleared(cleared, this.score);

        if (cleared === 4) this._flashTetris();

        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            trackLevelUp(this.level);
            this._restartTimer();
        }
    }

    _flashTetris() {
        const el = document.getElementById('overlay-tetris');
        el.classList.remove('overlay--hidden');
        setTimeout(() => el.classList.add('overlay--hidden'), 1200);
    }

    // --- game state ---

    pause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        clearInterval(this._timer);
        document.getElementById('overlay-pause').classList.remove('overlay--hidden');
    }

    resume() {
        this.paused = false;
        document.getElementById('overlay-pause').classList.add('overlay--hidden');
        this._startTimer();
    }

    _gameOver() {
        this.running = false;
        clearInterval(this._timer);
        cancelAnimationFrame(this._raf);
        this._draw();

        document.getElementById('result-score').textContent = this.score;
        document.getElementById('result-lines').textContent = this.lines;
        document.getElementById('result-level').textContent = this.level;
        document.getElementById('overlay-gameover').classList.remove('overlay--hidden');

        trackGameOver(this.score, this.lines, this.level);
    }

    // --- timer ---

    _startTimer() {
        this._timer = setInterval(() => this._tick(), speed(this.level));
    }

    _restartTimer() {
        clearInterval(this._timer);
        this._startTimer();
    }

    _tick() {
        if (!this.running || this.paused) return;
        if (!this._collides(this.current, 0, 1)) this.current.y++;
        else this._lock();
    }

    // --- ghost ---

    _ghostY() {
        let dy = 0;
        while (!this._collides(this.current, 0, dy + 1)) dy++;
        return this.current.y + dy;
    }

    // --- draw ---

    _drawLoop() {
        this._draw();
        if (this.running) this._raf = requestAnimationFrame(() => this._drawLoop());
    }

    _draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // grid lines
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.04)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);

        // locked cells
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (this.board[r][c]) this._drawBlock(ctx, c, r, this.board[r][c], BLOCK);

        if (!this.current) return;

        // ghost piece
        const gy = this._ghostY();
        for (const [x, y] of this.current.cells()) {
            const gr = gy + (y - this.current.y);
            if (gr >= 0 && gr !== y) {
                ctx.fillStyle = 'rgba(255,255,255,0.07)';
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 1;
                ctx.fillRect(x * BLOCK + 1, gr * BLOCK + 1, BLOCK - 2, BLOCK - 2);
                ctx.strokeRect(x * BLOCK + 1, gr * BLOCK + 1, BLOCK - 2, BLOCK - 2);
            }
        }

        // active piece
        for (const [x, y] of this.current.cells())
            if (y >= 0) this._drawBlock(ctx, x, y, this.current.color, BLOCK);

        this._drawNext();
    }

    _drawBlock(ctx, col, row, color, size) {
        const x = col * size, y = row * size;
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x + 2, y + 2, size - 4, 3);
        ctx.fillRect(x + 2, y + 2, 3, size - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 2, y + size - 4, size - 4, 3);
        ctx.fillRect(x + size - 4, y + 2, 3, size - 4);
    }

    _drawNext() {
        const ctx = this.nCtx;
        const W = this.nCanvas.width;
        const H = this.nCanvas.height;
        ctx.clearRect(0, 0, W, H);
        if (!this.next) return;

        const s = this.next.shape;
        const bk = 24;
        const ox = Math.floor((W - s[0].length * bk) / 2);
        const oy = Math.floor((H - s.length * bk) / 2);

        for (let r = 0; r < s.length; r++)
            for (let c = 0; c < s[r].length; c++)
                if (s[r][c]) {
                    ctx.shadowColor = this.next.color;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = this.next.color;
                    ctx.fillRect(ox + c * bk + 1, oy + r * bk + 1, bk - 2, bk - 2);
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(255,255,255,0.28)';
                    ctx.fillRect(ox + c * bk + 2, oy + r * bk + 2, bk - 4, 2);
                }
    }

    // --- UI ---

    _updateUI() {
        const f = (n, len) => String(n).padStart(len, '0');
        document.getElementById('score').textContent = f(this.score, 6);
        document.getElementById('lines').textContent = f(this.lines, 4);
        document.getElementById('level').textContent = f(this.level, 2);
        document.getElementById('hiscore').textContent = f(Math.max(this.hiScore, this.score), 6);
    }

    // --- input ---

    _bindUI() {
        const hide = (id) => document.getElementById(id).classList.add('overlay--hidden');

        document.getElementById('btn-start').addEventListener('click', () => {
            hide('overlay-start');
            this.start();
        });
        document.getElementById('btn-restart').addEventListener('click', () => {
            hide('overlay-gameover');
            this.start();
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            if (this.paused) this.resume(); else this.pause();
        });
        document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    }

    _bindKeys() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); this.moveLeft(); break;
                case 'ArrowRight': e.preventDefault(); this.moveRight(); break;
                case 'ArrowDown': e.preventDefault(); this.softDrop(); break;
                case 'ArrowUp': case 'z': case 'Z':
                    e.preventDefault(); this.rotate(); break;
                case ' ': e.preventDefault(); this.hardDrop(); break;
                case 'p': case 'P': case 'Escape':
                    e.preventDefault();
                    if (this.paused) this.resume(); else this.pause();
                    break;
            }
        });
    }

    _bindTouch() {
        const btn = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                fn();
            }, { passive: false });
        };

        btn('t-left', () => this.moveLeft());
        btn('t-right', () => this.moveRight());
        btn('t-rotate', () => this.rotate());
        btn('t-soft', () => this.softDrop());
        btn('t-drop', () => this.hardDrop());

        // swipe on canvas
        let sx = 0, sy = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            sx = e.touches[0].clientX;
            sy = e.touches[0].clientY;
        }, { passive: true });
        this.canvas.addEventListener('touchend', (e) => {
            if (!this._ok()) return;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { this.rotate(); return; }
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 20) this.moveRight();
                else if (dx < -20) this.moveLeft();
            } else {
                if (dy > 30) this.hardDrop();
            }
        }, { passive: true });
    }
}

// --- bootstrap ---

new Tetris();