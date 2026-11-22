"use strict";
/* ---------- Snake (canvas). Arrow keys / WASD, swipe, or the on-screen pad. ---------- */
const SnakeGame = {
    id: "snake",
    title: "Snake",
    emoji: "🐍",
    blurb: "Eat, grow, don't crash. It speeds up as you score.",
    scoreLabel: "points",
    mount(root, api) {
        const N = 18; // grid size
        const PX = 22; // pixels per cell
        let snake = [];
        let dir = { x: 1, y: 0 };
        let queued = null;
        let food = { x: 0, y: 0 };
        let score = 0;
        let running = false;
        let dead = false;
        let timer;
        let canvas, scoreEl, msgEl;
        const colors = () => {
            const cs = getComputedStyle(document.documentElement);
            return { bg: cs.getPropertyValue("--field").trim() || "#222", line: cs.getPropertyValue("--line").trim() || "#333", accent: cs.getPropertyValue("--accent").trim() || "#f5a623" };
        };
        function placeFood() {
            do {
                food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
            } while (snake.some((s) => s.x === food.x && s.y === food.y));
        }
        function reset() {
            window.clearTimeout(timer);
            snake = [{ x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
            dir = { x: 1, y: 0 };
            queued = null;
            score = 0;
            running = false;
            dead = false;
            placeFood();
            scoreEl.textContent = "0";
            msgEl.textContent = "Press an arrow key or swipe to start";
            draw();
        }
        function turn(d) {
            const cur = queued || dir;
            if (d.x === -cur.x && d.y === -cur.y)
                return; // no U-turns
            queued = d;
            if (!running && !dead) {
                running = true;
                msgEl.textContent = "";
                tick();
            }
        }
        function tick() {
            if (!running)
                return;
            if (queued) {
                dir = queued;
                queued = null;
            }
            const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
            const hitWall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
            const hitSelf = snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y);
            if (hitWall || hitSelf) {
                gameOver();
                return;
            }
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score += 10;
                scoreEl.textContent = String(score);
                placeFood();
            }
            else
                snake.pop();
            draw();
            timer = window.setTimeout(tick, Math.max(55, 140 - Math.floor(score / 50) * 10));
        }
        function gameOver() {
            running = false;
            dead = true;
            const best = api.report(score);
            msgEl.textContent = `Game over: ${score} points.` + (best && score > 0 ? " New best! 🎉" : "") + " Press Restart.";
            draw();
        }
        function draw() {
            const ctx = canvas.getContext("2d");
            const c = colors();
            ctx.fillStyle = c.bg;
            ctx.fillRect(0, 0, N * PX, N * PX);
            ctx.strokeStyle = c.line;
            ctx.lineWidth = 1;
            for (let i = 1; i < N; i++) {
                ctx.beginPath();
                ctx.moveTo(i * PX, 0);
                ctx.lineTo(i * PX, N * PX);
                ctx.moveTo(0, i * PX);
                ctx.lineTo(N * PX, i * PX);
                ctx.stroke();
            }
            ctx.fillStyle = "#e5484d";
            ctx.beginPath();
            ctx.arc(food.x * PX + PX / 2, food.y * PX + PX / 2, PX / 2 - 3, 0, Math.PI * 2);
            ctx.fill();
            snake.forEach((s, i) => {
                ctx.fillStyle = dead ? "#777" : i === 0 ? c.accent : "#19a974";
                ctx.fillRect(s.x * PX + 1, s.y * PX + 1, PX - 2, PX - 2);
            });
        }
        const KEYS = {
            ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
            w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 }
        };
        const onKey = (e) => {
            const t = e.target;
            if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName))
                return;
            const d = KEYS[e.key] || KEYS[e.key.toLowerCase()];
            if (!d)
                return;
            e.preventDefault();
            if (!dead)
                turn(d);
        };
        document.addEventListener("keydown", onKey);
        // swipe on the board
        let sx = 0, sy = 0;
        const onStart = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
        const onEnd = (e) => {
            const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20)
                return;
            if (!dead)
                turn(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
        };
        const pad = (label, d, cls) => (h("button", { type: "button", className: "pad-btn " + cls, "aria-label": label, onClick: () => { if (!dead)
                turn(d); } }, label === "Up" ? "▲" : label === "Down" ? "▼" : label === "Left" ? "◀" : "▶"));
        mountInto(root, h("div", { className: "snake" },
            h("div", { className: "g-toolbar" },
                h("span", { className: "g-stat" },
                    "Score ",
                    h("b", { ref: (e) => (scoreEl = e) }, "0")),
                h("button", { type: "button", className: "btn primary", onClick: reset }, "Restart")),
            h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }),
            h("canvas", { className: "snake-canvas", width: N * PX, height: N * PX, ref: (e) => {
                    canvas = e;
                    e.addEventListener("touchstart", onStart, { passive: true });
                    e.addEventListener("touchend", onEnd, { passive: true });
                } }),
            h("div", { className: "dpad" },
                pad("Up", KEYS.ArrowUp, "up"),
                pad("Left", KEYS.ArrowLeft, "left"),
                pad("Right", KEYS.ArrowRight, "right"),
                pad("Down", KEYS.ArrowDown, "down"))));
        reset();
        return () => { window.clearTimeout(timer); running = false; document.removeEventListener("keydown", onKey); };
    }
};
