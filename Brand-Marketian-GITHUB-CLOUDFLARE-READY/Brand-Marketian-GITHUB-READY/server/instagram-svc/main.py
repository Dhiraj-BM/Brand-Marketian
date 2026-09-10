"""Brand Marketian — Instagram data microservice.

A tiny HTTP wrapper around `instagrapi` (https://github.com/subzeroid/instagrapi).
It logs in ONCE with a real (throwaway) Instagram account, persists the session
to disk, and exposes a single read endpoint the Node API calls:

    GET /profile/<handle>   -> real followers / engagement / top post

The Node side (server/src/creator.js, provider "instagrapi") normalises this
into the shape the website renders, caches it for 24h, and falls back to sample
data if this service is down — so a login problem here never breaks the page.

Run:
    pip install -r requirements.txt
    cp .env.example .env   &&   edit IG_USERNAME / IG_PASSWORD
    uvicorn main:app --host 127.0.0.1 --port 8000

Environment (see .env.example) — you need IG_SESSIONID *or* IG_USERNAME+IG_PASSWORD:
    IG_SESSIONID      preferred — `sessionid` cookie from a logged-in browser
    IG_USERNAME       fallback  — the throwaway account's username
    IG_PASSWORD       fallback  — its password
    IG_PROXY          optional  — http://user:pass@host:port (recommended on a VPS)
    IG_SESSION_FILE   optional  — where to persist the login (default: session.json)
    IG_MEDIA_COUNT    optional  — recent posts to sample for engagement (default: 12)
    SVC_TOKEN         optional  — shared secret; if set, callers must send it as
                                  the  x-svc-token  header
"""
from __future__ import annotations

import logging
import os
import threading
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired,
    ClientError,
    LoginRequired,
    PleaseWaitFewMinutes,
    UserNotFound,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("instagram-svc")

IG_SESSIONID = os.environ.get("IG_SESSIONID", "").strip()
IG_USERNAME = os.environ.get("IG_USERNAME", "").strip()
IG_PASSWORD = os.environ.get("IG_PASSWORD", "")
IG_PROXY = os.environ.get("IG_PROXY", "").strip()
SVC_TOKEN = os.environ.get("SVC_TOKEN", "").strip()
SESSION_FILE = Path(os.environ.get("IG_SESSION_FILE", "session.json"))
MEDIA_COUNT = int(os.environ.get("IG_MEDIA_COUNT", "12"))

app = FastAPI(title="brand-marketian instagram-svc", version="1.1.0")

# instagrapi's Client is NOT thread-safe and FastAPI serves sync endpoints from a
# threadpool, so every Instagram call goes through this one lock. Fine at the low
# request volume this tool sees (and the Node side caches each handle for 24h).
_client: Client | None = None
_lock = threading.Lock()
_last_error: str | None = None  # why the last login attempt failed (shown by /health)


def _authenticate(cl: Client) -> str:
    """Log `cl` in. Prefer a browser sessionid (no challenge); fall back to
    username + password. Returns the method used ("sessionid" | "password").
    Raises RuntimeError if neither is configured/usable."""
    if IG_SESSIONID:
        try:
            cl.login_by_sessionid(IG_SESSIONID)
            log.info("authenticated via IG_SESSIONID")
            return "sessionid"
        except Exception as exc:
            log.warning("IG_SESSIONID rejected (%s) — trying username/password", exc)
    if IG_USERNAME and IG_PASSWORD:
        cl.login(IG_USERNAME, IG_PASSWORD)
        log.info("authenticated via IG_USERNAME/IG_PASSWORD")
        return "password"
    raise RuntimeError(
        "no usable Instagram auth — set IG_SESSIONID (preferred) or "
        "IG_USERNAME + IG_PASSWORD in server/instagram-svc/.env"
    )


def _build_client() -> Client:
    global _last_error
    cl = Client()
    cl.delay_range = [2, 5]  # random pause between requests — looks less robotic
    if IG_PROXY:
        cl.set_proxy(IG_PROXY)

    # Reuse a saved session first — re-authenticating is what tends to trip a ban.
    if SESSION_FILE.exists():
        try:
            cl.load_settings(SESSION_FILE)
            log.info("loaded saved session from %s", SESSION_FILE)
        except Exception as exc:  # corrupt / old format — start fresh
            log.warning("could not load session (%s) — logging in fresh", exc)

    try:
        method = _authenticate(cl)
        # For a password login, verify with the timeline feed and re-auth once if
        # the saved session was stale. Do NOT do this for a sessionid login:
        # `login_by_sessionid` already validates by fetching the account's own
        # profile, and `feed/timeline/` returns 403 for browser-origin cookies
        # even when profile/media endpoints work fine — the check would wrongly
        # tear down a perfectly good session.
        if method == "password":
            try:
                cl.get_timeline_feed()
            except LoginRequired:
                log.info("saved session stale — re-authenticating")
                uuids = cl.get_settings().get("uuids", {})
                cl.set_settings({})
                cl.set_uuids(uuids)
                _authenticate(cl)
    except Exception as exc:
        _last_error = f"{type(exc).__name__}: {exc}"
        raise

    cl.dump_settings(SESSION_FILE)
    _last_error = None
    log.info("logged in as %s; session saved to %s", IG_USERNAME or "(sessionid)", SESSION_FILE)
    return cl


