"use strict";
/* ---------- Auth (Supabase) ---------- */
const Auth = (() => {
    const cfg = window.STUDYHUB_CONFIG || {};
    const configured = !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
        !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) && !!window.supabase;
    const client = configured
        ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
        : null;
    const COLS = "*"; // own row: includes banner once schema section 18 is run, and still works before
    async function fetchProfile(authUser) {
        let { data, error } = await client.from("profiles").select(COLS).eq("id", authUser.id).maybeSingle();
        if (error)
            throw error;
        if (!data) {
            // Profile row missing (account older than the signup trigger): ask the database to create it.
            const fix = await client.rpc("ensure_my_profile");
            if (fix.error)
                console.warn("Could not repair profile:", fix.error.message);
            else
                ({ data } = await client.from("profiles").select(COLS).eq("id", authUser.id).maybeSingle());
        }
        // A timed ban that has run out: ask the database to clear it, then reload the row.
        if (data && data.banned_at && data.ban_until && new Date(data.ban_until) <= new Date()) {
            await client.rpc("lift_expired_bans");
            ({ data } = await client.from("profiles").select(COLS).eq("id", authUser.id).maybeSingle());
        }
        // Facebook accounts made with a phone number have no email, so never assume one exists.
        const meta = authUser.user_metadata || {};
        const email = authUser.email || "";
        return data || { id: authUser.id, name: meta.name || meta.full_name || (email ? email.split("@")[0] : "Student"), email, role: "student", avatar: null, bio: "" };
    }
    const BAN_KEY = "studyhub.banned";
    /** Banned: remember the details (the login page shows them in a pop-up) and sign out. */
    async function kickBanned(info) {
        try {
            sessionStorage.setItem(BAN_KEY, JSON.stringify(info || {}));
        }
        catch { }
        if (client)
            await client.auth.signOut();
    }
    const banInfo = (p) => ({ email: p.email || "", reason: p.ban_reason || "", until: p.ban_until || null, name: p.name || "" });
    /** The ban details left for the login page (once): { email, reason, until, name }, or null. */
    function takeBanNotice() {
        try {
            const v = sessionStorage.getItem(BAN_KEY);
            sessionStorage.removeItem(BAN_KEY);
            if (!v)
                return null;
            try {
                const o = JSON.parse(v);
                return o && typeof o === "object" ? o : {};
            }
            catch {
                return {};
            }
        }
        catch {
            return null;
        }
    }
    /** Signed out and not signed in: is this email banned? -> { banned, reason, until } */
    async function banStatus(email) {
        if (!client)
            return { banned: false };
        const { data, error } = await client.rpc("ban_status", { p_email: email });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row)
            return { banned: false };
        return { banned: !!row.banned, reason: row.reason || "", until: row.ban_until || null };
    }
    /** A banned person writes to the developer (works while signed out). */
    async function sendAppeal(email, message) {
        if (!client)
            throw new Error("Supabase isn't configured yet.");
        const { error } = await client.rpc("submit_ban_appeal", { p_email: email, p_message: message });
        if (error) {
            if (/schema cache|function .*submit_ban_appeal/i.test(error.message))
                throw new Error("Messaging isn't set up yet. The developer needs to re-run supabase/schema.sql (section 24).");
            throw new Error(error.message);
        }
    }
    /** A friendly date + time for a timed ban, or null when the ban is permanent. */
    function banEnds(until) {
        if (!until)
            return null;
        return new Date(until).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    }
    /** Current signed-in profile, or null. */
    async function currentUser() {
        if (!client)
            return null;
        const { data } = await client.auth.getSession();
        if (!data.session)
            return null;
        try {
            const profile = await fetchProfile(data.session.user);
            if (profile.banned_at) {
                await kickBanned(banInfo(profile));
                return null;
            }
            return profile;
        }
        catch (err) {
            console.warn(err);
            return null;
        }
    }
    /** Has the developer banned me since I opened the page? (polled by the dashboard) */
    async function checkBanned(userId) {
        if (!client)
            return false;
        const { data, error } = await client.from("profiles").select("email,name,banned_at,ban_reason,ban_until").eq("id", userId).maybeSingle();
        if (error)
            return false;
        if (data && data.banned_at && (!data.ban_until || new Date(data.ban_until) > new Date())) {
            await kickBanned(banInfo(data));
            return true;
        }
        return false;
    }
    async function recordLogin(profile) {
        const { error } = await client.from("login_events").insert({ user_id: profile.id });
        if (error)
            console.warn("Could not record login:", error.message);
    }
    /** Build the error the login page turns into the ban pop-up. */
    async function bannedError(email) {
        const st = await banStatus(email);
        const e = new Error("This account has been banned.");
        e.ban = { email: email.trim(), reason: st.reason || "", until: st.until || null };
        return e;
    }
    async function login(email, password) {
        if (!client)
            throw new Error("Supabase isn't configured yet. See README.");
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
            if (/banned/i.test(error.message))
                throw await bannedError(email);
            throw new Error(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
        }
        const profile = await fetchProfile(data.user);
        if (profile.banned_at) {
            await client.auth.signOut();
            const e = new Error("This account has been banned.");
            e.ban = banInfo({ ...profile, email: profile.email || email.trim() });
            throw e;
        }
        await recordLogin(profile);
        return profile;
    }
    /** Returns { profile } when signed in, or { needsConfirm: true } if email confirmation is on. */
    async function register({ name, email, password }) {
        if (!client)
            throw new Error("Supabase isn't configured yet. See README.");
        // Sign-up always makes a normal account; the database decides the role.
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error)
            throw new Error(error.message);
        if (!data.session)
            return { needsConfirm: true };
        const profile = await fetchProfile(data.user);
        await recordLogin(profile);
        return { profile };
    }
    /** Sends a real password-reset email through Supabase. */
    async function resetPassword(email) {
        if (!client)
            throw new Error("Supabase isn't configured yet. See README.");
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL("index.html", location.href).href });
        if (error)
            throw new Error(error.message);
    }
    async function requireAuth() {
        const user = await currentUser();
        if (!user)
            window.location.replace("index.html");
        return user;
    }
    async function logout() {
        if (client)
            await client.auth.signOut();
        window.location.replace("index.html");
    }
    /**
     * Developer only: create an ADMIN account. Uses a throw-away client so the
     * developer stays signed in, then promotes the new account via the database.
     */
    async function createAdmin({ name, email, password }) {
        if (!client)
            throw new Error("Supabase isn't configured yet.");
        const tmp = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { data, error } = await tmp.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error)
            throw new Error(error.message);
        if (!data.user || (data.user.identities && data.user.identities.length === 0))
            throw new Error("An account with that email already exists. Use the Accounts list to promote it.");
        const { error: e2 } = await client.rpc("set_user_role", { target: data.user.id, new_role: "admin" });
        if (e2)
            throw new Error(e2.message);
        return data.user;
    }
    const isStaff = (u) => !!u && (u.role === "admin" || u.role === "developer");
    return { configured, isStaff, createAdmin, get client() { return client; }, login, register, resetPassword, currentUser, requireAuth, logout, checkBanned, takeBanNotice, banStatus, sendAppeal, banEnds };
})();
