"use strict";
/* ---------- Games hub ----------
   Replaces the old Calendar page. #games shows the picker, #games-<id> opens one game.
   Each game lives in its own file (src/games/<name>.tsx) and registers itself in the list below. */
const Games = (() => {
    const REGISTRY = [
        TicTacToeGame, SnakeGame, MemoryGame, Game2048, MinesweeperGame, MathSprintGame,
        WhackGame, ReactionGame, SimonGame, ScrambleGame, Connect4Game, TypingGame, QuizGame
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
    /** Level + points banner shown at the top of the games pages. */
    function statusBar() {
        const lv = Rewards.level(), st = Rewards.get();
        return (h("a", { className: "rw-banner", href: "#redeem", title: "Open the Redeem shop" },
            h("span", { className: "rw-lv" },
                "\u2B50",
                h("b", null,
                    "Lv ",
                    lv.level)),
            h("span", { className: "rw-mid" },
                h("span", { className: "rw-title" }, lv.max ? `${lv.title} · Level ${lv.level}` : `${lv.title} · ${lv.into} / ${lv.need} XP`),
                h("span", { className: "rw-bar" },
                    h("i", { style: { width: lv.pct + "%" } }))),
            h("span", { className: "rw-pts" },
                h("b", null, st.points.toLocaleString()),
                " pts",
                h("small", null, "Redeem \u2192"))));
    }
    /* ----- picker ----- */
    function mountMenu(view, user) {
        stop();
        mountInto(view, h("h1", { className: "view-title" }, "Games"), h("p", { className: "games-intro" }, "Every round earns points and XP. Spend points in Redeem, level up by playing. Your progress is saved on this device."), statusBar(), h("div", { ref: (el) => { if (Rewards.isStaff())
                mountInto(el, Redeem.giveBar(() => mountMenu(view, user))); } }), h("div", { className: "games-grid" }, REGISTRY.map((g) => (h("a", { className: "game-card", href: `#games-${g.id}` },
            h("span", { className: "game-emoji", "aria-hidden": "true" }, g.emoji),
            h("strong", null, g.title),
            h("span", { className: "game-blurb" }, g.blurb),
            h("span", { className: "game-pts" },
                "\u2B50 ",
                g.pointsHint),
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
        let earnedEl;
        let barEl;
        const paintBar = () => mountInto(barEl, statusBar());
        const paintBest = () => { bestEl.textContent = fmtBest(game, readBest(user.id, game.id)); };
        mountInto(view, h("div", { className: "game-head" },
            h("a", { className: "btn-sm", href: "#games" }, "\u2190 All games"),
            h("h1", { className: "view-title game-title" },
                game.emoji,
                " ",
                game.title),
            h("span", { className: "game-best-chip", ref: (el) => (bestEl = el) })), h("div", { ref: (el) => (barEl = el) }), h("div", { ref: (el) => { if (Rewards.isStaff())
                mountInto(el, Redeem.giveBar(paintBar)); } }), h("div", { className: "rw-earned", role: "status", ref: (el) => (earnedEl = el) },
            "Finish a round to earn points: ",
            game.pointsHint,
            "."), h("div", { className: "game-stage", ref: (el) => (stage = el) }));
        paintBest();
        paintBar();
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
            award(points) {
                const r = Rewards.award(game.id, game.title, points);
                paintBar();
                if (!r.pts) {
                    earnedEl.textContent = "No points this round. Finish a round to earn some.";
                    return;
                }
                earnedEl.innerHTML = "";
                earnedEl.append(`+${r.pts.toLocaleString()} points · +${r.xp} XP`);
                earnedEl.classList.remove("pop");
                void earnedEl.offsetWidth;
                earnedEl.classList.add("pop");
                if (r.levelUp) {
                    earnedEl.append(` · 🎉 Level ${r.levelUp}! Bonus +${r.bonus.toLocaleString()} points`);
                    Utils.toast(`Level up! You are now level ${r.levelUp} (+${r.bonus.toLocaleString()} bonus points)`, 4000);
                }
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
