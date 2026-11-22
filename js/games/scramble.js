"use strict";
/* ---------- Word Scramble: unscramble school words in 60 seconds ---------- */
const SCRAMBLE_WORDS = [
    "ALGEBRA", "BIOLOGY", "CHEMISTRY", "HISTORY", "GEOGRAPHY", "SCIENCE", "LIBRARY", "TEACHER", "STUDENT", "HOMEWORK",
    "PENCIL", "NOTEBOOK", "EXAMINATION", "GRAMMAR", "LITERATURE", "PHYSICS", "GEOMETRY", "ATOM", "PLANET", "ENERGY",
    "SCHOOL", "CLASSROOM", "LESSON", "QUESTION", "ANSWER", "PROJECT", "DICTIONARY", "ESSAY", "SENTENCE", "PARAGRAPH",
    "CALCULATOR", "MICROSCOPE", "EXPERIMENT", "MOLECULE", "GRAVITY", "VOLCANO", "CONTINENT", "OCEAN", "FRACTION", "DECIMAL",
    "TRIANGLE", "CIRCLE", "NUMBER", "ADDITION", "SUBTRACT", "MULTIPLY", "SYMBOL", "VOCABULARY", "REVISION", "GRADUATE"
];
const ScrambleGame = {
    id: "scramble",
    title: "Word Scramble",
    emoji: "🔤",
    blurb: "Unscramble as many school words as you can in 60 seconds.",
    scoreLabel: "words",
    pointsHint: "40 pts per word",
    mount(root, api) {
        const ROUND = 60;
        let timeLeft = ROUND, score = 0, playing = false, word = "", timer;
        let deck = [];
        let timeEl, scoreEl, msgEl, tileEl, input, startBtn, skipBtn;
        const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [r[i], r[j]] = [r[j], r[i]];
        } return r; };
        function nextWord() {
            if (!deck.length)
                deck = shuffle(SCRAMBLE_WORDS);
            word = deck.pop();
            let s = word;
            for (let tries = 0; tries < 10 && s === word; tries++)
                s = shuffle(word.split("")).join("");
            tileEl.textContent = s.split("").join(" ");
            input.value = "";
        }
        function finish() {
            window.clearInterval(timer);
            playing = false;
            input.disabled = true;
            skipBtn.disabled = true;
            const best = api.report(score);
            api.award(score * 40);
            tileEl.textContent = "Time's up!";
            msgEl.textContent = `You unscrambled ${score}.` + (best && score > 0 ? " New best! 🎉" : "");
            startBtn.textContent = "Play again";
        }
        function start() {
            window.clearInterval(timer);
            score = 0;
            timeLeft = ROUND;
            playing = true;
            deck = [];
            scoreEl.textContent = "0";
            timeEl.textContent = String(ROUND);
            msgEl.textContent = "";
            input.disabled = false;
            skipBtn.disabled = false;
            startBtn.textContent = "Restart";
            nextWord();
            input.focus();
            timer = window.setInterval(() => { timeLeft--; timeEl.textContent = String(timeLeft); if (timeLeft <= 0)
                finish(); }, 1000);
        }
        function submit(e) {
            e.preventDefault();
            if (!playing)
                return;
            const guess = input.value.trim().toUpperCase();
            if (!guess)
                return;
            if (guess === word) {
                score++;
                scoreEl.textContent = String(score);
                msgEl.textContent = "✓ Correct";
                nextWord();
            }
            else {
                msgEl.textContent = "Not quite, try again";
                input.select();
            }
        }
        mountInto(root, h("div", { className: "scramble" },
            h("div", { className: "g-toolbar" },
                h("span", { className: "g-stat" },
                    "Time ",
                    h("b", { ref: (e) => (timeEl = e) }, "60")),
                h("span", { className: "g-stat" },
                    "Words ",
                    h("b", { ref: (e) => (scoreEl = e) }, "0")),
                h("button", { type: "button", className: "btn primary", ref: (e) => (startBtn = e), onClick: start }, "Start")),
            h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }),
            h("div", { className: "sc-tiles", ref: (e) => (tileEl = e) }, "Press Start"),
            h("form", { className: "ms-form", onSubmit: submit },
                h("input", { className: "text-input", type: "text", autoComplete: "off", autoCapitalize: "characters", disabled: true, "aria-label": "Your answer", ref: (e) => (input = e) })),
            h("button", { type: "button", className: "btn", disabled: true, ref: (e) => (skipBtn = e), onClick: () => { if (playing) {
                    msgEl.textContent = "Skipped: " + word;
                    nextWord();
                    input.focus();
                } } }, "Skip")));
        return () => window.clearInterval(timer);
    }
};
