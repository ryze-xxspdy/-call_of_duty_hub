/* ---------- Games hub ----------
   Replaces the old Calendar page. #games shows the picker, #games-<id> opens one game.
   Each game lives in its own file (src/games/<name>.tsx) and registers itself in the list below. */
const Games = (() => {
  const REGISTRY: GameModule[] = [
    TicTacToeGame, SnakeGame, MemoryGame, Game2048, MinesweeperGame, MathSprintGame
  ];

  let cleanup: (() => void) | null = null;

  /* ----- personal bests, kept per account in this browser ----- */
  const key = (uid: string, id: string) => `confesshub.games.${uid}.${id}`;

  function readBest(uid: string, id: string): number | null {
    try {
      const v = localStorage.getItem(key(uid, id));
      return v === null ? null : Number(v);
    } catch { return null; }
  }

  function writeBest(uid: string, id: string, value: number): void {
    try { localStorage.setItem(key(uid, id), String(value)); } catch { /* storage blocked: bests just aren't saved */ }
  }

  function stop(): void {
    if (cleanup) { cleanup(); cleanup = null; }
  }

  function fmtBest(g: GameModule, v: number | null): string {
    return v === null ? "No score yet" : `Best: ${v} ${g.scoreLabel}`;
  }

  /* ----- picker ----- */
  function mountMenu(view: HTMLElement, user: { id: string }): void {
    stop();
    mountInto(view,
      <h1 className="view-title">Games</h1>,
      <p className="games-intro">Take a break between classes. Your best scores are saved on this device.</p>,
      <div className="games-grid">
        {REGISTRY.map((g) => (
          <a className="game-card" href={`#games-${g.id}`}>
            <span className="game-emoji" aria-hidden="true">{g.emoji}</span>
            <strong>{g.title}</strong>
            <span className="game-blurb">{g.blurb}</span>
            <span className="game-best">{fmtBest(g, readBest(user.id, g.id))}</span>
          </a>
        ))}
      </div>
    );
  }

  /* ----- one game ----- */
  function mountGame(view: HTMLElement, user: { id: string }, id: string): void {
    stop();
    const game = REGISTRY.find((g) => g.id === id);
    if (!game) { mountMenu(view, user); return; }

    let bestEl: HTMLElement;
    let stage: HTMLElement;
    const paintBest = () => { bestEl.textContent = fmtBest(game, readBest(user.id, game.id)); };

    mountInto(view,
      <div className="game-head">
        <a className="btn-sm" href="#games">← All games</a>
        <h1 className="view-title game-title">{game.emoji} {game.title}</h1>
        <span className="game-best-chip" ref={(el: HTMLElement) => (bestEl = el)}></span>
      </div>,
      <div className="game-stage" ref={(el: HTMLElement) => (stage = el)}></div>
    );
    paintBest();

    const api: GameApi = {
      best: () => readBest(user.id, game.id),
      report(score) {
        if (!game.lowerIsBetter && score <= 0) return false;   // a zero isn't worth saving
        const prev = readBest(user.id, game.id);
        const better = prev === null || (game.lowerIsBetter ? score < prev : score > prev);
        if (better) { writeBest(user.id, game.id, score); paintBest(); }
        return better;
      },
      toast: (m) => Utils.toast(m, 2600)
    };
    cleanup = game.mount(stage, api);
  }

  /** Route entry: hash is "games" or "games-<id>". */
  function mount(view: HTMLElement, user: { id: string }, hash: string): void {
    const id = hash.startsWith("games-") ? hash.slice("games-".length) : "";
    if (id) mountGame(view, user, id); else mountMenu(view, user);
  }

  return { mount, stop };
})();
