/* ---------- Onboarding: new accounts must finish their profile first ----------
   Asks for: username, profile photo, banner, bio  (+ phone number, optional).
   Shown full-screen over the dashboard until the database confirms the setup
   (public.complete_profile_setup sets profiles.setup_complete = true).          */
const Onboarding = (() => {
  const BUCKET = "avatars";
  const MAX_IMG = 5 * 1024 * 1024;
  const IMG_TYPES = /^image\/(jpeg|png|gif|webp)$/;
  const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{2,29}$/;
  const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
  const esc = Utils.escapeHTML;
  const db = () => Auth.client;

  /** Does this profile still need to be set up? (false when the schema hasn't been updated yet) */
  const needed = (user) => !!user && user.setup_complete === false;

  /** Show the setup screen; resolves once the profile is saved. Updates `user` in place. */
  function run(user) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "setup-backdrop";
      wrap.innerHTML = `
        <form class="setup-card" id="setup-form" novalidate>
          <header class="setup-head">
            <h1>Set up your profile</h1>
            <p>Welcome to ConfessHub! Finish your profile to get started. This is how other people will see you.</p>
          </header>

          <div class="setup-visual">
            <div id="su-banner" class="setup-banner-slot"></div>
            <div class="setup-avatar-slot" id="su-avatar"></div>
          </div>
          <div class="setup-pickers">
            <label class="btn-sm file-btn" for="su-banner-file">Banner <b class="req">*</b>
              <input type="file" id="su-banner-file" accept="image/jpeg,image/png,image/gif,image/webp" hidden />
            </label>
            <label class="btn-sm file-btn" for="su-avatar-file">Profile photo <b class="req">*</b>
              <input type="file" id="su-avatar-file" accept="image/jpeg,image/png,image/gif,image/webp" hidden />
            </label>
          </div>
          <small class="dim setup-note">JPG, PNG, GIF or WEBP · max 5 MB each · wide banners (about 3:1) look best</small>

          <div class="setup-fields">
            <label class="field-label" for="su-name">Username <b class="req">*</b></label>
            <input class="text-input" id="su-name" maxlength="30" autocomplete="nickname" spellcheck="false" placeholder="e.g. juan_dc" />
            <small class="setup-hint" id="su-name-hint">3–30 characters: letters, numbers, spaces, dot, dash or underscore.</small>

            <label class="field-label" for="su-phone">Phone number <span class="dim">(optional)</span></label>
            <input class="text-input" id="su-phone" type="tel" maxlength="20" autocomplete="tel" placeholder="+63 912 345 6789" />
            <small class="setup-hint">Private. Other users never see your phone number.</small>

            <label class="field-label" for="su-bio">Bio <b class="req">*</b> <span class="dim" id="su-bio-count">0/300</span></label>
            <textarea class="text-input" id="su-bio" rows="4" maxlength="300" placeholder="Tell people a little about you…"></textarea>
          </div>

          <p class="form-error" id="su-error" role="alert"></p>
          <button class="btn primary setup-submit" id="su-submit" type="submit">Finish setup</button>
          <button class="btn-link setup-logout" id="su-logout" type="button">Log out</button>
        </form>`;
      document.body.appendChild(wrap);
      document.body.classList.add("setup-open");

      const $ = (s) => wrap.querySelector(s);
      const state = {
        avatarFile: null, avatarPreview: null, avatarUrl: null,   // *Url = already uploaded (kept if the save has to be retried)
        bannerFile: null, bannerPreview: null, bannerUrl: null,
        nameOk: null                                              // null = unchecked, true / false = result of the last check
      };

      // Start from the name typed at sign-up, cleaned up to fit the username rules.
      const guess = (user.name || "").replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 30);
      $("#su-name").value = guess;

      const drawAvatar = () => { $("#su-avatar").innerHTML = Utils.avatar($("#su-name").value || user.name, state.avatarPreview, "xl"); };
      const drawBanner = () => { $("#su-banner").innerHTML = Utils.banner(state.bannerPreview); };
      const drawCount = () => { $("#su-bio-count").textContent = `${$("#su-bio").value.length}/300`; };
      drawAvatar(); drawBanner(); drawCount();
      $("#su-bio").addEventListener("input", drawCount);

      const err = $("#su-error");
      const fail = (m) => { err.textContent = m; };

      /* ----- pictures ----- */
      function pick(inputId, key) {
        $(inputId).addEventListener("change", (e) => {
          const f = e.target.files[0];
          if (!f) return;
          if (!IMG_TYPES.test(f.type)) { e.target.value = ""; return fail("Please choose a JPG, PNG, GIF or WEBP picture."); }
          if (f.size > MAX_IMG) { e.target.value = ""; return fail("That picture is over 5 MB."); }
          fail("");
          if (state[key + "Preview"]) URL.revokeObjectURL(state[key + "Preview"]);
          state[key + "File"] = f;
          state[key + "Url"] = null;                       // a new file replaces any earlier upload
          state[key + "Preview"] = URL.createObjectURL(f);
          key === "avatar" ? drawAvatar() : drawBanner();
        });
      }
      pick("#su-avatar-file", "avatar");
      pick("#su-banner-file", "banner");

      /* ----- username: format check + live "is it taken?" check ----- */
      const hint = $("#su-name-hint");
      const HINT_DEFAULT = hint.textContent;
      let timer, seq = 0;
      async function checkName() {
        const name = $("#su-name").value.trim();
        const mine = ++seq;
        state.nameOk = null;
        hint.className = "setup-hint";
        if (!name) { hint.textContent = HINT_DEFAULT; return; }
        if (!USERNAME_RE.test(name)) { state.nameOk = false; hint.textContent = "3–30 characters: letters, numbers, spaces, dot, dash or underscore."; hint.classList.add("bad"); return; }
        hint.textContent = "Checking…";
        const { data, error } = await db().rpc("username_available", { p_name: name });
        if (mine !== seq) return;
        if (error) { state.nameOk = true; hint.textContent = HINT_DEFAULT; return; }   // the final save checks again
        state.nameOk = !!data;
        hint.textContent = data ? "✓ Username is available." : "That username is already taken.";
        hint.classList.add(data ? "ok" : "bad");
      }
      $("#su-name").addEventListener("input", () => { drawAvatar(); clearTimeout(timer); timer = setTimeout(checkName, 350); });
      checkName();

      $("#su-logout").addEventListener("click", Auth.logout);

      /* ----- save ----- */
      async function upload(file, prefix) {
        const ext = (file.name.match(/\.(\w{1,5})$/) || [, "jpg"])[1].toLowerCase();
        const path = `${user.id}/${prefix}${Date.now()}.${ext}`;
        const up = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600" });
        if (up.error) throw new Error(/bucket not found/i.test(up.error.message)
          ? "Photo storage isn't set up yet. Re-run supabase/schema.sql in Supabase."
          : /row-level security|not authorized|policy/i.test(up.error.message)
            ? "Picture upload was blocked. Re-run supabase/schema.sql in Supabase."
            : up.error.message);
        return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }

      $("#setup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        fail("");
        const name = $("#su-name").value.trim();
        const phone = $("#su-phone").value.trim();
        const bio = $("#su-bio").value.trim();

        if (!state.bannerFile && !state.bannerUrl) return fail("Please add a banner.");
        if (!state.avatarFile && !state.avatarUrl) return fail("Please add a profile photo.");
        if (!USERNAME_RE.test(name)) return fail("Username must be 3–30 characters: letters, numbers, spaces, dot, dash or underscore.");
        if (state.nameOk === false) return fail("That username is already taken. Please pick another one.");
        if (phone && !PHONE_RE.test(phone)) return fail("Enter a valid phone number (digits, spaces, + ( ) -), or leave it empty.");
        if (!bio) return fail("Please write a short bio.");

        const btn = $("#su-submit");
        btn.disabled = true; btn.textContent = "Saving…";
        try {
          if (!state.avatarUrl) state.avatarUrl = await upload(state.avatarFile, "");
          if (!state.bannerUrl) state.bannerUrl = await upload(state.bannerFile, "banner-");
          const { error } = await db().rpc("complete_profile_setup", {
            p_name: name, p_phone: phone || null, p_avatar: state.avatarUrl, p_banner: state.bannerUrl, p_bio: bio
          });
          if (error) throw new Error(error.message);

          Object.assign(user, { name, phone: phone || null, avatar: state.avatarUrl, banner: state.bannerUrl, bio, setup_complete: true });
          [state.avatarPreview, state.bannerPreview].forEach((u) => u && URL.revokeObjectURL(u));
          document.body.classList.remove("setup-open");
          wrap.remove();
          resolve(user);
          Utils.toast("Profile ready. Welcome!", 3000);
        } catch (ex) {
          fail(ex.message || "Couldn't save your profile. Please try again.");
          btn.disabled = false; btn.textContent = "Finish setup";
        }
      });

      setTimeout(() => $("#su-name").focus(), 50);
    });
  }

  return { needed, run };
})();
