# instagram-svc

Real Instagram data for the influencer lookup tool, via
[`instagrapi`](https://github.com/subzeroid/instagrapi). It logs in once with a
**throwaway** Instagram account, keeps the session on disk, and answers one call:

```
GET /profile/<handle>   ->  followers, engagement, top post   (real numbers)
GET /health
```

The Node API (`server/`, `CREATOR_PROVIDER=instagrapi`) calls this, normalises
the result, caches each handle for 24h, and **falls back to sample data if this
service is unreachable** — so a login hiccup here never breaks the website.

---

## Why an account is required

Instagram blocks every logged-out data endpoint now (`web_profile_info` → HTTP
429, profile HTML → empty shell). `instagrapi` works **only because it is logged
in**. No account = no real data. That is a platform limitation, not a code one.

## Setup (local)

```bash
cd server/instagram-svc
python -m venv .venv && . .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Now give it a login — **one** of these, in `.env`:

**A. sessionid cookie (recommended — no password, no challenge)**
1. Log into `instagram.com` in a browser as a **throwaway** account.
2. F12 → Application/Storage → Cookies → `https://www.instagram.com`.
3. Copy the value of the **`sessionid`** cookie into `IG_SESSIONID=` in `.env`.

**B. username + password** — set `IG_USERNAME` / `IG_PASSWORD` instead. The first
login often triggers a "Was this you?" challenge you must clear once in a
browser, then restart the service.

Then run it:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env
```

Watch the log for `logged in as ...`. Check it:

```bash
curl -s http://127.0.0.1:8000/health      # -> "logged_in": true
curl -s http://127.0.0.1:8000/profile/nasa
```

`/health` reports `auth_configured`, `auth_method`, and `last_error` so you can
see exactly why it is not logged in.

## Wire it to the Node API

In `server/.env` (or the host's env):

```
CREATOR_PROVIDER=instagrapi
INSTAGRAM_SVC_URL=http://127.0.0.1:8000
INSTAGRAM_SVC_TOKEN=        # only if you set SVC_TOKEN in this service's .env
```

Restart the Node server. Every handle typed into the lookup tool now returns
real data (served from cache for 24h after the first fetch).

## Keeping the account alive

- **Run from a home IP** if you can — datacenter IPs get challenged fast. On a
  VPS, set `IG_PROXY` to a residential/mobile proxy.
- Don't raise `IG_MEDIA_COUNT` or hammer it — the 24h Node cache keeps volume
  tiny by design.
- The account **will** eventually get checkpointed. When it does: create a new
  throwaway account, update `IG_USERNAME` / `IG_PASSWORD`, delete `session.json`,
  restart. Nothing else changes.

## Files

| File | Purpose |
|---|---|
| `main.py` | the FastAPI service |
| `requirements.txt` | `instagrapi`, `fastapi`, `uvicorn` |
| `.env.example` | copy to `.env` |
| `session.json` | created at runtime — the saved login (git-ignored) |
