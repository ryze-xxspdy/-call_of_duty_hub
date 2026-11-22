/* ---------- Simon: watch the colours light up, then repeat the pattern. It grows by one each round. ---------- */
const SimonGame: GameModule = {
  id: "simon",
  title: "Simon Says",
  emoji: "🎵",
  blurb: "Repeat the growing pattern of colours. How long can you last?",
  scoreLabel: "rounds",
  pointsHint: "25 pts per round",

  mount(root, api) {
    const COLORS = ["green", "red", "yellow", "blue"];
    let seq: number[] = [];
    let step = 0;
    let accepting = false;
    let alive = false;
    const timers: number[] = [];
    let pads: HTMLButtonElement[] = [];
    let msgEl: HTMLElement, scoreEl: HTMLElement, startBtn: HTMLButtonElement;

    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
    const flash = (i: number, ms = 380) => { pads[i].classList.add("lit"); later(() => pads[i].classList.remove("lit"), ms); };

    function playback() {
      accepting = false; step = 0;
      msgEl.textContent = "Watch…";
      const gap = Math.max(300, 650 - seq.length * 20);
      seq.forEach((c, k) => later(() => flash(c, gap - 120), 500 + k * gap));
      later(() => { accepting = true; msgEl.textContent = "Your turn"; }, 500 + seq.length * gap);
    }

    function next() { seq.push(Math.floor(Math.random() * 4)); scoreEl.textContent = String(seq.length - 1); playback(); }

    function start() {
      timers.forEach(window.clearTimeout); timers.length = 0;
      seq = []; alive = true; startBtn.textContent = "Restart";
      next();
    }

    function press(i: number) {
      if (!alive || !accepting) return;
      flash(i, 200);
      if (i !== seq[step]) {
        alive = false; accepting = false;
        const score = seq.length - 1;
        const best = api.report(score);
        api.award(score * 25);
        msgEl.textContent = `Wrong colour! You lasted ${score} round${score === 1 ? "" : "s"}.` + (best && score > 0 ? " New best! 🎉" : "");
        startBtn.textContent = "Play again";
        return;
      }
      step++;
      if (step === seq.length) { accepting = false; msgEl.textContent = "Nice!"; later(next, 700); }
    }

    mountInto(root,
      <div className="simon">
        <div className="g-toolbar">
          <span className="g-stat">Rounds <b ref={(e: HTMLElement) => (scoreEl = e)}>0</b></span>
          <button type="button" className="btn primary" ref={(e: HTMLButtonElement) => (startBtn = e)} onClick={start}>Start</button>
        </div>
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}>Press Start</div>
        <div className="simon-grid">
          {COLORS.map((c, i) => (
            <button type="button" className={"simon-pad " + c} aria-label={c} ref={(e: HTMLButtonElement) => pads.push(e)} onPointerdown={(ev: Event) => { ev.preventDefault(); press(i); }}></button>
          ))}
        </div>
      </div>
    );
    return () => { alive = false; timers.forEach(window.clearTimeout); };
  }
};
