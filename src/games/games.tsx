/* ---------- Games hub ----------
   Replaces the old Calendar page. #games shows the picker, #games-<id> opens one game.
   Each game lives in its own file (src/games/<name>.tsx) and registers itself in the list below. */
const Games = (() => {
  const REGISTRY: GameModule[] = [
    TicTacToeGame, SnakeGame, MemoryGame, Game2048, MinesweeperGame, MathSprintGame,
    WhackGame, ReactionGame, SimonGame, ScrambleGame, Connect4Game, TypingGame, QuizGame
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

  /** Level + points banner shown at the top of the games pages. */
  function statusBar(): Node {
    const lv = Rewards.level(), st = Rewards.get();
    return (
      <a className="rw-banner" href="#redeem" title="Open the Redeem shop">
        <span className="rw-lv">⭐<b>Lv {lv.level}</b></span>
        <span className="rw-mid">
          <span className="rw-title">{lv.max ? `${lv.title} · Level ${lv.level}` : `${lv.title} · ${lv.into} / ${lv.need} XP`}</span>
          <span className="rw-bar"><i style={{ width: lv.pct + "%" }}></i></span>
        </span>
        <span className="rw-pts"><b>{st.points.toLocaleString()}</b> pts<small>Redeem →</small></span>
      </a>
    );
  }

  /* ----- picker ----- */
  function mountMenu(view: HTMLElement, user: { id: string }): void {
    stop();
    mountInto(view,
      <h1 className="view-title">Games</h1>,
      <p className="games-intro">Every round earns points and XP. Spend points in Redeem, level up by playing. Your progress is saved on this device.</p>,
      statusBar(),
      <div ref={(el: HTMLElement) => { if (Rewards.isStaff()) mountInto(el, Redeem.giveBar(() => mountMenu(view, user))); }}></div>,
      <div className="games-grid">
        {REGISTRY.map((g) => (
          <a className="game-card" href={`#games-${g.id}`}>
            <span className="game-emoji" aria-hidden="true">{g.emoji}</span>
            <strong>{g.title}</strong>
            <span className="game-blurb">{g.blurb}</span>
            <span className="game-pts">⭐ {g.pointsHint}</span>
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
    let earnedEl: HTMLElement;
    let barEl: HTMLElement;
    const paintBar = () => mountInto(barEl, statusBar());
    const paintBest = () => { bestEl.textContent = fmtBest(game, readBest(user.id, game.id)); };

    mountInto(view,
      <div className="game-head">
        <a className="btn-sm" href="#games">← All games</a>
        <h1 className="view-title game-title">{game.emoji} {game.title}</h1>
        <span className="game-best-chip" ref={(el: HTMLElement) => (bestEl = el)}></span>
      </div>,
      <div ref={(el: HTMLElement) => (barEl = el)}></div>,
      <div ref={(el: HTMLElement) => { if (Rewards.isStaff()) mountInto(el, Redeem.giveBar(paintBar)); }}></div>,
      <div className="rw-earned" role="status" ref={(el: HTMLElement) => (earnedEl = el)}>Finish a round to earn points: {game.pointsHint}.</div>,
      <div className="game-stage" ref={(el: HTMLElement) => (stage = el)}></div>
    );
    paintBest();
    paintBar();

    const api: GameApi = {
      best: () => readBest(user.id, game.id),
      report(score) {
        if (!game.lowerIsBetter && score <= 0) return false;   // a zero isn't worth saving
        const prev = readBest(user.id, game.id);
        const better = prev === null || (game.lowerIsBetter ? score < prev : score > prev);
        if (better) { writeBest(user.id, game.id, score); paintBest(); }
        return better;
      },
      award(points) {
        const r = Rewards.award(game.id, game.title, points);
        paintBar();
        if (!r.pts) { earnedEl.textContent = "No points this round. Finish a round to earn some."; return; }
        earnedEl.innerHTML = "";
        earnedEl.append(`+${r.pts.toLocaleString()} points · +${r.xp} XP`);
        earnedEl.classList.remove("pop"); void earnedEl.offsetWidth; earnedEl.classList.add("pop");
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
  function mount(view: HTMLElement, user: { id: string }, hash: string): void {
    const id = hash.startsWith("games-") ? hash.slice("games-".length) : "";
    if (id) mountGame(view, user, id); else mountMenu(view, user);
  }

  return { mount, stop };
})();
