# Brand Marketian — CMS & Admin Panel

A content management system and admin panel that lets non-technical team members
edit the website through a simple interface — no GitHub, code, or Cloudflare.

- Public website: `https://brandmarketian.com` (unchanged)
- Admin panel: `https://admin.brandmarketian.com` (new)

This was built **on top of the existing architecture** — the same Node/Express +
MongoDB backend in `server/`, the same `SiteContent`/`Media` models and the
`data-cms` binding already in `frontend/cms.js`. Nothing was rebuilt.

---

## What's in this repository now

```
admin/                 ← NEW: the admin panel (a single static page)
  public/index.html    ← the whole Content Studio app
  public/config.js     ← set your API address here once
  wrangler.jsonc       ← deploys admin.brandmarketian.com
server/                ← existing API, extended (no breaking changes)
  src/models.js        ← SiteContent gains draft/status/versions; 5 user roles
  src/routes/admin.js  ← draft→review→publish, version history, media, users
  src/auth.js          ← role groups (super_admin/admin/editor/designer/viewer)
  src/seed.js          ← first user is now super_admin; seeds global settings
frontend/cms.js        ← unchanged behaviour + a live Preview mode
```

## How the CMS works

The editor edits a **draft**. The public website keeps showing the **published**
version until someone with permission publishes. Every publish also snapshots the
previous version so it can be restored.

```
Login → Pick page → Edit → Save draft → Preview → Submit for review → Approve → Publish
```

| Role | Edit & save draft | Submit | Approve & Publish | Media | Users |
|---|:--:|:--:|:--:|:--:|:--:|
| Super Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | — |
| Content Editor | ✓ | ✓ | — | upload | — |
| Designer | ✓ | ✓ | — | upload | — |
| Viewer | read-only | — | — | view | — |

---

## Deployment (3 parts)

### 1. Backend — redeploy the existing API

The API host and database are unchanged. Pull the updated `server/` and:

```
cd server
npm install
npm run seed        # upgrades the admin user to super_admin, seeds global settings
npm start
```

Set these environment variables on the backend host (see `server/.env.example`):

- `MONGODB_URI`, `JWT_SECRET` — as today.
- `CORS_ORIGIN` — **must now include the admin origin**, e.g.
  `https://brandmarketian.com,https://admin.brandmarketian.com`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the first login. Change the password from
  the panel (Users & Roles) after signing in.

`npm run seed` is safe to re-run; it upserts and does not wipe content.

### 2. Admin panel — new Cloudflare Worker

The admin panel is static (one folder), so it deploys like the website but as its
own Worker.

1. Edit `admin/public/config.js` and set your API address:
   ```js
   window.BM_CONFIG = { api: 'https://api.brandmarketian.com', siteOrigin: 'https://brandmarketian.com' };
   ```
2. Deploy:
   ```
   cd admin
   npx wrangler deploy
   ```
3. In the Cloudflare dashboard open the **brand-marketian-admin** Worker →
   *Settings → Domains & Routes* → add the custom domain
   `admin.brandmarketian.com`. (DNS is already on Cloudflare, so this is a click.)

> Prefer Cloudflare Pages? Point a Pages project at this repo with output
> directory `admin/public` and no build command — same result.

### 3. Frontend — point it at the API (one line, if not already done)

So the published content loads on the live site, set the API address on the
website pages. In each page's `<head>` the meta is currently empty:

```html
<meta name="bm-api" content="" />           <!-- becomes -->
<meta name="bm-api" content="https://api.brandmarketian.com" />
```

`cms.js` already reads this and falls back to the copy written in the HTML if the
API is unreachable, so the site can never break. Text wired with `data-cms`
(currently the home page) updates from the CMS; other pages can be wired the same
way over time (see below).

---

## First run checklist

1. Backend redeployed, `npm run seed` run, `CORS_ORIGIN` includes the admin domain.
2. `admin.brandmarketian.com` opens the login screen.
3. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. Open **Home → Hero**, change the heading, **Save draft**, **Preview**
   (opens the live page with your draft applied), then **Publish**.
5. Confirm the change on `brandmarketian.com`.
6. Add your teammates under **Users & Roles** with the right role.

---

## Scope of this first version

Delivered: the full editing loop (login → edit → draft → preview → submit →
approve → publish), version history + restore, media library, five roles with
permissions, global settings and SEO fields per page, and the admin subdomain.
The **home page** is fully wired end-to-end; other pages appear in the panel with
their sections ready.

Next iterations (kept intentionally small for v1):

- Bind more `data-cms` fields across services/pricing/etc. so their text and
  cards render from the CMS (the panel side is already built for them).
- Render CMS-managed **images/cards/lists** on the public pages (v1 focuses on
  text; the data is already stored and editable).
- Apply per-page **SEO** fields to the live `<title>`/meta tags at build/serve time.

Each of these is additive and does not change what already works.
