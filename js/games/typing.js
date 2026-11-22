"use strict";
/* ---------- Typing Sprint: type the word shown, press space or Enter. 30 seconds. ---------- */
const TYPING_WORDS = [
    "study", "notes", "exam", "class", "read", "write", "learn", "think", "focus", "quiz", "essay", "math", "science", "book", "pencil",
    "paper", "desk", "chalk", "board", "group", "project", "reading", "lesson", "answer", "result", "grade", "theory", "number", "letter",
    "ruler", "bag", "break", "lunch", "friend", "teacher", "library", "history", "music", "sport", "art", "world", "story", "idea",
    "practice", "memory", "report", "level", "point", "reward", "winner", "stream", "bridge", "planet", "garden", "window", "yellow"
];
const TypingGame = {
    id: "typing",
    title: "Typing Sprint",
    emoji: "⌨️",
    blurb: "Type each word and press space. 30 seconds on the clock.",
    scoreLabel: "words",
    pointsHint: "12 pts per word",
    mount(root, api) {
        const ROUND = 30;
        let timeLeft = ROUND, score = 0, typedAll = 0, playing = false, timer, word = "";
        let timeEl, scoreEl, msgEl, wordEl, input, startBtn;
        function nextWord() {
            let w = word;
            while (w === word)
                w = TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)];
            word = w;
            wordEl.textContent = w;
            input.value = "";
            wordEl.classList.remove("bad");
        }
        function finish() {
            window.clearInterval(timer);
            playing = false;
            input.disabled = true;
            const best = api.report(score);
            api.award(score * 12);
            const acc = typedAll ? Math.round((score / typedAll) * 100) : 0;
            wordEl.textContent = "Time's up!";
            msgEl.textContent = `${score} words (${score * 2} WPM), ${acc}% accurate.` + (best && score > 0 ? " New best! 🎉" : "");
            startBtn.textContent = "Play again";
        }
        function start() {
            window.clearInterval(timer);
            score = 0;
            typedAll = 0;
            timeLeft = ROUND;
            playing = true;
            word = "";
            scoreEl.textContent = "0";
            timeEl.textContent = String(ROUND);
            msgEl.textContent = "";
            input.disabled = false;
            startBtn.textContent = "Restart";
            nextWord();
            input.focus();
            timer = window.setInterval(() => { timeLeft--; timeEl.textContent = String(timeLeft); if (timeLeft <= 0)
                finish(); }, 1000);
        }
        function onInput() {
            if (!playing)
                return;
            const v = input.value;
            wordEl.classList.toggle("bad", v.length > 0 && !word.startsWith(v.trim()));
            if (/\s$/.test(v) || v.endsWith("\n")) {
                typedAll++;
                if (v.trim() === word) {
                    score++;
                    scoreEl.textContent = String(score);
                }
                nextWord();
            }
        }
        mountInto(root, h("div", { className: "typing" },
            h("div", { className: "g-toolbar" },
                h("span", { className: "g-stat" },
                    "Time ",
                    h("b", { ref: (e) => (timeEl = e) }, "30")),
                h("span", { className: "g-stat" },
                    "Words ",
                    h("b", { ref: (e) => (scoreEl = e) }, "0")),
                h("button", { type: "button", className: "btn primary", ref: (e) => (startBtn = e), onClick: start }, "Start")),
            h("div", { className: "g-status", role: "status", ref: (e) => (msgEl = e) }),
            h("div", { className: "ty-word", ref: (e) => (wordEl = e) }, "Press Start"),
            h("form", { className: "ms-form", onSubmit: (e) => { e.preventDefault(); if (playing) {
                    input.value += " ";
                    onInput();
                } } },
                h("input", { className: "text-input", type: "text", autoComplete: "off", autoCapitalize: "off", spellcheck: false, disabled: true, "aria-label": "Type the word", ref: (e) => { input = e; e.addEventListener("input", onInput); } }))));
        return () => window.clearInterval(timer);
    }
};
