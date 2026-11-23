# StudyHub / ConfessHub

Login + dashboard with a posts feed (text, photo, video), an admin panel, and a Supabase database.
Plain HTML + CSS, with the app code written in TypeScript / TSX and compiled to `js/`. The compiled `js/` folder is included, so it runs with no build step.

## 1. Set up Supabase (5 minutes)
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, press **Run**.
   - Before running, set your **developer email** in the `insert into public.admin_settings` line
     (default `shopeehack40@gmail.com`). The account that signs up with that email becomes the **developer**.
     Sign up with it right away. Already have an account with that email? Re-running the SQL promotes it.
   - Re-running on an existing project is safe; the old admin code is removed.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `js/config.js`.
4. **Authentication → Providers → Email**: keep **Confirm email ON** (this is the Gmail / email verification, see below).

## 2. Run it
    cd studyhub
    python3 -m http.server 8000
Open http://localhost:8000

## How it works
- **Roles**: `student` (everyone who signs up) < `admin` < `developer`.
  The sign-up form has no role choice, so every public sign-up is a student.
  Roles can't be edited from the browser except through the developer-only database functions.
- **Developer** (sidebar, developer only): create **admin accounts** (name, email, password), switch anyone
  between Student and Admin, and delete accounts. The developer also gets the full Admin panel and can delete any post.
  Admins can only moderate posts and view users / logins; they cannot create or change accounts.
- **Dashboard**: **Posts** on the left (text, photo or video up to 50 MB; delete your own, admins/developer can delete any)
  and an **Active now** list on the right showing who is online (live, via Supabase Realtime presence). Click anyone to open their profile.
- **Edit profile** (sidebar or avatar menu): change your profile picture, username and bio.
  Other users only ever see your photo, username and bio (through the `public_profiles` view); never your email.
- **Friends**: find people under **Search Here → User**, open their profile and press **Add friend**.
  Incoming requests show up under **Friend Request** (and the bell) with **Accept** / **Reject**.
  Once accepted, they appear in the **Friends** list and you can open their profile to see all their posts.
  Re-run `supabase/schema.sql` once to add the new tables, view and storage bucket.
- **Admin panel** (sidebar, admins + developer): totals, **New logins** (every login with time, NEW badge for the last hour),
  **Users** (name, email, role, joined, last login) and **Posts** moderation. Admins also get a pop-up
  toast the moment someone logs in.

- **Communities**: anyone can **Request a community** (name + description). Admins and the developer see it under
  **Communities → Requests to review** (and get a notification) and press **Approve** / **Reject**. Once approved the
  requester owns the community and any member can **add their own friends** to it, like a group chat.
  Owners (and staff) can remove members or delete it; members can leave.
- **Notifications** (bell): friend requests with **Add friend / Decline** buttons, plus notices from the admin / developer side:
  *"You are now an Admin"* (shown as a pop-up the moment the developer promotes you, no refresh needed),
  community requests to review, community approved / declined, and "added to a community".
  **Re-run `supabase/schema.sql`** to add the notification + community tables and the profile repair.

- **Reviewing communities**: admins / developer can also approve or reject from **Admin panel → Communities**
  (with a badge for pending requests). Staff can review any pending request, including their own.
- **Reactions & comments**: every post has a reaction picker (👍 ❤️ 😂 😮 😢 🔥, one per person, click again to remove)
  and a comment thread. Authors, the commenter and staff can delete comments; post authors get a notification.
  **Re-run `supabase/schema.sql`** to add `post_reactions` / `post_comments` and the updated review function.
- **Comment replies & message reactions**: every comment has a **Reply** button (one level of threading; replying to a reply
  adds an `@name`) and its own reaction picker. Chat bubbles (1-to-1 messages and community chat) also take the same six
  reactions: hover a bubble and press ☺ (tap it on a phone). People get a notification when someone replies to their comment.
  **Re-run `supabase/schema.sql`** (section 20) to add `post_comments.parent_id`, `comment_reactions`, `message_reactions`
  and `community_message_reactions`.

