/* ---------- Math Sprint (plain JavaScript, no JSX) ----------
   60 seconds of quick arithmetic. Type the answer and press Enter. Score = correct answers. */
const MathSprintGame = {
  id: "mathsprint",
  title: "Math Sprint",
  emoji: "⏱️",
  blurb: "60 seconds of quick sums. How many can you get right?",
  scoreLabel: "correct",

  mount(root, api) {
    const ROUND = 60;
    let timeLeft = ROUND, score = 0, streak = 0, answer = 0, timer = null, playing = false;

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    };

    const toolbar = el("div", "g-toolbar");
    const timeStat = el("span", "g-stat", "Time 60");
    const scoreStat = el("span", "g-stat", "Correct 0");
    const startBtn = el("button", "btn primary", "Start");
    startBtn.type = "button";
    toolbar.append(timeStat, scoreStat, startBtn);

    const status = el("div", "g-status");
    status.setAttribute("role", "status");
    const question = el("div", "ms-question", "Press Start");
    const form = el("form", "ms-form");
    const input = el("input", "text-input");
    input.type = "text"; input.inputMode = "numeric"; input.autocomplete = "off"; input.disabled = true;
    input.setAttribute("aria-label", "Your answer");
    form.append(input);

    const wrap = el("div", "mathsprint");
    wrap.append(toolbar, status, question, form);
    root.replaceChildren(wrap);

    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

    function nextQuestion() {
      // gets harder as the streak grows
      const hard = Math.min(3, Math.floor(streak / 5));
      const ops = ["+", "-", "×"];
      const op = ops[rand(0, hard > 0 ? 2 : 1)];
      let a, b;
      if (op === "×") { a = rand(2, 6 + hard * 2); b = rand(2, 9); answer = a * b; }
      else if (op === "+") { a = rand(5, 20 + hard * 20); b = rand(5, 20 + hard * 20); answer = a + b; }
      else { a = rand(10, 30 + hard * 20); b = rand(1, a); answer = a - b; }
      question.textContent = `${a} ${op} ${b} = ?`;
    }

    function start() {
      clearInterval(timer);
      timeLeft = ROUND; score = 0; streak = 0; playing = true;
      timeStat.textContent = "Time " + timeLeft; scoreStat.textContent = "Correct 0";
      status.textContent = "";
      input.disabled = false; input.value = ""; input.focus();
      startBtn.textContent = "Restart";
      nextQuestion();
      timer = setInterval(() => {
        timeLeft--;
        timeStat.textContent = "Time " + timeLeft;
        if (timeLeft <= 0) finish();
      }, 1000);
    }

    function finish() {
      clearInterval(timer);
      playing = false; input.disabled = true;
      const best = api.report(score);
      question.textContent = "Time's up!";
      status.textContent = `You got ${score} right.` + (best && score > 0 ? " New best! 🎉" : "");
    }

    startBtn.addEventListener("click", start);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!playing || input.value.trim() === "") return;
      if (Number(input.value) === answer) {
        score++; streak++;
        scoreStat.textContent = "Correct " + score;
        status.textContent = "";
      } else {
        streak = 0;
        status.textContent = `Not quite: ${question.textContent.replace("?", answer)}`;
      }
      input.value = "";
      nextQuestion();
    });

    return () => clearInterval(timer);
  }
};
