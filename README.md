# The Arena VR — Website

Static website for **The Arena VR Limited**, 85 Boundary Road, GRA, Benin City.
No build step, no server, no dependencies. Upload the folder and it runs.

---

## Files

```
index.html               Home page
book.html                Booking + payment flow
README.md                This file
admin/
  index.html             /admin — the gate (choose a view, sign in)
  manager.html           Manager's View
  director.html          Director's View (super user)
supabase-setup.sql       Run once to switch on cross-device sync
assets/
  css/style.css          All styling (brand tokens at the top)
  css/admin.css          Admin console styling
  js/arena.config.js     ← THE ONLY FILE YOU NORMALLY EDIT
  js/site.js             Home page behaviour (hex canvas, countdowns, reveals)
  js/booking.js          Booking wizard + Paystack checkout
  js/arena.cloud.js      Cross-device backend (Supabase); no-op until configured
  js/admin.auth.js       Sign-in, sessions, manager accounts
  js/admin.data.js       Bookings + expenses store and all the maths
  js/admin.ui.js         KPI tiles, tables, hand-rolled SVG charts
  js/admin.dash.js       Sections both views share
  js/admin.director.js   Director-only sections
  img/                   Section photography
  logo/                  Brand marks from the official asset pack
.claude/launch.json      Local preview config (safe to delete)
```

---

## Going live — the three things to change

Open **`assets/js/arena.config.js`** and search for `### TODO ###`.

**1. Paystack key.** Get it from
`dashboard.paystack.com → Settings → API Keys & Webhooks`.

```js
paystack: {
  publicKey: 'pk_live_xxxxxxxxxxxxxxxxxxxx',
  demoMode:  false
}
```

Use `pk_test_...` with `demoMode: false` to run real test transactions first.
While `demoMode` is `true` (or the key is still the placeholder), the Pay button
runs a **simulated** success so you can click through the whole flow — a yellow
banner on the last step says so. The public key is safe in this file.
**Never put a secret key (`sk_...`) here.**

**2. Social links** — `instagram`, `tiktok`, `x`. (Email is already set to
`thisisyourarena@gmail.com`.)

**3. The rate card.** Every price in the site is a **placeholder**. Each
experience in `experiences[]` has:

| Field | Meaning |
|---|---|
| `price` | Naira charged per block |
| `unit` | How many minutes one block is |
| `unitLabel` | How that block is described on screen |
| `durations` | The session lengths offered in the dropdown |
| `perRoom` | `true` = one price for the whole group (karaoke), `false` = per player |

Example — if 360° VR is ₦4,000 for 20 minutes:

```js
price: 4000,
unit: 20,
unitLabel: '20 mins',
durations: [20, 40, 60],
```

Event entry fees live in `events.fifa.entry` and `events.karaoke.entry`.

---

## Everyday edits

**Add or remove a game** — edit the `games:[...]` array for that experience.
The home page catalogue, the booking picker and the title counts all rebuild
themselves from that one list.

**Change opening hours** — two places, both in `arena.config.js`:

* `business.hours` is the text shown on the website.
* `booking.schedule` controls which slots the booking form actually offers,
  per weekday (`0` = Sunday … `6` = Saturday). `null` means closed that day.

Currently set to **Tuesday–Saturday 10am–7pm, Sunday 1pm–7pm, closed Monday**.
The engine never offers a slot that would run past closing, and picking a
Monday shows "We are closed on Mondays" instead of times. Keep the two in step
if you change one.

**Move an event** — `events.fifa.weekday` (0 = Sunday … 5 = Friday) and `hour`
drive the live countdown. `events.karaoke.nth: 'last'` means "last Saturday of
the month". Change `weekday`/`hour` and the countdown follows.

**Swap a photo** — drop a new image into `assets/img/` and point that
experience's `image:` at it. Around 1600px wide, `.webp` or `.jpg`.
`assets/img/quest.webp` does not exist yet, so the Meta Quest card currently
shows the branded gradient — add the file and set
`image:'assets/img/quest.webp'` when you have a photo.

**Resize the logo** — the files in `assets/logo/` are cropped tight to the
artwork (no transparent padding), so the CSS height *is* the logo height.
Change `.brand img` in `assets/css/style.css` to make the header logo bigger or
smaller, and `.foot-brand img` for the footer one.

**Change the browser icon** — replace `assets/logo/favicon.png` (512px) and
`assets/logo/favicon-192.png`. Both are square with the hexagon centred; keep
them square or the tab icon will look squashed.

---

## Deep links

Useful for adverts, Instagram bios and WhatsApp broadcasts:

| Link | Opens on |
|---|---|
| `book.html` | Step 1 |
| `book.html?exp=ps5` | PS5, straight to game choice |
| `book.html?exp=vr360&game=Beat%20Saber` | VR + Beat Saber, straight to date & time |
| `book.html?event=fifa` | FIFA tournament entry |
| `book.html?event=karaoke` | Karaoke Challenge entry |

