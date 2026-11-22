"use strict";
/* ---------- Games hub ----------
   Replaces the old Calendar page. #games shows the picker, #games-<id> opens one game.
   Each game lives in its own file (src/games/<name>.tsx) and registers itself in the list below. */
const Games = (() => {
    const REGISTRY = [
        TicTacToeGame, SnakeGame, MemoryGame, Game2048, MinesweeperGame, MathSprintGame
    ];
    let cleanup = null;
    /* ----- personal bests, kept per account in this browser ----- */
    const key = (uid, id) => `confesshub.games.${uid}.${id}`;
    function readBest(uid, id) {
        try {
            const v = localStorage.getItem(key(uid, id));
            return v === null ? null : Number(v);
        }
        catch {
            return null;
        }
    }
    function writeBest(uid, id, value) {
        try {
            localStorage.setItem(key(uid, id), String(value));
        }
        catch { /* storage blocked: bests just aren't saved */ }
    }
    function stop() {
        if (cleanup) {
            cleanup();
            cleanup = null;
        }
    }
    function fmtBest(g, v) {
        return v === null ? "No score yet" : `Best: ${v} ${g.scoreLabel}`;
    }
    /* ----- picker ----- */
    function mountMenu(view, user) {
        stop();
        mountInto(view, h("h1", { className: "view-title" }, "Games"), h("p", { className: "games-intro" }, "Take a break between classes. Your best scores are saved on this device."), h("div", { className: "games-grid" }, REGISTRY.map((g) => (h("a", { className: "game-card", href: `#games-${g.id}` },
            h("span", { className: "game-emoji", "aria-hidden": "true" }, g.emoji),
            h("strong", null, g.title),
            h("span", { className: "game-blurb" }, g.blurb),
            h("span", { className: "game-best" }, fmtBest(g, readBest(user.id, g.id))))))));
    }
    /* ----- one game ----- */
    function mountGame(view, user, id) {
        stop();
        const game = REGISTRY.find((g) => g.id === id);
        if (!game) {
            mountMenu(view, user);
            return;
        }
        let bestEl;
        let stage;
        const paintBest = () => { bestEl.textContent = fmtBest(game, readBest(user.id, game.id)); };
        mountInto(view, h("div", { className: "game-head" },
            h("a", { className: "btn-sm", href: "#games" }, "\u2190 All games"),
            h("h1", { className: "view-title game-title" },
                game.emoji,
                " ",
                game.title),
            h("span", { className: "game-best-chip", ref: (el) => (bestEl = el) })), h("div", { className: "game-stage", ref: (el) => (stage = el) }));
        paintBest();
        const api = {
            best: () => readBest(user.id, game.id),
            report(score) {
                if (!game.lowerIsBetter && score <= 0)
                    return false; // a zero isn't worth saving
                const prev = readBest(user.id, game.id);
                const better = prev === null || (game.lowerIsBetter ? score < prev : score > prev);
                if (better) {
                    writeBest(user.id, game.id, score);
                    paintBest();
                }
                return better;
            },
            toast: (m) => Utils.toast(m, 2600)
        };
        cleanup = game.mount(stage, api);
    }
    /** Route entry: hash is "games" or "games-<id>". */
    function mount(view, user, hash) {
        const id = hash.startsWith("games-") ? hash.slice("games-".length) : "";
        if (id)
            mountGame(view, user, id);
        else
            mountMenu(view, user);
    }
    return { mount, stop };
})();
