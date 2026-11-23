"use strict";
/* ---------- Ban dialog: pick a reason and how long the ban lasts ----------
   Used by the Developer panel and by Reports (Admin panel).
   Ban.ask({ name, reason }) -> Promise of { reason, minutes } (minutes = null means permanent), or null if cancelled. */
const Ban = (() => {
    const esc = Utils.escapeHTML;
    const PRESETS = [
        ["forever", "Permanent (until I unban)", null],
        ["60", "1 hour", 60],
        ["360", "6 hours", 360],
        ["1440", "1 day", 1440],
        ["4320", "3 days", 4320],
        ["10080", "7 days", 10080],
        ["20160", "14 days", 20160],
        ["43200", "30 days", 43200],
        ["custom", "Custom…", null]
    ];
    const UNITS = { minutes: 1, hours: 60, days: 1440 };
    const MAX_MIN = 5256000; // 10 years, same limit as the database
    /** "3 days", "1 hour 30 min" … for toasts and the status pill. */
    function describe(minutes) {
        if (minutes === null || minutes === undefined)
            return "permanently";
        const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
        const part = (n, w) => (n ? `${n} ${w}${n === 1 ? "" : "s"}` : "");
        return "for " + ([part(d, "day"), part(h, "hour"), part(m, "minute")].filter(Boolean).join(" ") || "1 minute");
    }
    function ask({ name = "this user", reason = "" } = {}) {
        return new Promise((resolve) => {
            const wrap = document.createElement("div");
            wrap.className = "modal-backdrop";
            wrap.innerHTML = `
        <form class="modal ban-dialog" role="dialog" aria-modal="true" aria-labelledby="bd-title" novalidate>
          <h3 id="bd-title">Ban ${esc(name)}</h3>
          <p>They are signed out right away and shown a ban pop-up with this reason. They can message you from that pop-up.</p>

          <label class="field-label" for="bd-reason">Reason</label>
          <input type="text" id="bd-reason" maxlength="300" placeholder="Shown to the user" value="${esc(reason)}" autocomplete="off" />

          <label class="field-label" for="bd-len">How long?</label>
          <select class="sel" id="bd-len">${PRESETS.map(([v, t]) => `<option value="${v}">${esc(String(t))}</option>`).join("")}</select>

          <div class="bd-custom hidden" id="bd-custom">
            <input type="number" id="bd-num" min="1" step="1" value="1" aria-label="Amount" />
            <select class="sel" id="bd-unit" aria-label="Unit">
              <option value="minutes">minutes</option><option value="hours">hours</option><option value="days" selected>days</option>
            </select>
          </div>
          <p class="bd-until" id="bd-until"></p>
          <p class="form-error" id="bd-error" role="alert"></p>

          <div class="modal-actions">
            <button class="btn ghost" type="button" id="bd-cancel">Cancel</button>
            <button class="btn danger-fill" type="submit">Ban user</button>
          </div>
        </form>`;
            document.body.appendChild(wrap);
            const $ = (s) => wrap.querySelector(s);
            const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
            const onKey = (e) => { if (e.key === "Escape")
                done(null); };
            document.addEventListener("keydown", onKey);
            wrap.addEventListener("mousedown", (e) => { if (e.target === wrap)
                done(null); });
            $("#bd-cancel").addEventListener("click", () => done(null));
            /** Minutes chosen, null = permanent, NaN = invalid custom value. */
            const minutes = () => {
                const v = $("#bd-len").value;
                if (v === "forever")
                    return null;
                if (v !== "custom")
                    return Number(v);
                const n = Number($("#bd-num").value);
                if (!Number.isInteger(n) || n < 1)
                    return NaN;
                const m = n * UNITS[$("#bd-unit").value];
                return m > MAX_MIN ? NaN : m;
            };
            const refresh = () => {
                $("#bd-custom").classList.toggle("hidden", $("#bd-len").value !== "custom");
                const m = minutes();
                $("#bd-until").textContent = Number.isNaN(m) ? ""
                    : m === null ? "The ban never ends unless you unban them."
                        : "Ban ends " + new Date(Date.now() + m * 60000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + ". You can unban sooner.";
            };
            ["#bd-len", "#bd-num", "#bd-unit"].forEach((s) => $(s).addEventListener("input", refresh));
            refresh();
            $("#bd-reason").focus();
            $(".ban-dialog").addEventListener("submit", (e) => {
                e.preventDefault();
                const m = minutes();
                if (Number.isNaN(m))
                    return ($("#bd-error").textContent = "Enter a whole number from 1 up to 10 years.");
                done({ reason: $("#bd-reason").value.trim(), minutes: m });
            });
        });
    }
    return { ask, describe };
})();
