"use strict";
/* ---------- Shared helpers ---------- */
const Utils = (() => {
    const MAX_NOTICES = 3;
    const live = new Map();
    function noticeStack() {
        let box = document.getElementById("notice-stack");
        if (!box) {
            box = document.createElement("div");
            box.id = "notice-stack";
            box.className = "notice-stack";
            box.setAttribute("aria-live", "polite");
            document.body.appendChild(box);
        }
        return box;
    }
    function notice(o) {
        const box = noticeStack();
        const ms = Math.max(1200, o.ms ?? 6000);
        if (o.key) {
            for (const [el, close] of live)
                if (el.dataset.key === o.key)
                    close("replaced");
        }
        while (live.size >= MAX_NOTICES) {
            const [, close] = live.entries().next().value;
            close("replaced");
        }
        const el = document.createElement("div");
        el.className = "notice" + (o.title ? "" : " slim") + (o.href ? " link" : "");
        el.setAttribute("role", "status");
        if (o.key)
            el.dataset.key = o.key;
        el.innerHTML =
            (o.icon ? `<span class="notice-icon" aria-hidden="true">${escapeHTML(o.icon)}</span>` : "") +
                `<div class="notice-text">${o.title ? `<strong>${escapeHTML(o.title)}</strong>` : ""}${o.body ? `<span>${escapeHTML(o.body)}</span>` : ""}</div>` +
                (o.href && o.actionLabel ? `<span class="notice-go">${escapeHTML(o.actionLabel)}</span>` : "") +
                `<button type="button" class="notice-x" aria-label="Dismiss">×</button>` +
                `<i class="notice-bar" style="animation-duration:${ms}ms"></i>`;
        let timer = 0, left = ms, started = 0, closed = false;
        const close = (why) => {
            if (closed)
                return;
            closed = true;
            clearTimeout(timer);
            live.delete(el);
            el.classList.remove("in");
            el.classList.add("out");
            const gone = () => el.remove();
            el.addEventListener("transitionend", gone, { once: true });
            setTimeout(gone, 450);
            if (o.onClose)
                o.onClose(why);
        };
        live.set(el, close);
        const run = () => { started = Date.now(); clearTimeout(timer); timer = setTimeout(() => close("auto"), left); el.classList.remove("paused"); };
        const pause = () => { left = Math.max(1200, left - (Date.now() - started)); clearTimeout(timer); el.classList.add("paused"); };
        el.addEventListener("mouseenter", pause);
        el.addEventListener("mouseleave", run);
        el.querySelector(".notice-x").addEventListener("click", (e) => { e.stopPropagation(); close("dismiss"); });
        el.addEventListener("click", () => {
            if (!o.href)
                return;
            close("open");
            if (o.href.startsWith("#"))
                location.hash = o.href;
            else
                location.href = o.href;
        });
        // swipe up to dismiss
        let y0 = 0, dy = 0, drag = false;
        el.addEventListener("pointerdown", (e) => { drag = true; y0 = e.clientY; dy = 0; pause(); });
        el.addEventListener("pointermove", (e) => {
            if (!drag)
                return;
            dy = Math.min(0, e.clientY - y0);
            el.style.transform = `translateY(${dy}px)`;
        });
        const end = () => {
            if (!drag)
                return;
            drag = false;
            if (dy < -36)
                close("dismiss");
            else {
                el.style.transform = "";
                run();
            }
        };
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
        box.appendChild(el);
        void el.offsetHeight; // let the browser see the start position, then slide in
        requestAnimationFrame(() => el.classList.add("in"));
        run();
        return { close: () => close("dismiss") };
    }
    /** Quick one-line message (saved, copied, errors). Slides down like every other notice. */
    function toast(message, ms = 2600) {
        notice({ body: String(message), ms: Math.max(ms, 2200) });
    }
    function escapeHTML(str = "") {
        return String(str).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    async function loadJSON(path) {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok)
            throw new Error(`Could not load ${path} (${res.status})`);
        return res.json();
    }
    function startOfDay(d) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    function daysBetween(from, to) {
        return Math.round((+startOfDay(to) - +startOfDay(from)) / 86400000);
    }
    function formatTime(date) {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    function formatShortDate(date) {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    function formatLongDate(date) {
        return date.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric"
        });
    }
    function greeting(date = new Date()) {
        const h = date.getHours();
        if (h < 12)
            return "Good morning";
        if (h < 18)
            return "Good afternoon";
        return "Good evening";
    }
    function initials(name = "") {
        return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
    }
    /** Round avatar: picture if there is one, otherwise initials. size: "", "sm", "lg", "xl" */
    function avatar(name, url, size = "") {
        const inner = url ? `<img src="${escapeHTML(url)}" alt="" loading="lazy" />` : escapeHTML(initials(name));
        return `<span class="av ${size}">${inner}</span>`;
    }
    /** Wide cover image for a profile; a soft gradient when the person hasn't picked one. */
    function banner(url, cls = "") {
        return `<div class="banner ${url ? "" : "empty"} ${cls}">${url ? `<img src="${escapeHTML(url)}" alt="" loading="lazy" />` : ""}</div>`;
    }
    /** Badge shown next to the name of a developer or admin. Students get nothing. */
    function roleBadge(role) {
        if (role !== "developer" && role !== "admin")
            return "";
        const label = role === "developer" ? "Developer" : "Admin";
        const icon = role === "developer"
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
        return `<span class="role-badge ${role}" title="${label}">${icon}${label}</span>`;
    }
    /** Escaped name followed by the role badge (if any). */
    function nameWithBadge(name, role) {
        return `${escapeHTML(name)}${roleBadge(role)}`;
    }
    return { initials, avatar, banner, roleBadge, nameWithBadge, toast, notice, escapeHTML, loadJSON, startOfDay, daysBetween, formatTime, formatShortDate, formatLongDate, greeting };
})();