- **Announcements**: admins and the developer post them under **Announcements → New announcement**.
  Every user gets a **pop-up** (instantly if online, or at their next login). It shows **once per person**:
  after pressing *Got it* it never pops up again, and after **24 hours** it stops popping up either way
  (it stays on the Announcements page as history). "Seen" is stored in the database (`announcement_seen`).
- **Staff-login alerts**: when an admin or the developer logs in, every student gets a bell notification + toast
  (at most once per hour per staff member).
- **Bell number**: now only counts real things: friend requests, unread notifications and new announcements. It hides at 0.
  **Re-run `supabase/schema.sql`** (section 14) to add the announcement tables and the login-alert trigger.

- **Messages**: the chat icon (top bar) and **Messages** in the sidebar open your inbox. Chat 1-to-1 live with friends or
  anyone you share a community with (press **Message** on their profile). Unread messages show a red number.
- **Community chat**: every member of an approved community gets a live group chat on the community page.
- **Add anyone to a community**: members of an approved community can search **all users** and add anyone (not just friends).
  **Re-run `supabase/schema.sql`** (section 15) to add `messages`, `community_messages` and the updated add-member function.
- **Forgot password** on the login page uses real Supabase auth. Google / Facebook login was removed: tapping those buttons shows an "unavailable, please create an account" notice.

- **Role badges**: developer and admin accounts show a **Developer** (orange) or **Admin** (blue) badge next to their name
  everywhere: their profile (plus a "verified staff account" line), posts, comments, chats, Active now, friend lists and search.
  Students never get a badge. **Re-run `supabase/schema.sql`** (section 17) so the public profile view includes `role`.
- **Look**: dark navy sidebar layout (brand + menu on the left, greeting + My Classes + posts in the middle, Active now on the right).
  Theme toggle (sun icon) still switches light / dark.

- **Profile banner**: **Edit profile** now has a wide banner picture (JPG / PNG / GIF / WEBP, max 5 MB) shown at the top of your
  profile for everyone who opens it. No banner = a soft gradient.
- **Contact staff** (sidebar, Account): lists the developer and every admin with a quick message box. Messages arrive in their
  normal **Messages** inbox. Anyone can message staff, and staff can reply to anyone.
- **Announcements to chosen people**: when posting, admins / developer choose **Everyone** or **Specific people** (search a
  username, add as many as needed). Only the chosen people get the pop-up and can read it; the author and the developer can always see it.
- Removed: the "SY 2026 - 2027 · 1 Semester" label and the **My Classes** cards (and `data/classes.json`).
  **Re-run `supabase/schema.sql`** (section 18) to add the banner column, staff messaging and announcement recipients.

- **New-account profile setup**: right after a new user signs up (and confirms their email, if that is on) a full-screen
  **Set up your profile** page appears and cannot be skipped. It asks for **username** (3-30 characters, must be unique),
  **profile photo**, **banner** and **bio**, plus an **optional phone number**. Only then can they use the app.
  The phone number is private (never shown to other users) and can be changed later under **Edit profile**.
  Accounts that already existed are treated as set up, so nobody is forced through it.
  The rules are enforced in the database (`complete_profile_setup`), not just in the browser.
- **Reports**: every profile has a **Report** button and every post has a flag button. The person picks a reason
  (spam, harassment, inappropriate, impersonation, scam, other) and can add details. The developer and all admins get a
  bell notification and see the report under **Admin panel → Reports** (red number = reports waiting), with who reported whom,
  the reason, the reported post's text and how many reports that user has. Reports are private; the reporter is never told who else reported.
