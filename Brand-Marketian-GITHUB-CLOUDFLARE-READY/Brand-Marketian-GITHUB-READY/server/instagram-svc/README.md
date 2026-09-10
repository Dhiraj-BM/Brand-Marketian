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
# edit .env  ->  IG_USERNAME, IG_PASSWORD  (a NEW throwaway account)

uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env
```

First boot logs in and writes `session.json`. Watch the log for
`logged in as @...`. If you see `ChallengeRequired`, open Instagram in a browser
as that account, clear the "Was this you?" prompt, then start the service again.

Quick check:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/profile/nasa | python -m json.tool
```

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
