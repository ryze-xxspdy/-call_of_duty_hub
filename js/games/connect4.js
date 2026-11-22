"use strict";
/* ---------- Connect Four (you are red, the computer is yellow) ---------- */
const C4_ROWS = 6, C4_COLS = 7;
function c4Drop(b, col, who) {
    for (let r = C4_ROWS - 1; r >= 0; r--)
        if (!b[r][col]) {
            b[r][col] = who;
            return r;
        }
    return -1;
}
function c4Four(b) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < C4_ROWS; r++)
        for (let c = 0; c < C4_COLS; c++) {
            const who = b[r][c];
            if (!who)
                continue;
            for (const [dr, dc] of dirs) {
                const cells = [[r, c]];
                for (let k = 1; k < 4; k++) {
                    const rr = r + dr * k, cc = c + dc * k;
                    if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || b[rr][cc] !== who)
                        break;
                    cells.push([rr, cc]);
                }
                if (cells.length === 4)
                    return { who, cells };
            }
        }
    return null;
}
/** Rough strength of the board for the computer: centre column and open "threes" are good. */
function c4Eval(b) {
    let s = 0;
    for (let r = 0; r < C4_ROWS; r++)
        if (b[r][3] === 2)
            s += 3;
        else if (b[r][3] === 1)
            s -= 3;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < C4_ROWS; r++)
        for (let c = 0; c < C4_COLS; c++)
            for (const [dr, dc] of dirs) {
                const er = r + dr * 3, ec = c + dc * 3;
                if (er < 0 || er >= C4_ROWS || ec < 0 || ec >= C4_COLS)
                    continue;
                let me = 0, you = 0;
                for (let k = 0; k < 4; k++) {
                    const v = b[r + dr * k][c + dc * k];
                    if (v === 2)
                        me++;
                    else if (v === 1)
                        you++;
                }
                if (me && !you)
                    s += me === 3 ? 5 : me === 2 ? 2 : 0;
                if (you && !me)
                    s -= you === 3 ? 6 : you === 2 ? 2 : 0;
            }
    return s;
}
function c4Search(b, depth, alpha, beta, turn) {
    const f = c4Four(b);
    if (f)
        return f.who === 2 ? 1000 + depth : -1000 - depth;
    const moves = [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[0][c]);
    if (!moves.length)
        return 0;
    if (depth === 0)
        return c4Eval(b);
    let best = turn === 2 ? -Infinity : Infinity;
    for (const c of moves) {
        const r = c4Drop(b, c, turn);
        const v = c4Search(b, depth - 1, alpha, beta, turn === 2 ? 1 : 2);
        b[r][c] = 0;
        if (turn === 2) {
            best = Math.max(best, v);
            alpha = Math.max(alpha, v);
        }
        else {
            best = Math.min(best, v);
            beta = Math.min(beta, v);
        }
        if (beta <= alpha)
            break;
    }
    return best;
}
function c4Pick(b, hard) {
    const moves = [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[0][c]);
    if (!hard && Math.random() < 0.35)
        return moves[Math.floor(Math.random() * moves.length)];
    let best = -Infinity, pick = moves[0];
    for (const c of moves) {
        const r = c4Drop(b, c, 2);
        const v = c4Search(b, hard ? 4 : 2, -Infinity, Infinity, 1);
        b[r][c] = 0;
        if (v > best) {
            best = v;
            pick = c;
        }
    }
    return pick;
}
const Connect4Game = {
    id: "connect4",
    title: "Connect Four",
    emoji: "🔴",
    blurb: "Line up four in a row before the computer does.",
    scoreLabel: "wins",
    pointsHint: "Win 150 (hard 250), draw 30",
    mount(root, api) {
        let board = [];
        let hard = false, over = false, thinking = false, status = "", winCells = [];
        let wins = api.best() || 0;
        const tally = { win: 0, lose: 0, draw: 0 };
        let timer;
        function reset() {
            window.clearTimeout(timer);
            board = Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0));
            over = false;
            thinking = false;
            winCells = [];
            status = "Your turn (red)";
            draw();
        }
        function check() {
            const f = c4Four(board);
            if (f) {
                over = true;
                winCells = f.cells;
                if (f.who === 1) {
                    tally.win++;
                    wins++;
                    status = "You win! 🎉";
                    api.award(hard ? 250 : 150);
                    if (api.report(wins))
                        api.toast("New best: " + wins + " wins");
                }
                else {
                    tally.lose++;
                    status = "Computer wins";
                    api.award(10);
                }
            }
            else if (board[0].every(Boolean)) {
                over = true;
                tally.draw++;
                status = "It's a draw";
                api.award(30);
            }
            return over;
        }
        function play(col) {
            if (over || thinking || board[0][col])
                return;
            c4Drop(board, col, 1);
            if (check()) {
                draw();
                return;
            }
            thinking = true;
            status = "Computer is thinking…";
            draw();
            timer = window.setTimeout(() => {
                c4Drop(board, c4Pick(board, hard), 2);
                thinking = false;
                if (!check())
                    status = "Your turn (red)";
                draw();
            }, 350);
        }
        function draw() {
            mountInto(root, h("div", { className: "c4" },
                h("div", { className: "g-toolbar" },
                    h("div", { className: "seg", role: "group", "aria-label": "Difficulty" },
                        h("button", { type: "button", className: !hard ? "on" : "", onClick: () => { hard = false; reset(); } }, "Easy"),
                        h("button", { type: "button", className: hard ? "on" : "", onClick: () => { hard = true; reset(); } }, "Hard")),
                    h("span", { className: "g-stat" },
                        "W ",
                        tally.win,
                        " \u00B7 L ",
                        tally.lose,
                        " \u00B7 D ",
                        tally.draw)),
                h("div", { className: "g-status", role: "status" }, status),
                h("div", { className: "c4-board" }, Array.from({ length: C4_COLS }, (_, c) => (h("button", { type: "button", className: "c4-col", "aria-label": `Drop in column ${c + 1}`, disabled: over || !!board[0][c], onClick: () => play(c) }, Array.from({ length: C4_ROWS }, (_, r) => (h("span", { className: "c4-cell" + (board[r][c] ? " p" + board[r][c] : "") + (winCells.some(([wr, wc]) => wr === r && wc === c) ? " win" : "") }))))))),
                h("button", { type: "button", className: "btn primary", onClick: reset }, "New game")));
        }
        reset();
        return () => window.clearTimeout(timer);
    }
};
