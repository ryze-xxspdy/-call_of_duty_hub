"use strict";
/* ---------- Whack-a-Mole: 30 seconds, tap every mole that pops up ---------- */
const WhackGame = {
    id: "whack",
    title: "Whack-a-Mole",
    emoji: "🔨",
    blurb: "Moles pop up fast. Tap them before they hide. 30 seconds.",
    scoreLabel: "moles",
    pointsHint: "20 pts per mole",
    mount(root, api) {
        const ROUND = 30;
        let score = 0, timeLeft = ROUND, active = -1, playing = false;
        let tick, hideT, popT;
        let timeEl, scoreEl, msgEl, startBtn;
        const holes = [];
        function show(i) {
            active = i;
            holes.forEach((b, k) => { b.textContent = k === i ? "🐹" : ""; b.classList.toggle("up", k === i); });
        }
        function pop() {
            if (!playing)
                return;
            let i = Math.floor(Math.random() * 9);
            if (i === active)
                i = (i + 1 + Math.floor(Math.random() * 8)) % 9;
            show(i);
            const stay = Math.max(420, 900 - score * 15);
            hideT = window.setTimeout(() => { show(-1); popT = window.setTimeout(pop, 150 + Math.random() * 250); }, stay);
        }
        function hit(i) {
            if (!playing || i !== active)
                return;
            score++;
            scoreEl.textContent = String(score);
            window.clearTimeout(hideT);
            show(-1);
            popT = window.setTimeout(pop, 120);
        }
        function stopAll() { window.clearInterval(tick); window.clearTimeout(hideT); window.clearTimeout(popT); }
        function finish() {
            stopAll();
            playing = false;
            show(-1);
            const best = api.report(score);
            api.award(score * 20);
            msgEl.textContent = `Time's up! You whacked ${score}.` + (best && score > 0 ? " New best! 🎉" : "");
            startBtn.textContent = "Play again";
        }
        function start() {
            stopAll();
            score = 0;
            timeLeft = ROUND;
            playing = true;
            scoreEl.textContent = "0";
            timeEl.textContent = String(ROUND);
            msgEl.textContent = "";
            startBtn.textContent = "Restart";
            popT = window.setTimeout(pop, 400);
            tick = window.setInterval(() => { timeLeft--; timeEl.textContent = String(timeLeft); if (timeLeft <= 0)
                finish(); }, 1000);
        }
        mountInto(root, h("div", { className: "whack" },
            h("div", { className: "g-toolbar" },
                h("span", { className: "g-stat" },
                    "Time ",
                    h("b", { ref: (e) => (timeEl = e) }, "30")),
                h("span", { className: "g-stat" },
                    "Moles ",
                    h("b", { ref: (e) => (scoreEl = e) }, "0")),
                h("button", { type: "button", className: "btn primary", ref: (e) => (startBtn = e), onClick: start }, "Start")),
            h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }, "Press Start"),
            h("div", { className: "whack-grid" }, Array.from({ length: 9 }, (_, i) => (h("button", { type: "button", className: "whack-hole", "aria-label": `Hole ${i + 1}`, ref: (e) => holes.push(e), onPointerdown: (ev) => { ev.preventDefault(); hit(i); } }))))));
        return () => { playing = false; stopAll(); };
    }
};