- **Ban (developer only)**: on a report the developer presses **Ban user** (with a reason) or **Dismiss**. Admins can read reports but cannot act on them.
  The developer can also **Ban / Unban** anyone from **Developer → All accounts**. A banned account is signed out within about 30 seconds,
  cannot log in again (the login page shows "This account has been banned" and the reason), cannot post, comment, react, message or send friend
  requests, and loses admin powers if it was an admin. The developer account can't be banned or reported.
  **Re-run `supabase/schema.sql`** (sections 22 and 23) to add the setup columns, the `reports` table and the ban functions.

## Source code (TypeScript / TSX)
All app code lives in `src/` (`.ts`, `.tsx`, and one plain `.js` game) and compiles to `js/`, which the HTML pages load.
After editing anything in `src/`, rebuild:

    npm install      # once (installs TypeScript)
    npm run build    # tsc -p .  ->  writes js/
    npm run watch    # rebuild on save

- `.tsx` files use a tiny built-in JSX runtime (`src/jsx.ts`: `h`, `Fragment`, `raw`, `mountInto`), no React and no bundler.
  JSX text is escaped automatically; use `raw(html)` only for trusted markup such as `Utils.avatar(...)`.
- TSX files: `dashboard.tsx` (shell, notifications, announcements), `contact.tsx` and everything in `src/games/`.
- Everything else is typed TypeScript (`.ts`). `src/games/mathsprint.js` is deliberately plain JavaScript.
- Don't edit `js/` by hand; it is overwritten by the build.

## Games (replaces the Calendar)
The **Games** sidebar link opens a picker (`#games`); each game opens at `#games-<id>`. Personal bests are saved per account in the browser.
Tic-Tac-Toe (vs computer, Easy / Hard), Snake, Memory Match, 2048, Minesweeper and Math Sprint.
To add a game: create `src/games/<name>.tsx` exporting a `GameModule` (see `src/games/types.d.ts`), add its `<script>` to `dashboard.html`
before `games.js`, and list it in `REGISTRY` in `src/games/games.tsx`.

## Files
    index.html / dashboard.html
    src/            TypeScript / TSX sources (edit these)
    js/             compiled output loaded by the pages (generated)
    css/games.css   styles for the Games pages
    js/config.js    Supabase URL + key (you fill this in; source is src/config.ts)
    js/auth.js      Supabase login, sign-up, session
    js/feed.js      posts feed + composer + uploads
    js/social.js    profiles, friends, requests, user search, active users
    js/admin.js     admin panel
    js/developer.js developer panel (create admins, manage accounts)
    js/notify.js    notification pop-ups + panel data
    js/announce.js  announcements: one-time pop-up, 24h window
    js/messages.js  1-to-1 chat + unread count
    js/globalchat.js  Global chat (one public room for everyone)
    js/communities.js  community requests, approval, members, community chat
    js/contact.js   Contact staff page (message the developer / admins)
    js/onboarding.js first-time profile setup screen (username, photo, banner, bio, phone)
    js/reports.js   report pop-up (users and posts)
    js/dashboard.js dashboard, routing
    supabase/schema.sql   tables, security rules, storage bucket, realtime

- **Timed bans, ban pop-up and appeals**: when the developer bans someone (Developer panel → All accounts → Ban, or Admin panel → Reports → Ban user)
  they pick a reason and a length: permanent, 1 hour … 30 days, or a custom number of minutes / hours / days. A timed ban lifts itself when the time is up;
  the developer can **Unban** at any time. A banned person is signed out and sees a **"Your account has been banned"** pop-up on the login page with the
  reason, when the ban ends, and a box to **message the developer**. That message arrives in the developer's Messages, in the bell, and in
  **Developer panel → Ban appeals** (Unban / Dismiss). Anyone who opens a banned person's profile sees **"This user has been banned"** and can't message or add them.
  **Re-run `supabase/schema.sql`** (section 24) to add `profiles.ban_until`, `ban_appeals` and the new ban functions.

