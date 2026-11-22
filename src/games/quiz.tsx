/* ---------- Quick Quiz: 10 general-knowledge questions, pick the right answer ---------- */
interface QuizQ { q: string; a: string; wrong: [string, string, string] }

const QUIZ_BANK: QuizQ[] = [
  { q: "What is 12 × 12?", a: "144", wrong: ["124", "132", "156"] },
  { q: "Which planet is known as the Red Planet?", a: "Mars", wrong: ["Venus", "Jupiter", "Mercury"] },
  { q: "What is the chemical symbol for water?", a: "H₂O", wrong: ["CO₂", "O₂", "NaCl"] },
  { q: "Who wrote “Romeo and Juliet”?", a: "William Shakespeare", wrong: ["Charles Dickens", "Jane Austen", "Mark Twain"] },
  { q: "How many continents are there?", a: "7", wrong: ["5", "6", "8"] },
  { q: "What is the capital of Japan?", a: "Tokyo", wrong: ["Kyoto", "Osaka", "Seoul"] },
  { q: "What is the largest ocean on Earth?", a: "Pacific", wrong: ["Atlantic", "Indian", "Arctic"] },
  { q: "Which gas do plants take in from the air?", a: "Carbon dioxide", wrong: ["Oxygen", "Nitrogen", "Helium"] },
  { q: "What is the square root of 81?", a: "9", wrong: ["8", "7", "11"] },
  { q: "How many sides does a hexagon have?", a: "6", wrong: ["5", "7", "8"] },
  { q: "Which is the smallest prime number?", a: "2", wrong: ["0", "1", "3"] },
  { q: "What force pulls objects toward the Earth?", a: "Gravity", wrong: ["Magnetism", "Friction", "Inertia"] },
  { q: "In which continent is Egypt?", a: "Africa", wrong: ["Asia", "Europe", "South America"] },
  { q: "What is 15% of 200?", a: "30", wrong: ["20", "25", "35"] },
  { q: "Which organ pumps blood around the body?", a: "Heart", wrong: ["Lungs", "Liver", "Kidney"] },
  { q: "What is the past tense of “run”?", a: "Ran", wrong: ["Runned", "Running", "Runs"] },
  { q: "How many minutes are in two hours?", a: "120", wrong: ["100", "90", "180"] },
  { q: "Which metal is liquid at room temperature?", a: "Mercury", wrong: ["Iron", "Copper", "Silver"] },
  { q: "What is the longest river in the world, by most measures?", a: "The Nile", wrong: ["The Amazon", "The Mississippi", "The Danube"] },
  { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", wrong: ["Michelangelo", "Pablo Picasso", "Vincent van Gogh"] },
  { q: "What is the freezing point of water in °C?", a: "0", wrong: ["32", "10", "-10"] },
  { q: "Which part of a plant makes food using sunlight?", a: "Leaf", wrong: ["Root", "Stem", "Seed"] },
  { q: "What is 7 × 8?", a: "56", wrong: ["54", "63", "48"] },
  { q: "How many days are in a leap year?", a: "366", wrong: ["365", "364", "367"] },
  { q: "Which language has the most native speakers?", a: "Mandarin Chinese", wrong: ["English", "Spanish", "Hindi"] },
  { q: "What is the hardest natural substance?", a: "Diamond", wrong: ["Gold", "Quartz", "Steel"] },
  { q: "Which planet has the most prominent rings?", a: "Saturn", wrong: ["Mars", "Earth", "Neptune"] },
  { q: "What is the plural of “child”?", a: "Children", wrong: ["Childs", "Childes", "Childrens"] },
  { q: "How many degrees are in a right angle?", a: "90", wrong: ["45", "180", "60"] },
  { q: "What do bees make?", a: "Honey", wrong: ["Silk", "Wax paper", "Milk"] }
];

const QuizGame: GameModule = {
  id: "quiz",
  title: "Quick Quiz",
  emoji: "🧩",
  blurb: "10 quick questions on maths, science and the world.",
  scoreLabel: "correct",
  pointsHint: "30 pts per answer, +100 if perfect",

  mount(root, api) {
    const TOTAL = 10;
    let qs: QuizQ[] = [], idx = 0, score = 0, locked = false, nextT: number | undefined;

    const shuffle = <T,>(a: T[]): T[] => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

    function start() {
      window.clearTimeout(nextT);
      qs = shuffle(QUIZ_BANK).slice(0, TOTAL); idx = 0; score = 0; locked = false;
      draw();
    }

    function pick(btn: HTMLButtonElement, choice: string, wrap: HTMLElement) {
      if (locked) return;
      locked = true;
      const right = qs[idx].a;
      [...wrap.querySelectorAll<HTMLButtonElement>("button")].forEach((b) => {
        b.disabled = true;
        if (b.dataset.v === right) b.classList.add("ok");
      });
      if (choice === right) score++; else btn.classList.add("no");
      nextT = window.setTimeout(() => { idx++; locked = false; if (idx >= TOTAL) end(); else draw(); }, 900);
    }

    function end() {
      const best = api.report(score);
      api.award(score * 30 + (score === TOTAL ? 100 : 0));
      mountInto(root,
        <div className="quiz">
          <div className="ms-question">{score} / {TOTAL}</div>
          <div className="g-status" role="status">{score === TOTAL ? "Perfect score! 🎉" : score >= 7 ? "Great job!" : "Keep practising!"}{best && score > 0 ? " New best! 🎉" : ""}</div>
          <button type="button" className="btn primary" onClick={start}>Play again</button>
        </div>
      );
    }

    function draw() {
      const cur = qs[idx];
      const choices = shuffle([cur.a, ...cur.wrong]);
      let wrap: HTMLElement;
      mountInto(root,
        <div className="quiz">
          <div className="g-toolbar">
            <span className="g-stat">Question <b>{idx + 1}</b> / {TOTAL}</span>
            <span className="g-stat">Correct <b>{score}</b></span>
          </div>
          <div className="qz-q">{cur.q}</div>
          <div className="qz-choices" ref={(e: HTMLElement) => (wrap = e)}>
            {choices.map((c) => (
              <button type="button" className="qz-choice" data-v={c} onClick={(e: Event) => pick(e.currentTarget as HTMLButtonElement, c, wrap)}>{c}</button>
            ))}
          </div>
        </div>
      );
    }

    start();
    return () => window.clearTimeout(nextT);
  }
};
