"use strict";
const MEMORY_FACES = ["📚", "🧪", "🎒", "✏️", "🔬", "🎨", "🧮", "🌍"];
const MemoryGame = {
    id: "memory",
    title: "Memory Match",
    emoji: "🧠",
    blurb: "Find all 8 pairs in as few moves as you can.",
    scoreLabel: "moves",
    lowerIsBetter: true,
    mount(root, api) {
        let cards = [];
        let open = [];
        let moves = 0;
        let seconds = 0;
        let locked = false;
        let ticker;
        let flipTimer;
        let movesEl, timeEl, gridEl, msgEl;
        function shuffle(a) {
            const x = a.slice();
            for (let i = x.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [x[i], x[j]] = [x[j], x[i]];
            }
            return x;
        }
        function newGame() {
            window.clearInterval(ticker);
            window.clearTimeout(flipTimer);
            cards = shuffle([...MEMORY_FACES, ...MEMORY_FACES]).map((face, id) => ({ id, face, flipped: false, matched: false }));
            open = [];
            moves = 0;
            seconds = 0;
            locked = false;
            ticker = undefined;
            build();
        }
        function startClock() {
            if (ticker)
                return;
            ticker = window.setInterval(() => { seconds++; timeEl.textContent = fmtTime(); }, 1000);
        }
        const fmtTime = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        function flip(i) {
            const c = cards[i];
            if (locked || c.flipped || c.matched)
                return;
            startClock();
            c.flipped = true;
            open.push(i);
            if (open.length === 2) {
                moves++;
                const [a, b] = open.map((n) => cards[n]);
                if (a.face === b.face) {
                    a.matched = b.matched = true;
                    open = [];
                    if (cards.every((x) => x.matched))
                        win();
                }
                else {
                    locked = true;
                    flipTimer = window.setTimeout(() => { a.flipped = b.flipped = false; open = []; locked = false; paint(); }, 750);
                }
            }
            paint();
        }
        function win() {
            window.clearInterval(ticker);
            const best = api.report(moves);
            msgEl.textContent = `Done in ${moves} moves, ${fmtTime()}.` + (best ? " New best! 🎉" : "");
        }
        function paint() {
            movesEl.textContent = String(moves);
            timeEl.textContent = fmtTime();
            mountInto(gridEl, cards.map((c, i) => (h("button", { type: "button", className: "mem-card" + (c.flipped || c.matched ? " up" : "") + (c.matched ? " done" : ""), "aria-label": c.flipped || c.matched ? c.face : "Hidden card", onClick: () => flip(i) },
                h("span", null, c.flipped || c.matched ? c.face : "?")))));
        }
        function build() {
            mountInto(root, h("div", { className: "mem" },
                h("div", { className: "g-toolbar" },
                    h("span", { className: "g-stat" },
                        "Moves ",
                        h("b", { ref: (e) => (movesEl = e) }, "0")),
                    h("span", { className: "g-stat" },
                        "Time ",
                        h("b", { ref: (e) => (timeEl = e) }, "0:00")),
                    h("button", { type: "button", className: "btn primary", onClick: newGame }, "Restart")),
                h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }),
                h("div", { className: "mem-grid", ref: (e) => (gridEl = e) })));
            paint();
        }
        newGame();
        return () => { window.clearInterval(ticker); window.clearTimeout(flipTimer); };
    }
};