def _get_client() -> Client:
    global _client
    with _lock:
        if _client is None:
            _client = _build_client()
        return _client


def _reset_client() -> None:
    global _client
    with _lock:
        _client = None


@app.on_event("startup")
def _startup() -> None:
    # Log in at boot so credential / challenge problems surface immediately
    # instead of on the first user lookup. A failure here is non-fatal — the
    # endpoint will retry, and Node falls back to sample data meanwhile.
    try:
        _get_client()
    except Exception as exc:
        log.error("startup login failed: %s", exc)


@app.get("/health")
def health() -> dict:
    auth_configured = bool(IG_SESSIONID or (IG_USERNAME and IG_PASSWORD))
    return {
        "ok": _client is not None,
        "logged_in": _client is not None,
        "auth_configured": auth_configured,
        "auth_method": "sessionid" if IG_SESSIONID else ("password" if IG_USERNAME else None),
        "account": IG_USERNAME or None,
        "last_error": _last_error,
    }


def _str(value) -> str | None:
    return str(value) if value is not None else None


@app.get("/profile/{handle}")
def profile(handle: str, x_svc_token: str = Header(default="")) -> dict:
    if SVC_TOKEN and x_svc_token != SVC_TOKEN:
        raise HTTPException(status_code=401, detail="bad or missing x-svc-token")

    handle = handle.lstrip("@").strip().lower()
    if not handle:
        raise HTTPException(status_code=400, detail="empty handle")

    try:
        cl = _get_client()
        user = cl.user_info_by_username(handle)
    except HTTPException:
        raise
    except RuntimeError as exc:
        # No auth configured / not logged in — the operator must fix .env.
        raise HTTPException(status_code=503, detail=str(exc))
    except UserNotFound:
        raise HTTPException(status_code=404, detail="handle not found")
    except ChallengeRequired:
        _reset_client()
        raise HTTPException(
            status_code=502,
            detail="Instagram wants to verify this account — log in once manually, "
            "solve the challenge, then restart this service (or swap the account).",
        )
    except LoginRequired:
        _reset_client()
        raise HTTPException(status_code=502, detail="login required — will retry on next call")
    except PleaseWaitFewMinutes as exc:
        raise HTTPException(status_code=429, detail=f"rate-limited by Instagram: {exc}")
    except ClientError as exc:
        raise HTTPException(status_code=502, detail=f"instagram error: {exc}")
    except Exception as exc:  # noqa: BLE001 — last resort, keep the service answering
        _reset_client()
        raise HTTPException(status_code=502, detail=f"{type(exc).__name__}: {exc}")

    uid = user.pk

    medias = []
    try:
        with _lock:
            medias = _get_client().user_medias(uid, amount=MEDIA_COUNT)
    except Exception as exc:
        # Recent posts are a bonus — a failed media call must not sink the profile.
        log.warning("user_medias failed for @%s: %s", handle, exc)

    likes = [m.like_count for m in medias if m.like_count is not None]
    comments = [m.comment_count for m in medias if m.comment_count is not None]
    avg_likes = sum(likes) / len(likes) if likes else None
    avg_comments = sum(comments) / len(comments) if comments else None

    best = None
    best_score = -1
    for m in medias:
        views = (m.play_count or getattr(m, "view_count", None) or 0)
        # Rank reels by plays; rank photos (no play count) by likes instead.
        score = views if views else (m.like_count or 0)
        if score > best_score:
            best_score = score
            best = m

    avg_views = None
    if medias:
        vlist = [m.play_count for m in medias if m.play_count]
        avg_views = sum(vlist) / len(vlist) if vlist else None

    out = {
        "username": user.username,
        "full_name": user.full_name or user.username,
        "profile_pic_url": _str(user.profile_pic_url_hd) or _str(user.profile_pic_url),
        "category": user.category_name or getattr(user, "business_category_name", None),
        "follower_count": user.follower_count,
        "following_count": user.following_count,
        "media_count": user.media_count,
        "is_verified": user.is_verified,
        "is_private": user.is_private,
        "biography": user.biography or None,
        "avg_likes": avg_likes,
        "avg_comments": avg_comments,
        "avg_views": avg_views,
        "sampled_posts": len(medias),
        "top": None,
    }
    if best is not None:
        out["top"] = {
            "caption": (best.caption_text or "").strip() or None,
            "thumbnail_url": _str(best.thumbnail_url),
            "views": best.play_count or getattr(best, "view_count", None) or None,
            "likes": best.like_count,
            "comments": best.comment_count,
            "taken_at": best.taken_at.isoformat() if best.taken_at else None,
        }
    return out