Experience ids: `vr360`, `moto`, `ps5`, `quest`, `karaoke`.

---

## The admin console (`/admin`)

Go to **`yoursite.com/admin`**. The first time it opens on a device it asks you
to create a **Director password**. After that you get two doors:

| View | Who | Can see |
|---|---|---|
| **Manager's View** | Business / operations manager | All bookings in every category, customer details and history, engagement and analytics, and **recording costs as they are incurred** |
| **Director's View** | Directors (super user) | Everything above **plus** revenue, best-performing lines, top customers, region with the most customers, the cost register, manager accounts and settings |

**Creating a manager.** Director's View → **Managers** → fill in name, email and
a password → *Create manager*. Give them that password; they sign in at
`/admin` → Manager's View. Managers never see revenue, profit or settings —
those sections do not exist in their page at all. You can reset a manager's
password or delete them from the same screen.

> **With cross-device sync on, there is a second step:** the new account is
> created **disabled** and shows as *Disabled* in the list. Press **Re-enable**
> and they can sign in anywhere. This is deliberate — accounts are created
> through a public endpoint, so new ones start with no access at all. See
> *Account security* below.

**Cost register.** Both views have **Costs & expenses**, writing to the same
register. Record an expense against a category — salaries, fuel, internet,
maintenance, rent, utilities, marketing, stock or other — and the Director's
revenue-vs-costs and profit figures update straight away. Each row shows who
entered it. Export to CSV any time.

**Resetting the Director password.** Director's View → **Settings**. You need
the current password to set a new one. There is deliberately no "forgot
password" — if it is lost, the only way back in is to clear the site data for
your domain in your browser, which also deletes the local bookings and expenses.
**Export from Settings regularly.**

**Sample data.** Settings → *Load sample data* fills the dashboards with made-up
bookings and expenses so you can see how everything behaves. Every row is
tagged **Sample** and *Remove sample data* deletes them without touching real
bookings. Sample rows are always kept on the local device and are never written
to the shared database. Do this before you go live.

**Recording costs.** Both the Manager and the Director can record expenses,
into the same register. The Manager's View has its own **Costs & expenses**
section for entering costs as they are incurred; every entry is stamped with
who recorded it, and shows up on the Director's dashboard immediately, feeding
straight into the revenue-vs-costs and profit figures. The Manager sees the
cost totals but never revenue or profit.

---

## Cross-device setup

**This is the important one.** Out of the box the site stores everything in the
browser, which means:

* a booking made on a customer's phone does **not** appear on your laptop
  dashboard, and
* the admin password is only checked by the page, so someone technical could
  skip it.

Both problems have the same cause — no server — and the same fix. It is free
and takes about ten minutes.

### What you get

| | Before | After |
|---|---|---|
| Booking made on a customer's phone | Invisible to you | On every dashboard, instantly |
| Costs entered by the manager on their phone | Only on their phone | Visible to the Director everywhere |
| Manager logins | One browser only | Any device |
| Admin password | A screen you could skip | Enforced by the server — real security |

### Steps

