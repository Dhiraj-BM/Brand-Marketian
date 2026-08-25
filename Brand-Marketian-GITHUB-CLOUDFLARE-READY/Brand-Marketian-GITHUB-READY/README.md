# Brand Marketian

Production-ready repository for Brand Marketian.

## Structure

- `frontend/` — public website and all website assets
- `server/` — Node/Express API for leads, CMS and admin features
- `wrangler.jsonc` — Cloudflare Workers Static Assets configuration

## Cloudflare deployment

The Cloudflare Worker serves **only `frontend/`**. The backend is intentionally kept outside the public asset directory.

Cloudflare build settings:

- Build command: leave empty / None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The repository must contain `wrangler.jsonc` at its root.

## Backend

The Node/Express backend in `server/` is separate from the static Cloudflare deployment. Copy `server/.env.example` to `.env` on the backend host and set real production credentials there. Never commit `.env` or secrets.
