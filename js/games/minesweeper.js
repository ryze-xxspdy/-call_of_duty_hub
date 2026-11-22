"use strict";
const MinesweeperGame = {
    id: "minesweeper",
    title: "Minesweeper",
    emoji: "💣",
    blurb: "Clear the board without hitting a mine. Fastest time wins.",
    scoreLabel: "seconds",
    lowerIsBetter: true,
    mount(root, api) {
        const W = 9, H = 9, MINES = 10;
        let cells = [];
        let placed = false;
        let over = false;
        let flagMode = false;
        let seconds = 0;
        let ticker;
        let gridEl, timeEl, minesEl, msgEl, flagBtn;
        const idx = (x, y) => y * W + x;
        function neighbours(i) {
            const x = i % W, y = Math.floor(i / W), out = [];
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy)
                        continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && ny >= 0 && nx < W && ny < H)
                        out.push(idx(nx, ny));
                }
            return out;
        }
        function reset() {
            window.clearInterval(ticker);
            ticker = undefined;
            cells = Array.from({ length: W * H }, () => ({ mine: false, open: false, flag: false, n: 0 }));
            placed = false;
            over = false;
            seconds = 0;
            msgEl.textContent = "";
            paint();
        }
        function placeMines(safe) {
            const banned = new Set([safe, ...neighbours(safe)]);
            let left = MINES;
            while (left > 0) {
                const i = Math.floor(Math.random() * cells.length);
                if (cells[i].mine || banned.has(i))
                    continue;
                cells[i].mine = true;
                left--;
            }
            cells.forEach((c, i) => { c.n = neighbours(i).filter((j) => cells[j].mine).length; });
            placed = true;
            ticker = window.setInterval(() => { seconds++; timeEl.textContent = String(seconds); }, 1000);
        }
        function openCell(i) {
            const stack = [i];
            while (stack.length) {
                const k = stack.pop();
                const c = cells[k];
                if (c.open || c.flag)
                    continue;
                c.open = true;
                if (c.n === 0 && !c.mine)
                    stack.push(...neighbours(k));
            }
        }
        function click(i) {
            if (over)
                return;
            const c = cells[i];
            if (flagMode) {
                if (!c.open)
                    c.flag = !c.flag;
                paint();
                return;
            }
            if (c.flag || c.open)
                return;
            if (!placed)
                placeMines(i);
            if (c.mine) {
                over = true;
                window.clearInterval(ticker);
                cells.forEach((x) => { if (x.mine)
                    x.open = true; });
                msgEl.textContent = "Boom! You hit a mine. Press Restart.";
            }
            else {
                openCell(i);
                if (cells.every((x) => x.mine || x.open)) {
                    over = true;
                    window.clearInterval(ticker);
                    const best = api.report(seconds);
                    msgEl.textContent = `Cleared in ${seconds}s!` + (best ? " New best! 🎉" : "");
                }
            }
            paint();
        }
        function paint() {
            timeEl.textContent = String(seconds);
            minesEl.textContent = String(MINES - cells.filter((c) => c.flag).length);
            flagBtn.className = "btn" + (flagMode ? " primary" : "");
            mountInto(gridEl, cells.map((c, i) => (h("button", { type: "button", className: "ms-cell" + (c.open ? " open" : "") + (c.open && c.mine ? " mine" : "") + (c.open && c.n ? " n" + c.n : ""), "aria-label": c.open ? (c.mine ? "Mine" : c.n + " nearby") : c.flag ? "Flagged" : "Hidden", onClick: () => click(i), onContextmenu: (e) => { e.preventDefault(); if (!over && !c.open) {
                    c.flag = !c.flag;
                    paint();
                } } }, c.open ? (c.mine ? "💣" : c.n || "") : c.flag ? "🚩" : ""))));
        }
        mountInto(root, h("div", { className: "ms" },
            h("div", { className: "g-toolbar" },
                h("span", { className: "g-stat" },
                    "Mines ",
                    h("b", { ref: (e) => (minesEl = e) }, "10")),
                h("span", { className: "g-stat" },
                    "Time ",
                    h("b", { ref: (e) => (timeEl = e) }, "0")),
                h("button", { type: "button", className: "btn", ref: (e) => (flagBtn = e), onClick: () => { flagMode = !flagMode; paint(); } }, "\uD83D\uDEA9 Flag mode"),
                h("button", { type: "button", className: "btn primary", onClick: reset }, "Restart")),
            h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }),
            h("div", { className: "ms-grid", ref: (e) => (gridEl = e) }),
            h("p", { className: "g-hint" }, "Tap to open. Turn on Flag mode (or right-click) to mark mines.")));
        reset();
        return () => window.clearInterval(ticker);
    }
};