- **Games, points & levels**: the Games hub now has 13 games (Tic-Tac-Toe, Snake, Memory Match, 2048, Minesweeper, Math Sprint,
  plus Whack-a-Mole, Reaction Test, Simon Says, Word Scramble, Connect Four, Typing Sprint, Quick Quiz).
  Every finished round awards **points** and **XP** (each game card shows how many). XP raises your **level** (bonus points on every level-up);
  points are your spendable balance. The top bar shows your level and points.
- **Redeem** (sidebar): spend points on **CODM codes** and **MLBB top-ups** (the old badge / colour-theme rewards are gone).
  - **CODM**: redeeming gives the student a code straight away. It is shown in a pop-up and kept under **My redemptions** so it can be found again.
  - **MLBB**: the student enters **Game ID, Server and IGN**. Every admin / the developer gets a notification (pop-up + bell) with those details,
    sends the item in the game and taps **Mark delivered**, which notifies the student.
  - **No stock = gray**: a reward with stock 0 turns gray and can't be redeemed until an admin adds more.
  Points, level and XP are saved per account in this browser's localStorage, like personal bests. To add a game, create `src/games/<name>.tsx`,
  call `api.award(points)` when a round ends, and add it to `REGISTRY` in `src/games/games.tsx` plus a `<script>` tag in `dashboard.html`.
- **Admin / developer tools (Redeem + Games)**: admins and the developer are always **Level 100** (max). They see an admin bar to give themselves points
  (Add / Set balance / quick +1,000, +10,000, +100,000) on the Games pages and on Redeem. On Redeem they also get an **Admin panel**:
  - **Gift points**: search a person by name or email and send them points. Only **points** are gifted, never levels / XP. The person gets a
    notification and the points land in their balance (instantly if the app is open, otherwise the next time they open it).
  - **MLBB orders**: the orders waiting for you (Game ID, Server, IGN) with **Copy details** and **Mark delivered**.
  - **Add a reward**: CODM (paste codes, one per line, the number of codes is the stock) or MLBB (type the stock), with emoji, name, description and cost.
  - **Stock**: CODM = **+ Add codes**. MLBB = **+ Add stock** or **Set** (exact amount). Hide / Show, Delete.
  The shop, codes, orders and gifts are stored in the database so everyone sees the same stock.
  **You must re-run `supabase/schema.sql` once (section 25)**: it removes the old badge / theme shop and creates `shop_items`, `shop_codes`,
  `shop_orders`, `point_gifts` and the `shop_*`, `gift_points` and `claim_gifts` functions. Until then the shop is empty and the admin tools are disabled.
  Code: `src/rewards.ts` (points, shop loading, gifts, admin functions), `src/redeem.tsx` (the page + admin panel) and `src/games/games.tsx` (points bar).
  Run `tsc -p .` (or `npm run build`) after editing `src/`.

- **Sliding notifications**: every notification and toast now slides down from the top like a nav bar, waits a few seconds and slides away
  (`Utils.notice` / `Utils.toast` in `src/utils.ts`, styles in `css/base.css`). Tap it to open its link, tap **×** or swipe it up to dismiss, hover / touch
  pauses the timer. Bell notifications (orders, gifts, comments, role changes...) use it instead of the old centred pop-ups. One that slid away on its own
  stays unread in the bell; tapping or dismissing it marks it read.
- **Finished orders stop notifying other staff**: an MLBB order notifies every admin / the developer once, and the notification carries the order id.
  The moment one of them taps **Mark delivered**, that notification is deleted for all the others (their bell, and a banner still on screen slides away),
  and their Orders list refreshes live. CODM orders are done instantly, so no admin is ever notified about them.
- **Cleaner Redeem admin tools**: one card with tabs: **Orders** (red number = waiting), **Gift points**, **Add reward**, **Stock**.
  Gifting is now two steps (search + pick a person, then an amount with quick chips) and asks you to confirm before sending.
