"use strict";
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) {
    for (const l of LINES) {
        const [a, c, d] = l;
        if (b[a] && b[a] === b[c] && b[a] === b[d])
            return { who: b[a], line: l };
    }
    return null;
}
/** Perfect play: returns the score of the board from O's point of view (+ good for O). */
function minimax(b, turn, depth) {
    const w = tttWinner(b);
    if (w)
        return w.who === "O" ? 10 - depth : depth - 10;
    if (b.every(Boolean))
        return 0;
    let best = turn === "O" ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
        if (b[i])
            continue;
        b[i] = turn;
        const s = minimax(b, turn === "O" ? "X" : "O", depth + 1);
        b[i] = null;
        best = turn === "O" ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
}
function tttPickMove(b, level) {
    const free = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    if (level === "easy" && Math.random() < 0.6)
        return free[Math.floor(Math.random() * free.length)];
    let bestScore = -Infinity, move = free[0];
    for (const i of free) {
        b[i] = "O";
        const s = minimax(b, "X", 1);
        b[i] = null;
        if (s > bestScore) {
            bestScore = s;
            move = i;
        }
    }
    return move;
}
const TicTacToeGame = {
    id: "tictactoe",
    title: "Tic-Tac-Toe",
    emoji: "❌",
    blurb: "Beat the computer. Hard mode never loses a game it can win.",
    scoreLabel: "wins",
    pointsHint: "Win 100 (hard 200), draw 20",
    mount(root, api) {
        let board = Array(9).fill(null);
        let level = "easy";
        let over = false;
        let thinking = false;
        let timer;
        const tally = { win: 0, lose: 0, draw: 0 };
        let status = "Your turn (X)";
        let winLine = [];
        let wins = api.best() || 0;
        function finish() {
            const w = tttWinner(board);
            if (w) {
                over = true;
                winLine = w.line;
                if (w.who === "X") {
                    tally.win++;
                    wins++;
                    api.award(level === "hard" ? 200 : 100);
                    status = "You win! 🎉";
                    if (api.report(wins))
                        api.toast("New best: " + wins + " wins");
                }
                else {
                    tally.lose++;
                    status = "Computer wins";
                    api.award(10);
                }
            }
            else if (board.every(Boolean)) {
                over = true;
                tally.draw++;
                status = "It's a draw";
                api.award(level === "hard" ? 40 : 20);
            }
            return over;
        }
        function play(i) {
            if (over || thinking || board[i])
                return;
            board[i] = "X";
            if (!finish()) {
                thinking = true;
                status = "Computer is thinking…";
                draw();
                timer = window.setTimeout(() => {
                    board[tttPickMove(board, level)] = "O";
                    thinking = false;
                    if (!finish())
                        status = "Your turn (X)";
                    draw();
                }, 350);
                return;
            }
            draw();
        }
        function reset() {
            window.clearTimeout(timer);
            board = Array(9).fill(null);
            over = false;
            thinking = false;
            winLine = [];
            status = "Your turn (X)";
            draw();
        }
        function setLevel(l) { level = l; reset(); }
        function draw() {
            mountInto(root, h("div", { className: "ttt" },
                h("div", { className: "g-toolbar" },
                    h("div", { className: "seg", role: "group", "aria-label": "Difficulty" },
                        h("button", { type: "button", className: level === "easy" ? "on" : "", onClick: () => setLevel("easy") }, "Easy"),
                        h("button", { type: "button", className: level === "hard" ? "on" : "", onClick: () => setLevel("hard") }, "Hard")),
                    h("span", { className: "g-stat" },
                        "W ",
                        tally.win,
                        " \u00B7 L ",
                        tally.lose,
                        " \u00B7 D ",
                        tally.draw)),
                h("div", { className: "g-status", role: "status" }, status),
                h("div", { className: "ttt-board" }, board.map((c, i) => (h("button", { type: "button", className: "ttt-cell" + (c ? " " + c : "") + (winLine.includes(i) ? " win" : ""), "aria-label": `Square ${i + 1}${c ? ", " + c : ""}`, disabled: !!c || over, onClick: () => play(i) }, c)))),
                h("button", { type: "button", className: "btn primary", onClick: reset }, "New game")));
        }
        draw();
        return () => window.clearTimeout(timer);
    }
};
