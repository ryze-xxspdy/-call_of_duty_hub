/* ---------- Memory Match: flip two cards at a time, find all pairs in the fewest moves ---------- */
interface MemoryCard { id: number; face: string; flipped: boolean; matched: boolean }

const MEMORY_FACES = ["📚", "🧪", "🎒", "✏️", "🔬", "🎨", "🧮", "🌍"];

const MemoryGame: GameModule = {
  id: "memory",
  title: "Memory Match",
  emoji: "🧠",
  blurb: "Find all 8 pairs in as few moves as you can.",
  scoreLabel: "moves",
  pointsHint: "Up to 300 pts, fewer moves = more",
  lowerIsBetter: true,

  mount(root, api) {
    let cards: MemoryCard[] = [];
    let open: number[] = [];
    let moves = 0;
    let seconds = 0;
    let locked = false;
    let ticker: number | undefined;
    let flipTimer: number | undefined;
    let movesEl: HTMLElement, timeEl: HTMLElement, gridEl: HTMLElement, msgEl: HTMLElement;

    function shuffle<T>(a: T[]): T[] {
      const x = a.slice();
      for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
      return x;
    }

    function newGame() {
      window.clearInterval(ticker); window.clearTimeout(flipTimer);
      cards = shuffle([...MEMORY_FACES, ...MEMORY_FACES]).map((face, id) => ({ id, face, flipped: false, matched: false }));
      open = []; moves = 0; seconds = 0; locked = false;
      ticker = undefined;
      build();
    }

    function startClock() {
      if (ticker) return;
      ticker = window.setInterval(() => { seconds++; timeEl.textContent = fmtTime(); }, 1000);
    }

    const fmtTime = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

    function flip(i: number) {
      const c = cards[i];
      if (locked || c.flipped || c.matched) return;
      startClock();
      c.flipped = true; open.push(i);
      if (open.length === 2) {
        moves++;
        const [a, b] = open.map((n) => cards[n]);
        if (a.face === b.face) {
          a.matched = b.matched = true; open = [];
          if (cards.every((x) => x.matched)) win();
        } else {
          locked = true;
          flipTimer = window.setTimeout(() => { a.flipped = b.flipped = false; open = []; locked = false; paint(); }, 750);
        }
      }
      paint();
    }

    function win() {
      window.clearInterval(ticker);
      const best = api.report(moves);
      api.award(Math.max(50, 400 - moves * 10));
      msgEl.textContent = `Done in ${moves} moves, ${fmtTime()}.` + (best ? " New best! 🎉" : "");
    }

    function paint() {
      movesEl.textContent = String(moves);
      timeEl.textContent = fmtTime();
      mountInto(gridEl, cards.map((c, i) => (
        <button type="button" className={"mem-card" + (c.flipped || c.matched ? " up" : "") + (c.matched ? " done" : "")}
          aria-label={c.flipped || c.matched ? c.face : "Hidden card"} onClick={() => flip(i)}>
          <span>{c.flipped || c.matched ? c.face : "?"}</span>
        </button>
      )));
    }

    function build() {
      mountInto(root,
        <div className="mem">
          <div className="g-toolbar">
            <span className="g-stat">Moves <b ref={(e: HTMLElement) => (movesEl = e)}>0</b></span>
            <span className="g-stat">Time <b ref={(e: HTMLElement) => (timeEl = e)}>0:00</b></span>
            <button type="button" className="btn primary" onClick={newGame}>Restart</button>
          </div>
          <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}></div>
          <div className="mem-grid" ref={(e: HTMLElement) => (gridEl = e)}></div>
        </div>
      );
      paint();
    }

    newGame();
    return () => { window.clearInterval(ticker); window.clearTimeout(flipTimer); };
  }
};
