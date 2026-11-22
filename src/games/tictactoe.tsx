/* ---------- Tic-Tac-Toe (you are X, the computer is O) ---------- */
type Cell = "X" | "O" | null;
type Level = "easy" | "hard";

const LINES: number[][] = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function tttWinner(b: Cell[]): { who: Cell; line: number[] } | null {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: l };
  }
  return null;
}

/** Perfect play: returns the score of the board from O's point of view (+ good for O). */
function minimax(b: Cell[], turn: "X" | "O", depth: number): number {
  const w = tttWinner(b);
  if (w) return w.who === "O" ? 10 - depth : depth - 10;
  if (b.every(Boolean)) return 0;
  let best = turn === "O" ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const s = minimax(b, turn === "O" ? "X" : "O", depth + 1);
    b[i] = null;
    best = turn === "O" ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

function tttPickMove(b: Cell[], level: Level): number {
  const free = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (level === "easy" && Math.random() < 0.6) return free[Math.floor(Math.random() * free.length)];
  let bestScore = -Infinity, move = free[0];
  for (const i of free) {
    b[i] = "O";
    const s = minimax(b, "X", 1);
    b[i] = null;
    if (s > bestScore) { bestScore = s; move = i; }
  }
  return move;
}

const TicTacToeGame: GameModule = {
  id: "tictactoe",
  title: "Tic-Tac-Toe",
  emoji: "❌",
  blurb: "Beat the computer. Hard mode never loses a game it can win.",
  scoreLabel: "wins",

  mount(root, api) {
    let board: Cell[] = Array(9).fill(null);
    let level: Level = "easy";
    let over = false;
    let thinking = false;
    let timer: number | undefined;
    const tally = { win: 0, lose: 0, draw: 0 };
    let status = "Your turn (X)";
    let winLine: number[] = [];
    let wins = api.best() || 0;

    function finish() {
      const w = tttWinner(board);
      if (w) {
        over = true; winLine = w.line;
        if (w.who === "X") { tally.win++; wins++; status = "You win! 🎉"; if (api.report(wins)) api.toast("New best: " + wins + " wins"); }
        else { tally.lose++; status = "Computer wins"; }
      } else if (board.every(Boolean)) { over = true; tally.draw++; status = "It's a draw"; }
      return over;
    }

    function play(i: number) {
      if (over || thinking || board[i]) return;
      board[i] = "X";
      if (!finish()) {
        thinking = true; status = "Computer is thinking…"; draw();
        timer = window.setTimeout(() => {
          board[tttPickMove(board, level)] = "O";
          thinking = false;
          if (!finish()) status = "Your turn (X)";
          draw();
        }, 350);
        return;
      }
      draw();
    }

    function reset() {
      window.clearTimeout(timer);
      board = Array(9).fill(null); over = false; thinking = false; winLine = []; status = "Your turn (X)";
      draw();
    }

    function setLevel(l: Level) { level = l; reset(); }

    function draw() {
      mountInto(root,
        <div className="ttt">
          <div className="g-toolbar">
            <div className="seg" role="group" aria-label="Difficulty">
              <button type="button" className={level === "easy" ? "on" : ""} onClick={() => setLevel("easy")}>Easy</button>
              <button type="button" className={level === "hard" ? "on" : ""} onClick={() => setLevel("hard")}>Hard</button>
            </div>
            <span className="g-stat">W {tally.win} · L {tally.lose} · D {tally.draw}</span>
          </div>
          <div className="g-status" role="status">{status}</div>
          <div className="ttt-board">
            {board.map((c, i) => (
              <button type="button" className={"ttt-cell" + (c ? " " + c : "") + (winLine.includes(i) ? " win" : "")}
                aria-label={`Square ${i + 1}${c ? ", " + c : ""}`} disabled={!!c || over} onClick={() => play(i)}>{c}</button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={reset}>New game</button>
        </div>
      );
    }

    draw();
    return () => window.clearTimeout(timer);
  }
};
