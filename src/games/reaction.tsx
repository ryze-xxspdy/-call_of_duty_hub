/* ---------- Reaction Test: wait for green, tap as fast as you can. Average of 5 rounds. ---------- */
const ReactionGame: GameModule = {
  id: "reaction",
  title: "Reaction Test",
  emoji: "⚡",
  blurb: "Wait for the box to turn green, then tap. Five rounds.",
  scoreLabel: "ms avg",
  pointsHint: "Up to 500 pts, faster = more",
  lowerIsBetter: true,

  mount(root, api) {
    const ROUNDS = 5;
    type Phase = "idle" | "wait" | "go" | "result" | "done";
    let phase: Phase = "idle";
    let times: number[] = [];
    let goAt = 0;
    let timer: number | undefined;
    let box: HTMLButtonElement, msgEl: HTMLElement, listEl: HTMLElement;

    function paint(text: string, cls: string) {
      box.className = "rx-box " + cls;
      box.textContent = text;
      listEl.textContent = times.length ? "Rounds: " + times.map((t) => t + " ms").join(" · ") : "";
    }

    function begin() {
      phase = "wait";
      paint("Wait for green…", "wait");
      timer = window.setTimeout(() => { phase = "go"; goAt = performance.now(); paint("TAP!", "go"); }, 1200 + Math.random() * 2800);
    }

    function press() {
      if (phase === "idle" || phase === "done") { times = []; msgEl.textContent = ""; begin(); return; }
      if (phase === "wait") {
        window.clearTimeout(timer);
        phase = "result"; paint("Too soon! Tap to try this round again", "early");
        return;
      }
      if (phase === "go") {
        const ms = Math.round(performance.now() - goAt);
        times.push(ms);
        if (times.length >= ROUNDS) {
          phase = "done";
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          const best = api.report(avg);
          api.award(Math.min(500, Math.max(50, 700 - avg)));
          paint(`Average ${avg} ms. Tap to play again`, "idle");
          msgEl.textContent = best ? "New best! 🎉" : "";
        } else {
          phase = "result"; paint(`${ms} ms. Tap for round ${times.length + 1}`, "idle");
        }
        return;
      }
      if (phase === "result") begin();
    }

    mountInto(root,
      <div className="reaction">
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}></div>
        <button type="button" className="rx-box idle" ref={(e: HTMLButtonElement) => (box = e)} onPointerdown={(ev: Event) => { ev.preventDefault(); press(); }}
          onKeydown={(ev: KeyboardEvent) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); press(); } }}>Tap to start</button>
        <p className="g-hint" ref={(e: HTMLElement) => (listEl = e)}></p>
      </div>
    );
    return () => window.clearTimeout(timer);
  }
};