1. **Create a free project** at [supabase.com](https://supabase.com). Any
   region; the free tier is plenty. Note the database password somewhere safe.

2. **Run the setup script.** Open your project → **SQL Editor** → **New query**
   → paste the whole of **`supabase-setup.sql`** (in this folder) → **Run**.
   That creates the tables and, crucially, the rules deciding who may read and
   write what.

3. **Create your Director account.** Project → **Authentication** → **Users** →
   **Add user**. Enter your email and a password and tick **Auto Confirm User**.
   Then back in the SQL Editor run, with your own email:

   ```sql
   update public.profiles set role = 'director' where email = 'you@example.com';
   ```

4. **Connect the website.** Project → **Settings** → **API**. Copy the
   **Project URL** and the **anon / public** key into `arena.config.js`:

   ```js
   cloud: {
     url:     'https://abcdefgh.supabase.co',
     anonKey: 'eyJhbGciOi...'
   },
   ```

   Then bump the `?v=` number on the script tags (see *If a change doesn't show
   up* below).

5. **Sign in** at `/admin` with the email and password from step 3. The banner
   at the top of the dashboard should now read *"Shared across devices."*
   Create your manager logins from **Director's View → Managers**; they work on
   any device straight away.

### Account security

Staff logins are created through Supabase's public signup endpoint, which
accepts the anon key — and that key is published in this website's source.
Anyone who views source can therefore reach it. Two rules in
`supabase-setup.sql` are what stop that mattering:

1. **Signup can never choose a role.** The database forces every new account to
   `manager`, ignoring whatever the request asks for. An earlier version read
   the role from the request, which would have let anyone sign themselves up as
   a director and read every booking, phone number and salary figure.
2. **New accounts start with no access** (`active = false`). A Director has to
   switch each one on. So a stranger who signs up gets an inert row, not your
   data.

If you re-run `supabase-setup.sql` on a project that already has staff, check
them afterwards — the trigger only governs accounts created from then on:

```sql
select id, email, role, active from public.profiles order by role;
```

For extra belt and braces, if you would rather create staff only from the
Supabase dashboard, turn signups off at **Authentication → Providers → Email →
"Allow new users to sign up"**. The *Create manager* form stops working, but
nothing else changes.

### Is the anon key safe to publish?

Yes — that is what it is for. It only identifies the project; it grants nothing
on its own. What anyone can actually read or write is decided by the rules in
`supabase-setup.sql`, which allow the public to *create* a booking and nothing
else. Reading bookings, and everything to do with costs and staff, requires a
signed-in account.

**Never put the `service_role` key in the website.** That one does bypass every
rule. It belongs on a server only.

### What it does not cover

* **Payments are still verified in the browser.** Paystack tells the page the
  payment succeeded, and the page records the booking. For a lounge taking
  walk-in volumes that is normally fine. To be certain a booking was genuinely
  paid for, add a Paystack **webhook** pointing at a small server function that
  writes the booking itself. The database is already in place for it.
* **Manager password resets** are not possible from the browser in cloud mode
  (that needs the secret key). Reset them from the Supabase dashboard under
  Authentication → Users, or have the manager use a password reset email.
* **Deleting a manager** revokes their access by disabling the profile, which
  stops them signing in anywhere. Removing the underlying login entirely is
  done in the Supabase dashboard.

### If you skip this

Everything still works, and the console tells you plainly which mode it is in
with a banner at the top of every dashboard: *"This device only."* Passwords
are salted SHA-256 hashes rather than plain text, and *Settings → Export
accounts* moves logins between machines. It is a reasonable way to start — just
do not treat it as protecting anything you would be upset to lose or leak.

---

## Mobile

The site is built mobile-first and tested down to 375px:

- The nav collapses to a full-screen drawer below 1080px.
- On the booking page the summary panel is replaced by a **sticky bar** pinned
  to the bottom of the screen showing the running total and the next action,
  so the price is always visible while scrolling.
- The step indicator scrolls sideways instead of stacking into four lines.
- Form fields are 16px, which stops iOS Safari zooming in when someone taps a
  field, and every tap target is at least 44px.
- Layouts respect the notch and home indicator on modern phones
  (`env(safe-area-inset-*)`).
- Time slots show three columns, dropping to two below 360px.
- In landscape on a short screen the hero shrinks so content is reachable.
- The admin console collapses its sidebar into a slide-over menu below 900px.

Verified with zero horizontal overflow at 320, 360, 390, 430, 768, 1024 and
1440px, and through all six booking steps.

### If a change doesn't show up

The CSS and JS links carry a version string (`style.css?v=9`). Browsers cache
these files hard, so **after editing any file in `assets/`, bump that number in
`index.html`, `book.html` and the three pages in `admin/`** — otherwise you (and
returning visitors) keep seeing the old version.

## Hosting

Any static host works — Netlify, Vercel, Cloudflare Pages, GitHub Pages, or
ordinary cPanel/`public_html` shared hosting. Upload the whole folder,
including `assets/`. Nothing needs Node, PHP or a database.

Paystack requires the live site to be served over **HTTPS**. Every host above
provides that free.

### Preview it locally

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`. (Opening `index.html` by double-clicking
also mostly works, but a local server matches production behaviour.)

---

## What happens after someone pays

Paystack takes the payment and the site shows a booking reference
(`ARENA-XXXXXXXX-XXXX`). The full booking — station, game, date, time, length,
players, phone — is attached to the transaction as Paystack **custom fields**,
so it is all visible on your Paystack dashboard against that payment.

The customer also gets a "Send booking to WhatsApp" button that opens a
pre-filled message to **08067289880**.

**Worth knowing:** this is a front-end-only site, so there is no database and
no double-booking check — two people can pick the same slot. For the volume of
a single lounge that is usually fine, since you see every paid booking on the
Paystack dashboard. When you outgrow it, the next step is a small backend
(a serverless function) to verify payments server-side and hold slots.

---

## Brand reference

Taken from `THE ARENA BRANDING.pdf`. Defined as CSS variables at the top of
`assets/css/style.css`.

| | Colour | Hex |
|---|---|---|
| Core | Orange | `#FC4F15` |
| Core | Arena Black | `#1B1B1D` |
| Core | Cyan | `#20E9F9` |
| Core | Cream | `#FEF4DB` |
| Secondary | Play Yellow | `#FFDE15` |
| Secondary | Electric Blue | `#2424E6` |
| Secondary | Sky Blue | `#B1DFEC` |

**Type:** Satoshi (primary, body) and Poppins (secondary, display headings) —
both loaded from their CDNs, matching the brand book.
