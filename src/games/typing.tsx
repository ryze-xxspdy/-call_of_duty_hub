/* ---------- Typing Sprint: type the word shown, press space or Enter. 30 seconds. ---------- */
const TYPING_WORDS = [
  "study", "notes", "exam", "class", "read", "write", "learn", "think", "focus", "quiz", "essay", "math", "science", "book", "pencil",
  "paper", "desk", "chalk", "board", "group", "project", "reading", "lesson", "answer", "result", "grade", "theory", "number", "letter",
  "ruler", "bag", "break", "lunch", "friend", "teacher", "library", "history", "music", "sport", "art", "world", "story", "idea",
  "practice", "memory", "report", "level", "point", "reward", "winner", "stream", "bridge", "planet", "garden", "window", "yellow"
];

const TypingGame: GameModule = {
  id: "typing",
  title: "Typing Sprint",
  emoji: "⌨️",
  blurb: "Type each word and press space. 30 seconds on the clock.",
  scoreLabel: "words",
  pointsHint: "12 pts per word",

  mount(root, api) {
    const ROUND = 30;
    let timeLeft = ROUND, score = 0, typedAll = 0, playing = false, timer: number | undefined, word = "";
    let timeEl: HTMLElement, scoreEl: HTMLElement, msgEl: HTMLElement, wordEl: HTMLElement, input: HTMLInputElement, startBtn: HTMLButtonElement;

    function nextWord() {
      let w = word;
      while (w === word) w = TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)];
      word = w; wordEl.textContent = w; input.value = ""; wordEl.classList.remove("bad");
    }

    function finish() {
      window.clearInterval(timer); playing = false; input.disabled = true;
      const best = api.report(score);
      api.award(score * 12);
      const acc = typedAll ? Math.round((score / typedAll) * 100) : 0;
      wordEl.textContent = "Time's up!";
      msgEl.textContent = `${score} words (${score * 2} WPM), ${acc}% accurate.` + (best && score > 0 ? " New best! 🎉" : "");
      startBtn.textContent = "Play again";
    }

    function start() {
      window.clearInterval(timer);
      score = 0; typedAll = 0; timeLeft = ROUND; playing = true; word = "";
      scoreEl.textContent = "0"; timeEl.textContent = String(ROUND); msgEl.textContent = "";
      input.disabled = false; startBtn.textContent = "Restart";
      nextWord(); input.focus();
      timer = window.setInterval(() => { timeLeft--; timeEl.textContent = String(timeLeft); if (timeLeft <= 0) finish(); }, 1000);
    }

    function onInput() {
      if (!playing) return;
      const v = input.value;
      wordEl.classList.toggle("bad", v.length > 0 && !word.startsWith(v.trim()));
      if (/\s$/.test(v) || v.endsWith("\n")) {
        typedAll++;
        if (v.trim() === word) { score++; scoreEl.textContent = String(score); }
        nextWord();
      }
    }

    mountInto(root,
      <div className="typing">
        <div className="g-toolbar">
          <span className="g-stat">Time <b ref={(e: HTMLElement) => (timeEl = e)}>30</b></span>
          <span className="g-stat">Words <b ref={(e: HTMLElement) => (scoreEl = e)}>0</b></span>
          <button type="button" className="btn primary" ref={(e: HTMLButtonElement) => (startBtn = e)} onClick={start}>Start</button>
        </div>
        <div className="g-status" role="status" ref={(e: HTMLElement) => (msgEl = e)}></div>
        <div className="ty-word" ref={(e: HTMLElement) => (wordEl = e)}>Press Start</div>
        <form className="ms-form" onSubmit={(e: Event) => { e.preventDefault(); if (playing) { input.value += " "; onInput(); } }}>
          <input className="text-input" type="text" autoComplete="off" autoCapitalize="off" spellcheck={false} disabled aria-label="Type the word" ref={(e: HTMLInputElement) => { input = e; e.addEventListener("input", onInput); }} />
        </form>
      </div>
    );
    return () => window.clearInterval(timer);
  }
};
