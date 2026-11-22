/* ---------- Minesweeper 9x9 with 10 mines. First click is always safe. ---------- */
interface MineCell { mine: boolean; open: boolean; flag: boolean; n: number }

const MinesweeperGame: GameModule = {
  id: "minesweeper",
  title: "Minesweeper",
  emoji: "💣",
  blurb: "Clear the board without hitting a mine. Fastest time wins.",
  scoreLabel: "seconds",
  pointsHint: "300+ pts for a clear",
  lowerIsBetter: true,

  mount(root, api) {
    const W = 9, H = 9, MINES = 10;
    let cells: MineCell[] = [];
    let placed = false;
    let over = false;
    let flagMode = false;
    let seconds = 0;
    let ticker: number | undefined;
    let gridEl: HTMLElement, timeEl: HTMLElement, minesEl: HTMLElement, msgEl: HTMLElement, flagBtn: HTMLElement;

    const idx = (x: number, y: number) => y * W + x;
    function neighbours(i: number): number[] {
      const x = i % W, y = Math.floor(i / W), out: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(idx(nx, ny));
      }
      return out;
    }

    function reset() {
      window.clearInterval(ticker); ticker = undefined;
      cells = Array.from({ length: W * H }, () => ({ mine: false, open: false, flag: false, n: 0 }));
      placed = false; over = false; seconds = 0;
      msgEl.textContent = "";
      paint();
    }

    function placeMines(safe: number) {
      const banned = new Set([safe, ...neighbours(safe)]);
      let left = MINES;
      while (left > 0) {
        const i = Math.floor(Math.random() * cells.length);
        if (cells[i].mine || banned.has(i)) continue;
        cells[i].mine = true; left--;
      }
      cells.forEach((c, i) => { c.n = neighbours(i).filter((j) => cells[j].mine).length; });
      placed = true;
      ticker = window.setInterval(() => { seconds++; timeEl.textContent = String(seconds); }, 1000);
    }

    function openCell(i: number) {
      const stack = [i];
      while (stack.length) {
        const k = stack.pop() as number;
        const c = cells[k];
        if (c.open || c.flag) continue;
        c.open = true;
        if (c.n === 0 && !c.mine) stack.push(...neighbours(k));
      }
    }

    function click(i: number) {
      if (over) return;
      const c = cells[i];
      if (flagMode) { if (!c.open) c.flag = !c.flag; paint(); return; }
      if (c.flag || c.open) return;
      if (!placed) placeMines(i);
      if (c.mine) {
        over = true; window.clearInterval(ticker);
        api.award(cells.filter((x) => x.open).length * 2);   // a little for the cells you cleared
        cells.forEach((x) => { if (x.mine) x.open = true; });
        msgEl.textContent = "Boom! You hit a mine. Press Restart.";
      } else {
        openCell(i);
        if (cells.every((x) => x.mine || x.open)) {
          over = true; window.clearInterval(ticker);
          const best = api.report(seconds);
          api.award(300 + Math.max(0, 200 - seconds));
          msgEl.textContent = `Cleared in ${seconds}s!` + (best ? " New best! 🎉" : "");
        }
      }
      paint();
    }

    function paint() {
      timeEl.textContent = String(seconds);
      minesEl.textContent = String(MINES - cells.filter((c) => c.flag).length);
      flagBtn.className = "btn" + (flagMode ? " primary" : "");
      mountInto(gridEl, cells.map((c, i) => (
        <button type="button" className={"ms-cell" + (c.open ? " open" : "") + (c.open && c.mine ? " mine" : "") + (c.open && c.n ? " n" + c.n : "")}
          aria-label={c.open ? (c.mine ? "Mine" : c.n + " nearby") : c.flag ? "Flagged" : "Hidden"}
          onClick={() => click(i)}
          onContextmenu={(e: Event) => { e.preventDefault(); if (!over && !c.open) { c.flag = !c.flag; paint(); } }}>
          {c.open ? (c.mine ? "💣" : c.n || "") : c.flag ? "🚩" : ""}
        </button>
      )));
    }

    mountInto(root,
      <div className="ms">
        <div className="g-toolbar">
          <span className="g-stat">Mines <b ref={(e: HTMLElement) => (minesEl = e)}>10</b></span>
          <span className="g-stat">Time <b ref={(e: HTMLElement) => (timeEl = e)}>0</b></span>
          <button type="button" className="btn" ref={(e: HTMLElement) => (flagBtn = e)} onClick={() => { flagMode = !flagMode; paint(); }}>🚩 Flag mode</button>
          <button type="button" className="btn primary" onClick={reset}>Restart</button>
        </div>
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}></div>
        <div className="ms-grid" ref={(e: HTMLElement) => (gridEl = e)}></div>
        <p className="g-hint">Tap to open. Turn on Flag mode (or right-click) to mark mines.</p>
      </div>
    );
    reset();
    return () => window.clearInterval(ticker);
  }
};
