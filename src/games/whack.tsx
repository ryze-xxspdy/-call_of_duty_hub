/* ---------- Whack-a-Mole: 30 seconds, tap every mole that pops up ---------- */
const WhackGame: GameModule = {
  id: "whack",
  title: "Whack-a-Mole",
  emoji: "🔨",
  blurb: "Moles pop up fast. Tap them before they hide. 30 seconds.",
  scoreLabel: "moles",
  pointsHint: "20 pts per mole",

  mount(root, api) {
    const ROUND = 30;
    let score = 0, timeLeft = ROUND, active = -1, playing = false;
    let tick: number | undefined, hideT: number | undefined, popT: number | undefined;
    let timeEl: HTMLElement, scoreEl: HTMLElement, msgEl: HTMLElement, startBtn: HTMLButtonElement;
    const holes: HTMLButtonElement[] = [];

    function show(i: number) {
      active = i;
      holes.forEach((b, k) => { b.textContent = k === i ? "🐹" : ""; b.classList.toggle("up", k === i); });
    }

    function pop() {
      if (!playing) return;
      let i = Math.floor(Math.random() * 9);
      if (i === active) i = (i + 1 + Math.floor(Math.random() * 8)) % 9;
      show(i);
      const stay = Math.max(420, 900 - score * 15);
      hideT = window.setTimeout(() => { show(-1); popT = window.setTimeout(pop, 150 + Math.random() * 250); }, stay);
    }

    function hit(i: number) {
      if (!playing || i !== active) return;
      score++; scoreEl.textContent = String(score);
      window.clearTimeout(hideT);
      show(-1);
      popT = window.setTimeout(pop, 120);
    }

    function stopAll() { window.clearInterval(tick); window.clearTimeout(hideT); window.clearTimeout(popT); }

    function finish() {
      stopAll(); playing = false; show(-1);
      const best = api.report(score);
      api.award(score * 20);
      msgEl.textContent = `Time's up! You whacked ${score}.` + (best && score > 0 ? " New best! 🎉" : "");
      startBtn.textContent = "Play again";
    }

    function start() {
      stopAll();
      score = 0; timeLeft = ROUND; playing = true;
      scoreEl.textContent = "0"; timeEl.textContent = String(ROUND); msgEl.textContent = "";
      startBtn.textContent = "Restart";
      popT = window.setTimeout(pop, 400);
      tick = window.setInterval(() => { timeLeft--; timeEl.textContent = String(timeLeft); if (timeLeft <= 0) finish(); }, 1000);
    }

    mountInto(root,
      <div className="whack">
        <div className="g-toolbar">
          <span className="g-stat">Time <b ref={(e: HTMLElement) => (timeEl = e)}>30</b></span>
          <span className="g-stat">Moles <b ref={(e: HTMLElement) => (scoreEl = e)}>0</b></span>
          <button type="button" className="btn primary" ref={(e: HTMLButtonElement) => (startBtn = e)} onClick={start}>Start</button>
        </div>
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}>Press Start</div>
        <div className="whack-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <button type="button" className="whack-hole" aria-label={`Hole ${i + 1}`} ref={(e: HTMLButtonElement) => holes.push(e)} onPointerdown={(ev: Event) => { ev.preventDefault(); hit(i); }}></button>
          ))}
        </div>
      </div>
    );
    return () => { playing = false; stopAll(); };
  }
};
