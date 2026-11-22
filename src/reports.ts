/* ---------- Reports: any user can report a user (or one of their posts) ----------
   Admins and the developer read them under Admin panel > Reports; only the developer can ban. */
const Reports = (() => {
  const esc = Utils.escapeHTML;
  const db = () => Auth.client;

  const REASONS = [
    ["spam", "Spam"],
    ["harassment", "Harassment or bullying"],
    ["inappropriate", "Inappropriate content"],
    ["impersonation", "Pretending to be someone else"],
    ["scam", "Scam or fraud"],
    ["other", "Something else"]
  ];
  const label = (key) => (REASONS.find((r) => r[0] === key) || [key, key])[1];

  /** Open the report pop-up. `postId` is optional (report one post instead of the whole account). */
  function open({ userId, userName, postId = null }) {
    if (document.getElementById("report-modal")) return;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.id = "report-modal";
    wrap.innerHTML = `
      <form class="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="rp-title" novalidate>
        <h3 id="rp-title">Report ${postId ? "a post by" : ""} ${esc(userName || "this user")}</h3>
        <p>Tell us what's wrong. The developer and admins will review it. Your report is private.</p>
        <div class="report-reasons" role="radiogroup" aria-label="Reason">
          ${REASONS.map(([k, t], i) => `
            <label class="report-reason"><input type="radio" name="reason" value="${k}" ${i === 0 ? "checked" : ""} /><span>${esc(t)}</span></label>`).join("")}
        </div>
        <label class="field-label" for="rp-details">Details <span class="dim" id="rp-count">0/500</span></label>
        <textarea class="text-input" id="rp-details" rows="3" maxlength="500" placeholder="What happened? (optional, but it helps)"></textarea>
        <p class="form-error" id="rp-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn ghost" type="button" id="rp-cancel">Cancel</button>
          <button class="btn primary" type="submit" id="rp-send">Send report</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);

    const $ = (s: string) => wrap.querySelector<any>(s);
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    $("#rp-cancel").addEventListener("click", close);
    $("#rp-details").addEventListener("input", () => { $("#rp-count").textContent = `${$("#rp-details").value.length}/500`; });

    $(".report-modal").addEventListener("submit", async (e) => {
      e.preventDefault();
      const reason = wrap.querySelector<HTMLInputElement>('input[name="reason"]:checked').value;
      const details = $("#rp-details").value.trim();
      const err = $("#rp-error");
      err.textContent = "";
      if (reason === "other" && details.length < 5) return (err.textContent = "Please describe the problem.");

      const btn = $("#rp-send");
      btn.disabled = true; btn.textContent = "Sending…";
      const { error } = await db().from("reports").insert({ reported_id: userId, post_id: postId, reason, details });
      if (error) {
        err.textContent = error.code === "23505"
          ? "You already reported this. The staff will review it."
          : /schema cache|relation .*reports/i.test(error.message)
            ? "Reports aren't set up yet. Re-run supabase/schema.sql (section 23) in Supabase."
            : error.message;
        btn.disabled = false; btn.textContent = "Send report";
        return;
      }
      close();
      Utils.toast("Report sent. The developer and admins will review it.", 4000);
    });
  }

  return { open, label, REASONS };
})();
