# Admin Guide — Editing Your Church Website

This guide is for church staff. You do **not** need to be technical. Everything on the public
website can be changed from the admin area — text, photos, sermons, events, giving, and more.

> **The golden rules**
> - Most changes go live the moment you click **Save**.
> - Sermons, events, and ministries only appear on the public site when you mark them
>   **Published**. Drafts stay hidden.
> - In the page-text editor, **clearing a box and saving restores the original wording** — you
>   can't break a page by emptying a field.

---

## Signing in

1. Go to **`https://your-site/admin`**.
2. You'll be sent to a secure sign-in page. Enter your church email address.
3. You'll receive a **one-time code** by email — type it in. That's it.

Only email addresses your administrator has approved can get in. If you're denied, ask your
administrator to add your email.

---

## The dashboard

The first screen (`/admin`) shows counts (sermons, events, ministries, visitors) and a sidebar
menu with every section below. Click any item to manage it.

---

## Editing page words ("Content")

**Admin → Content.** Pick a page (Home, About, Visit, or Other Pages). You'll see labelled boxes
grouped by section — headline, paragraphs, button labels, scripture, and so on.

- Type your changes and click **Save**.
- **To restore the original text**, clear the box and save — the default comes back.
- The **gathering schedule** box on the Home page controls the live countdown and the live page's
  schedule. It uses a small structured format; edit the times carefully and keep the surrounding
  brackets/quotes intact.

### Changing page photos

On the same Content pages, image slots show a preview with a **Choose file** button. Pick a photo
from your computer and Save — it uploads and replaces the placeholder.

- Accepted: **JPG, PNG, WebP, AVIF, GIF**, up to **6 MB**.
- Use good-quality, landscape photos for hero/banner slots and portraits for people.
- Saving text never erases an image, and choosing a new image never erases text.

---

## Lists with photos

These are managed as simple lists — **Add**, edit, reorder (sort order), or delete:

- **Leadership** — pastors/leaders shown on the About page (name, role, photo).
- **Journey / Story** — the timeline of milestones on the About page (year, title, text, photo).
- **Home Cards** — the three highlight cards on the home page (eyebrow, title, description, link).

Empty lists simply hide their section on the public site, so it's fine to start with none and add
as you go.

---

## Sermons

**Admin → Sermons.**

1. **Add a sermon.** Fill in title, speaker, date, series, and scripture.
2. **Video:** paste the **YouTube or Vimeo link** — the site embeds the player automatically. (No
   video files are uploaded; the video lives on YouTube/Vimeo.)
3. **Transcript (optional):** pasting the sermon transcript powers the AI **study guide** and
   improves search. You can leave it blank.
4. **Thumbnail/image (optional):** upload a cover image, or a placeholder is used.
5. Tick **Published** to show it on the public site.

**AI search:** if you change or add many sermons, click **"Reindex AI search"** on the Sermons page
once. This refreshes the smart search on the public sermons page. (AI features only work on the
live site, not in local previews.)

---

## Events

**Admin → Events.**

1. **Add an event** with title, date/time, location, category, and description.
2. **Registration:** turn on **"Registration enabled"** to let people sign up. Set a **capacity**
   (leave blank for unlimited) — the form stops accepting sign-ups once it's full.
3. Tick **Published** to show it.
4. **See who registered:** open an event and view its registrations; you can **export a CSV** for
   your records.
5. **Spots left:** when registration has a capacity, the event page shows a live **"N spots left"**
   count, then a "full" message once it fills.
6. **Add to calendar:** every event page automatically offers an **Add to calendar** button —
   an `.ics` download (Apple/Outlook/everything) plus a **Google Calendar** link. Nothing to set up.

Past events drop off the public list automatically once their date passes.

---

## Ministries

**Admin → Ministries.** Add/edit each ministry (name, description, leader, meeting time, photo) and
tick **Published**. The order is controlled by the sort-order field.

---

## Community & Care

> These sections appear only when the **community** features are switched on for your site. They
> power the **Prayer wall**, **Next Steps**, **Find a Group**, and **Serve** pages, plus their
> follow-up lists. Every follow-up list works the same way: mark each entry **Contacted** or
> **Done**, or **Delete** it once handled.

### Prayer wall

