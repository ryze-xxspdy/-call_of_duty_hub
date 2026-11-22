/* ---------- Contact staff: message the developer or any admin ----------
   Lists every Developer / Admin account with a quick message box.
   The message lands in their normal Messages inbox, so they can reply there.
   (schema.sql section 18 lets anyone message staff, and lets staff reply to anyone.)
*/
const Contact = (() => {
  const db = () => Auth.client;
  const ROLE_NOTE: Record<string, string> = {
    developer: "Bugs, account problems, feature ideas",
    admin: "Reports, posts, communities and moderation"
  };
  let token = 0;

  async function mount(el: HTMLElement, me: { id: string }) {
    const mine = ++token;
    let box: HTMLElement;
    mountInto(el,
      <div className="page-intro">
        <h1 className="view-title">Contact staff</h1>
        <p className="sub">Need help or want to report something? Send a message to the developer or an admin. They reply in your Messages.</p>
      </div>,
      <div id="contact-list" ref={(n: HTMLElement) => (box = n)}><div className="empty">Loading…</div></div>
    );

    const { data, error } = await db().from("public_profiles")
      .select("id,name,avatar,banner,bio,role,created_at").in("role", ["developer", "admin"]).neq("id", me.id);
    if (mine !== token) return;
    if (error) {
      mountInto(box, <div className="empty-state"><h3>Couldn't load staff</h3><p>{error.message}</p></div>);
      return;
    }

    const staff = (data || []).slice().sort((a, b) =>
      (a.role === "developer" ? 0 : 1) - (b.role === "developer" ? 0 : 1) || a.name.localeCompare(b.name));
    if (!staff.length) {
      mountInto(box, <div className="empty-state">There is nobody else on the staff team yet.</div>);
      return;
    }

    mountInto(box, <div className="contact-grid">{staff.map(card)}</div>);

    const paintOnline = () => {
      if (mine !== token || !box.isConnected) return false;
      box.querySelectorAll<HTMLElement>("[data-online]").forEach((n) => {
        mountInto(n, Social.isOnline(n.dataset.online) ? <span className="online-text">● Online now</span> : "Offline");
      });
    };
    paintOnline();
    Social.on("presence", paintOnline);
    Social.fetchProfiles(staff.map((p) => p.id));   // so the Messages inbox can show their names
  }

  async function send(e: Event, to: string) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector("textarea");
    const btn = form.querySelector<HTMLButtonElement>("button");
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await Messages.send(to, text);
      input.value = "";
      Utils.toast("Message sent. Replies will show up in Messages.", 3500);
    } catch (ex) {
      Utils.toast(ex.message, 5000);
    } finally {
      btn.disabled = false; btn.textContent = "Send message";
    }
  }

  function card(p) {
    const label = p.role === "developer" ? "Developer" : "Admin";
    return (
      <article className="contact-card">
        {raw(Utils.banner(p.banner, "slim"))}
        <div className="contact-body">
          <a className="contact-who" href={`#user-${p.id}`}>
            {raw(Utils.avatar(p.name, p.avatar, "lg"))}
            <div>
              <strong>{raw(Utils.nameWithBadge(p.name, p.role))}</strong>
              <small data-online={p.id}></small>
            </div>
          </a>
          <p className="contact-note"><b>{label}</b> · {ROLE_NOTE[p.role] || ""}</p>
          {p.bio ? <p className="contact-bio">{p.bio}</p> : null}
          <form className="contact-form" data-to={p.id} onSubmit={(e: Event) => send(e, p.id)}>
            <textarea className="text-input" rows={3} maxLength={1000} placeholder={`Write a message to ${p.name}…`} aria-label={`Message to ${p.name}`}></textarea>
            <div className="contact-actions">
              <a className="btn-sm ghost" href={`#messages-${p.id}`}>Open chat</a>
              <button className="btn-sm primary" type="submit">Send message</button>
            </div>
          </form>
        </div>
      </article>
    );
  }

  return { mount };
})();
