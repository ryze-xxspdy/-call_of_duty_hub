/* ---------- Login page behaviour ---------- */
(function () {
  const esc = Utils.escapeHTML;

  /* ---------- "You have been banned" pop-up (with a box to message the developer) ---------- */
  function showBanModal(info) {
    if (document.getElementById("ban-modal")) return;
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

    const $ = (q: string) => wrap.querySelector<any>(q);
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    $("[data-close]").addEventListener("click", close);
    $("#ban-msg").focus();

    $(".ban-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fb = $(".ban-feedback"), btn = $(".ban-btn.primary"), box = $("#ban-msg");
      const text = box.value.trim();
      fb.className = "ban-feedback";
      if (text.length < 3) { fb.textContent = "Please write a short message."; return box.focus(); }
      if (!info.email) { fb.textContent = "Type your email on the login form first, then try again."; return; }
      btn.disabled = true; btn.textContent = "Sending…"; fb.textContent = "";
      try {
        await Auth.sendAppeal(info.email, text);
        box.value = ""; box.disabled = true;
        fb.className = "ban-feedback ok";
        fb.textContent = "Message sent. The developer will see it.";
        btn.textContent = "Sent ✓";
      } catch (ex) {
        fb.textContent = ex.message;
        btn.disabled = false; btn.textContent = "Send to developer";
      }
    });
  }

  // Already signed in? Go straight to the dashboard.
  // (A banned account with a leftover session is signed out and shown the ban pop-up.)
  const leftover = Auth.takeBanNotice();            // set when the account was banned while it was open
  if (leftover) showBanModal(leftover);
  Auth.currentUser().then((u) => {
    if (u) return window.location.replace("dashboard.html");
    const n = Auth.takeBanNotice();                 // set when a leftover session turned out to be banned
    if (n) showBanModal(n);
  });
  if (!Auth.configured) {
    document.getElementById("login-error").textContent = "Supabase isn't set up yet: add your URL and key in js/config.js.";
  }

  const tabs = document.querySelectorAll<HTMLElement>(".auth-tab");
  const panels = document.querySelectorAll(".auth-panel");

  function showPanel(id) {
    panels.forEach((p) => p.classList.toggle("hidden", p.id !== id));
    tabs.forEach((t) => {
      const active = t.dataset.target === id;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".form-error").forEach((e) => (e.textContent = ""));
  }

  tabs.forEach((t) => t.addEventListener("click", () => showPanel(t.dataset.target)));
  document.querySelectorAll<HTMLElement>("[data-switch]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); showPanel(a.dataset.switch); })
  );

  // Show / hide password
  document.querySelectorAll<HTMLElement>(".toggle-pass").forEach((btn) =>
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.for) as HTMLInputElement;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      btn.textContent = reveal ? "hide" : "show";
    })
  );

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // Login
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("login-email") as HTMLInputElement).value;
    const password = (document.getElementById("login-password") as HTMLInputElement).value;
    const err = document.getElementById("login-error");
    err.textContent = "";

    if (!validEmail(email)) return (err.textContent = "Please enter a valid email address.");
    if (!password) return (err.textContent = "Please enter your password.");

    try {
      await Auth.login(email, password);
      window.location.href = "dashboard.html";
    } catch (ex) {
      if (ex.ban) { err.textContent = ""; showBanModal(ex.ban); }
      else err.textContent = ex.message;
    }
  });

  // Sign up
  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("signup-name") as HTMLInputElement).value;
    const email = (document.getElementById("signup-email") as HTMLInputElement).value;
    const password = (document.getElementById("signup-password") as HTMLInputElement).value;
    const err = document.getElementById("signup-error");
    err.textContent = "";

    if (name.trim().length < 2) return (err.textContent = "Please enter your full name.");
    if (!validEmail(email)) return (err.textContent = "Please enter a valid email address.");
    if (password.length < 6) return (err.textContent = "Password must be at least 6 characters.");

    try {
      const res = await Auth.register({ name, email, password });
      if (res.needsConfirm) {
        err.textContent = "";
        Utils.toast("Check your email to confirm your account, then log in.", 5000);
        return showPanel("panel-login");
      }
      window.location.href = "dashboard.html";
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  document.getElementById("forgot-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("login-email") as HTMLInputElement).value;
    const err = document.getElementById("login-error");
    err.textContent = "";
    if (!validEmail(email)) return (err.textContent = "Enter your email above first, then press Forgot Password.");
    try {
      await Auth.resetPassword(email);
      Utils.toast("Password reset link sent. Check your email.", 5000);
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  // Google / Facebook login is not available: tell the user and point them to Create account.
  const socialNote = document.getElementById("social-note");
  document.querySelectorAll<HTMLElement>(".social-btn").forEach((b) =>
    b.addEventListener("click", () => {
      socialNote.classList.remove("hidden");
      Utils.toast(`${b.dataset.provider} login is unavailable. Please create an account.`, 4000);
    })
  );
  document.getElementById("social-create").addEventListener("click", (e) => {
    e.preventDefault();
    socialNote.classList.add("hidden");
    showPanel("panel-signup");
  });
})();
