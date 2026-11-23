"use strict";
/* ---------- Login page behaviour ---------- */
(function () {
    const esc = Utils.escapeHTML;
    /* ---------- "You have been banned" pop-up (with a box to message the developer) ---------- */
    function showBanModal(info) {
        if (document.getElementById("ban-modal"))
            return;
        info = info || {};
        const ends = Auth.banEnds(info.until);
        const wrap = document.createElement("div");
        wrap.className = "ban-backdrop";
        wrap.id = "ban-modal";
        wrap.innerHTML = `
      <div class="ban-modal" role="alertdialog" aria-modal="true" aria-labelledby="ban-title" aria-describedby="ban-desc">
        <div class="ban-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg></div>
        <h3 id="ban-title">Your account has been banned</h3>
        <p class="ban-lead" id="ban-desc">${ends
            ? `You can log in again on <b>${esc(ends)}</b>.`
            : `This ban has no end date. Only the developer can lift it.`}</p>
        ${info.reason ? `<div class="ban-reason"><small>Reason</small><p>${esc(info.reason)}</p></div>` : ""}
        <form class="ban-form" novalidate>
          <label class="ban-label" for="ban-msg">Think this is a mistake? Contact the developer / admin</label>
          <textarea id="ban-msg" rows="3" maxlength="500" placeholder="Write your message…"></textarea>
          <p class="ban-feedback" role="alert"></p>
          <div class="ban-actions">
            <button type="button" class="ban-btn ghost" data-close>Close</button>
            <button type="submit" class="ban-btn primary">Send to developer</button>
          </div>
        </form>
      </div>`;
        document.body.appendChild(wrap);
        const $ = (q) => wrap.querySelector(q);
        const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
        const onKey = (e) => { if (e.key === "Escape")
            close(); };
        document.addEventListener("keydown", onKey);
        $("[data-close]").addEventListener("click", close);
        $("#ban-msg").focus();
        $(".ban-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const fb = $(".ban-feedback"), btn = $(".ban-btn.primary"), box = $("#ban-msg");
            const text = box.value.trim();
            fb.className = "ban-feedback";
            if (text.length < 3) {
                fb.textContent = "Please write a short message.";
                return box.focus();
            }
            if (!info.email) {
                fb.textContent = "Type your email on the login form first, then try again.";
                return;
            }
            btn.disabled = true;
            btn.textContent = "Sending…";
            fb.textContent = "";
            try {
                await Auth.sendAppeal(info.email, text);
                box.value = "";
                box.disabled = true;
                fb.className = "ban-feedback ok";
                fb.textContent = "Message sent. The developer will see it.";
                btn.textContent = "Sent ✓";
            }
            catch (ex) {
                fb.textContent = ex.message;
                btn.disabled = false;
                btn.textContent = "Send to developer";
            }
        });
    }
    const $id = (id) => document.getElementById(id);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const NOTICE_KEY = "studyhub.justLoggedIn";
    // Came back from the verification email? Show the login page with a "verified" message (the person logs in next).
    const cameFromEmail = /[?&]verified=1/.test(location.search) || /type=signup|error_description=/.test(location.hash);
    // Already signed in? Go straight to the dashboard.
    // (A banned account with a leftover session is signed out and shown the ban pop-up.)
    const leftover = Auth.takeBanNotice(); // set when the account was banned while it was open
    if (leftover)
        showBanModal(leftover);
    if (cameFromEmail) {
        Auth.finishVerification().then(({ email, error }) => {
            history.replaceState(null, "", location.pathname);
            showPanel("panel-login");
            if (email)
                $id("login-email").value = email;
            if (error)
                $id("login-error").textContent = error;
            else
                notice("✓ Email verified! Your account is ready. Log in to continue.");
        });
    }
    else {
        Auth.currentUser().then((u) => {
            if (u)
                return window.location.replace("dashboard.html");
            const n = Auth.takeBanNotice(); // set when a leftover session turned out to be banned
            if (n)
                showBanModal(n);
        });
    }
    if (!Auth.configured) {
        document.getElementById("login-error").textContent = "Supabase isn't set up yet: add your URL and key in js/config.js.";
    }
    const tabs = document.querySelectorAll(".auth-tab");
    const panels = document.querySelectorAll(".auth-panel");
    function showPanel(id) {
        panels.forEach((p) => p.classList.toggle("hidden", p.id !== id));
        tabs.forEach((t) => {
            const active = t.dataset.target === id;
            t.classList.toggle("active", active);
            t.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".form-error").forEach((e) => (e.textContent = ""));
        $id("login-resend-row").classList.add("hidden");
        document.querySelector(".auth-social").classList.toggle("hidden", id === "panel-verify");
        if (id !== "panel-login")
            $id("login-notice").classList.add("hidden");
    }
    /** The green message above the login form. */
    function notice(text) {
        const n = $id("login-notice");
        n.textContent = text;
        n.classList.toggle("hidden", !text);
    }
    tabs.forEach((t) => t.addEventListener("click", () => showPanel(t.dataset.target)));
    document.querySelectorAll("[data-switch]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); showPanel(a.dataset.switch); }));
    // Show / hide password
    document.querySelectorAll(".toggle-pass").forEach((btn) => btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.for);
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        btn.textContent = reveal ? "hide" : "show";
    }));
    const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    /* ---------- Login animation: a welcome screen that plays between the login page and the dashboard ---------- */
    async function playLoginAnimation(profile) {
        const first = esc(String(profile.name || "").trim().split(/\s+/)[0] || "there");
        const quick = reduceMotion();
        const wrap = document.createElement("div");
        wrap.className = "lg-overlay";
        wrap.setAttribute("role", "status");
        wrap.setAttribute("aria-live", "polite");
        wrap.innerHTML = `
      <div class="lg-stage">
        <div class="lg-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="lg-track" cx="60" cy="60" r="52"></circle>
            <circle class="lg-arc" cx="60" cy="60" r="52"></circle>
            <path class="lg-check" d="M38 62l15 15 30-34"></path>
          </svg>
          <img src="assets/logo.svg" alt="" />
        </div>
        <h2 class="lg-title">Welcome back, <span>${first}</span></h2>
        <p class="lg-step">Signing you in…</p>
        <div class="lg-bar"><i></i></div>
      </div>`;
        document.body.appendChild(wrap);
        document.body.classList.add("lg-active");
        const step = wrap.querySelector(".lg-step");
        requestAnimationFrame(() => wrap.classList.add("on"));
        if (quick) {
            await sleep(500);
            return;
        }
        await sleep(750);
        step.textContent = "Loading your dashboard…";
        await sleep(750);
        step.textContent = "All set!";
        wrap.classList.add("done");
        await sleep(650);
        wrap.classList.add("leave");
        await sleep(380);
    }
    // Login
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const err = document.getElementById("login-error");
        const btn = $id("login-btn");
        err.textContent = "";
        $id("login-resend-row").classList.add("hidden");
        if (!validEmail(email))
            return (err.textContent = "Please enter a valid email address.");
        if (!password)
            return (err.textContent = "Please enter your password.");
        btn.disabled = true;
        btn.classList.add("busy");
        try {
            const profile = await Auth.login(email, password);
            try {
                sessionStorage.setItem(NOTICE_KEY, "1");
            }
            catch { } // tells the dashboard to play its entrance animation
            await playLoginAnimation(profile);
            window.location.href = "dashboard.html";
        }
        catch (ex) {
            btn.disabled = false;
            btn.classList.remove("busy");
            if (ex.ban) {
                err.textContent = "";
                showBanModal(ex.ban);
            }
            else {
                err.textContent = ex.message;
                if (ex.unverified)
                    $id("login-resend-row").classList.remove("hidden");
            }
        }
    });
    /* ---------- Verify email panel ---------- */
    let verifyEmail = "";
    let timer = null;
    function startCooldown(sec = 60) {
        const link = $id("vf-resend"), t = $id("vf-timer");
        link.classList.add("disabled");
        let left = sec;
        clearInterval(timer);
        const tick = () => {
            t.textContent = left > 0 ? `(${left}s)` : "";
            if (left <= 0) {
                clearInterval(timer);
                link.classList.remove("disabled");
            }
            left--;
        };
        tick();
        timer = setInterval(tick, 1000);
    }
    function showVerify(email) {
        verifyEmail = email.trim();
        $id("vf-email").textContent = verifyEmail;
        // Gmail users get a button that opens their inbox on the verification email.
        const open = $id("vf-open");
        open.href = /@(gmail|googlemail)\.com$/i.test(verifyEmail)
            ? "https://mail.google.com/mail/u/" + encodeURIComponent(verifyEmail) + "/#search/in%3Aanywhere+newer_than%3A1d"
            : "https://mail.google.com/";
        document.querySelector("#panel-verify details").open = false;
        document.getElementById("verify-code").value = "";
        showPanel("panel-verify");
        startCooldown();
    }
    async function resend() {
        const err = $id("verify-error");
        if ($id("vf-resend").classList.contains("disabled"))
            return;
        err.textContent = "";
        try {
            await Auth.resendVerification(verifyEmail);
            Utils.toast("Verification email sent. Check your Gmail.", 4000);
            startCooldown();
        }
        catch (ex) {
            err.textContent = ex.message;
        }
    }
    $id("vf-resend").addEventListener("click", (e) => { e.preventDefault(); resend(); });
    // "Resend" from the login page (account exists but the email wasn't confirmed yet)
    $id("login-resend").addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        if (!validEmail(email))
            return;
        showVerify(email);
        resend();
    });
    $id("verify-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = document.getElementById("verify-code").value.replace(/\s/g, "");
        const err = $id("verify-error"), btn = $id("verify-btn");
        err.textContent = "";
        if (!/^\d{6,10}$/.test(code))
            return (err.textContent = "Enter the number code from the email.");
        btn.disabled = true;
        try {
            await Auth.verifyCode(verifyEmail, code);
            showPanel("panel-login");
            document.getElementById("login-email").value = verifyEmail;
            notice("✓ Email verified! Your account is ready. Log in to continue.");
            document.getElementById("login-password").focus();
        }
        catch (ex) {
            err.textContent = ex.message;
        }
        btn.disabled = false;
    });
    // Sign up: create the account, ask for email verification, then the person logs in.
    document.getElementById("signup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signup-name").value;
        const email = document.getElementById("signup-email").value;
        const password = document.getElementById("signup-password").value;
        const err = document.getElementById("signup-error");
        const btn = $id("signup-btn");
        err.textContent = "";
        if (name.trim().length < 2)
            return (err.textContent = "Please enter your full name.");
        if (!validEmail(email))
            return (err.textContent = "Please enter a valid email address.");
        if (password.length < 6)
            return (err.textContent = "Password must be at least 6 characters.");
        btn.disabled = true;
        btn.classList.add("busy");
        try {
            const res = await Auth.register({ name, email, password });
            document.getElementById("signup-form").reset();
            if (res.needsConfirm)
                return showVerify(email);
            // Email confirmation is off in Supabase: nothing to verify, go straight to login.
            showPanel("panel-login");
            document.getElementById("login-email").value = email.trim();
            notice("✓ Account created! Log in to continue.");
        }
        catch (ex) {
            err.textContent = ex.message;
        }
        finally {
            btn.disabled = false;
            btn.classList.remove("busy");
        }
    });
    document.getElementById("forgot-link").addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const err = document.getElementById("login-error");
        err.textContent = "";
        if (!validEmail(email))
            return (err.textContent = "Enter your email above first, then press Forgot Password.");
        try {
            await Auth.resetPassword(email);
            Utils.toast("Password reset link sent. Check your email.", 5000);
        }
        catch (ex) {
            err.textContent = ex.message;
        }
    });
    // Google / Facebook login is not available: tell the user and point them to Create account.
    const socialNote = document.getElementById("social-note");
    document.querySelectorAll(".social-btn").forEach((b) => b.addEventListener("click", () => {
        socialNote.classList.remove("hidden");
        Utils.toast(`${b.dataset.provider} login is unavailable. Please create an account.`, 4000);
    }));
    document.getElementById("social-create").addEventListener("click", (e) => {
        e.preventDefault();
        socialNote.classList.add("hidden");
        showPanel("panel-signup");
    });
})();