- **Recent activity is public**: the Redeem page ends with a live feed everyone can see: who redeemed what, what was delivered and who received a gift.
  It is stored in `shop_activity` and never contains codes, Game IDs, server numbers or emails. Your own game-points history moved into a collapsed
  **Your points history** below it.
- **Global chat** (sidebar, Social -> **Global chat**, `#global-chat`): one public room for every signed-in account, live. Day dividers, grouped messages,
  "Load earlier messages", a **New messages** pill when you're scrolled up, and an unread number on the sidebar link. Delete your own messages
  (admins / the developer can delete any). Banned accounts can't post, and there is a small anti-spam limit (6 messages / 10 seconds).
  **Re-run `supabase/schema.sql`** (section 25 was extended, section 26 is new) to add `notifications.ref_id`, `shop_activity` and `global_messages`.


## Email (Gmail) verification, login animation, dashboard entrance
- **Create account** sends a verification email (Supabase Auth). The screen then says *Verify your Gmail*, with an **Open Gmail** button,
  **Resend** (60 s cooldown) and an optional box for the number code. The person can't log in until the email is confirmed
  (trying anyway shows "verify your email first" with a Resend link).
- After verifying (by link or code) they land on the **login page** with a green "Email verified" note, log in, see a **welcome animation**,
  and the **dashboard animates in** (sidebar, top bar, content). Animations switch off for people with "reduce motion".
- Supabase setup for this:
  1. **Authentication → Providers → Email → Confirm email = ON**.
  2. **Authentication → URL Configuration**: set **Site URL** to where you host the app and add it (e.g. `https://yoursite.com/index.html*`,
     and `http://localhost:8000/index.html*` for testing) to **Redirect URLs**. The link in the email returns there.
  3. (Optional, for the number code) **Authentication → Email Templates → Confirm signup**: add `{{ .Token }}` to the message.
  4. Supabase's built-in mailer is rate-limited (a few emails per hour). For real use set your own SMTP under **Authentication → SMTP Settings**
     (a Gmail app password or any SMTP provider works).
- Want Gmail addresses only? Set `ONLY_GMAIL: true` in `src/config.ts` / `js/config.js`.

## Points store (pay with Maya / PayMaya only)
Sidebar → **Buy points**. Packs are rows in the `point_packages` table (edit prices / points / bonus in the Supabase Table Editor).
Payment goes through **Maya Checkout**; points are added only after Maya confirms the payment, and exactly once.

**Set it up (once):**
1. Re-run `supabase/schema.sql` (adds section 27: packs, purchases, and the functions that credit points).
2. Get your Maya keys (Maya Business Manager; the sandbox keys are in the Maya docs for testing).
3. Install the Supabase CLI, then from this folder:

       supabase login
       supabase link --project-ref <your-project-ref>
       supabase secrets set MAYA_PUBLIC_KEY=pk-xxxx MAYA_SECRET_KEY=sk-xxxx MAYA_ENV=sandbox
       supabase functions deploy maya-checkout
       supabase functions deploy maya-webhook --no-verify-jwt

   Use `MAYA_ENV=production` with your live keys when you go live.
4. In the Maya Manager, register the webhook URL `https://<your-project-ref>.supabase.co/functions/v1/maya-webhook`
   for the `CHECKOUT_SUCCESS`, `CHECKOUT_FAILURE` and `CHECKOUT_DROPOUT` events. (Optional but recommended: it credits points even if the
   buyer closes the tab. Without it, points are credited when they return to the site.)

**How it stays safe:** the secret key only exists inside the Edge Functions, never in the browser. The browser can't create paid orders
or add points: it only asks the function to check with Maya, and the function re-reads the payment from Maya (order id, status and amount)
before calling `credit_purchase()`, which pays out once per order. Points arrive as a "Points Store" gift, collected by the same
mechanism that already handles admin gifts. Test with the sandbox first (Maya publishes test wallet / card details in its docs).