**Admin → Prayer.** Every request submitted from the public **Prayer wall** lands here. You decide
what's visible: approve a request to show it **publicly and anonymously** on the wall, keep it
**private** for the prayer team, or **delete** it. Visitors can tap **"I prayed"** on public
requests, and the count is shown.

### Next steps (Connect)

**Admin → Connect.** Submissions from the **Next Steps** page — someone choosing "I'm new here",
"I'd like to be baptized", "I want to serve", and so on. Follow each one up and mark it
**Contacted**/**Done**.

### Groups

**Admin → Groups** manages the cards on the public **Find a Group** page; **Admin → Group Signups**
is the follow-up list.

1. **Add a group** with name, leader, day, time, location, **format** (in person / online / hybrid),
   **audience** (everyone, men, women, youth…), description, and a photo. Tick **Published** to show it.
2. People browse and filter groups on the **/groups** page and tap **"I'm interested"**.
3. Their interest appears under **Group Signups** — pass each to the group's leader.

### Serving (volunteers)

**Admin → Serve Roles** manages the public **Serve** opportunity board; **Admin → Serve Signups** is
the follow-up list.

1. **Add a role** with name, **area** (Kids, Worship, Hospitality, Media…), **commitment** (one-time
   / weekly / monthly / as-needed), a free-text **schedule**, optional **requirements** (e.g.
   "Background check required"), team lead, description, and a photo. Tick **Published**.
2. People browse and filter roles on the **/serve** page and tap **"I want to serve"**.
3. Their signup appears under **Serve Signups** — pass each to the team lead.

---

## People (visitors & contacts)

**Admin → People.** Everyone who submits the **Plan a Visit** form is listed here so you can follow
up. This is view-only. (Prayer, connect, group, and serving submissions each have their own section
under **Community & Care** above.)

---

## Giving (online donations)

> Online giving is **off until set up**. It needs a Paystack account and keys — see the one-time
> setup at the end of this section. Once enabled, congregants can give from the **Give** page.

- **Admin → Funds.** Create the funds people can give to (e.g. *Tithe*, *Offering*, *Building*,
  *Missions*). Mark a fund **active** to show it on the Give page.
- **Admin → Giving.** See all donations and totals per fund, and **export a CSV**.
- **Admin → Recurring.** See active recurring gifts (weekly/monthly/annually). You can **cancel** a
  subscription here, which also cancels it at Paystack.

**One-time giving setup (administrator):**
1. Create a Paystack account and get your **public** and **secret** keys.
2. Set the secret key on the server: `wrangler secret put PAYSTACK_SECRET_KEY`.
3. In **Admin → Settings**, set `paystack_public_key`, `currency`, and `giving_enabled` to `true`.
4. In the Paystack dashboard, set the webhook URL to `https://your-site/api/webhooks/paystack`.
5. Make a small test gift before announcing it.

---

## The live / online service page

**Admin → Live.** Controls the **Watch** page:

- **State:** *Auto* (live during your scheduled service window), *Live* (force on now), or *Off*.
- **Stream URL:** the YouTube/Vimeo/Facebook live link to embed.
- Duration, timezone offset, live-chat toggle, connect-card toggle, and a **bulletin** message.
- When offline, the page shows a countdown to the next gathering plus the latest sermon.

The schedule it counts down to comes from the **gathering schedule** on the Home content page.

---

## Settings

**Admin → Settings.** Site-wide values: contact email, phone, address, **service times**, social
links, the spam-protection (**Turnstile**) site key, and the giving keys/flags above. Service times
appear in the footer and on the Visit page.

**Spam protection (administrator):** the visit, registration, and giving forms use Cloudflare
Turnstile. Create a Turnstile widget for your site's address, run
`wrangler secret put TURNSTILE_SECRET_KEY`, and paste the widget's **site key** into Settings
(`turnstile_site_key`).

---

## Frequently asked

- **I changed something but don't see it.** Make sure you clicked **Save**, and that the item is
  **Published**. Refresh the public page.
- **I want the original wording back.** Clear the text box and Save.
- **A photo won't upload.** Check it's under 6 MB and a JPG/PNG/WebP/AVIF/GIF.
- **The website name/logo is wrong.** Those come from the site configuration; ask your administrator
  (it's set once in `src/config/church.ts`).
- **I'm locked out of admin.** Ask your administrator to approve your email in Cloudflare Access.
