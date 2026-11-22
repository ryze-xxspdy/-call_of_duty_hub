/* ---------- 2048: slide tiles, merge equal numbers. Arrow keys, WASD or swipe. ---------- */
const Game2048: GameModule = {
  id: "2048",
  title: "2048",
  emoji: "🔢",
  blurb: "Merge matching tiles and reach 2048.",
  scoreLabel: "points",

  mount(root, api) {
    const SIZE = 4;
    let grid: number[][] = [];
    let score = 0;
    let over = false;
    let won = false;
    let boardEl: HTMLElement, scoreEl: HTMLElement, msgEl: HTMLElement;

    function empty(): number[][] { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

    function addTile() {
      const free: [number, number][] = [];
      grid.forEach((row, r) => row.forEach((v, c) => { if (!v) free.push([r, c]); }));
      if (!free.length) return;
      const [r, c] = free[Math.floor(Math.random() * free.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }

    function reset() {
      grid = empty(); score = 0; over = false; won = false;
      addTile(); addTile();
      paint();
    }

    /** Slide one row to the left; returns the new row and the points gained. */
    function slideRow(row: number[]): { row: number[]; gained: number } {
      const vals = row.filter(Boolean);
      const out: number[] = [];
      let gained = 0;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); gained += vals[i] * 2; i++; }
        else out.push(vals[i]);
      }
      while (out.length < SIZE) out.push(0);
      return { row: out, gained };
    }

    const rotate = (g: number[][]) => g[0].map((_, c) => g.map((row) => row[c]).reverse());   // 90° clockwise

    /** dir: 0 left, 1 up, 2 right, 3 down. */
    function move(dir: number) {
      if (over) return;
      let g = grid.map((r) => r.slice());
      const turns = [0, 3, 2, 1][dir];       // rotate so the move becomes "left"
      for (let i = 0; i < turns; i++) g = rotate(g);
      let gained = 0;
      g = g.map((row) => { const s = slideRow(row); gained += s.gained; return s.row; });
      for (let i = 0; i < (4 - turns) % 4; i++) g = rotate(g);
      if (JSON.stringify(g) === JSON.stringify(grid)) return;   // nothing moved
      grid = g; score += gained;
      addTile();
      if (!won && grid.some((r) => r.includes(2048))) { won = true; api.toast("You reached 2048! 🎉"); }
      if (!canMove()) { over = true; api.report(score); }
      paint();
    }

    function canMove(): boolean {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
      }
      return false;
    }

    function paint() {
      scoreEl.textContent = String(score);
      const best = Math.max(api.best() || 0, over ? score : 0);
      msgEl.textContent = over ? `Game over: ${score} points. Best ${best}.` : (api.best() ? `Best: ${api.best()}` : "");
      mountInto(boardEl, grid.flat().map((v) => (
        <div className={"t2048 v" + (v > 2048 ? "big" : v)}>{v || ""}</div>
      )));
    }

    const KEYS: Record<string, number> = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, a: 0, w: 1, d: 2, s: 3 };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (d === undefined) return;
      e.preventDefault(); move(d);
    };
    document.addEventListener("keydown", onKey);

    let sx = 0, sy = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
    };

    mountInto(root,
      <div className="g2048">
        <div className="g-toolbar">
          <span className="g-stat">Score <b ref={(e: HTMLElement) => (scoreEl = e)}>0</b></span>
          <button type="button" className="btn primary" onClick={reset}>New game</button>
        </div>
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}></div>
        <div className="board2048" ref={(e: HTMLElement) => {
          boardEl = e;
          e.addEventListener("touchstart", onStart, { passive: true });
          e.addEventListener("touchend", onEnd, { passive: true });
        }}></div>
        <p className="g-hint">Arrow keys, WASD or swipe to slide the tiles.</p>
      </div>
    );
    reset();
    return () => document.removeEventListener("keydown", onKey);
  }
};
