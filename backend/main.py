import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Dict, Optional
import asyncio
import logging
import subprocess

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

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

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
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
        f"jlesage/firefox"
    ),
}

# --- Auth models ---

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class RemoveRequest(BaseModel):
    name: str

# --- MongoDB setup ---

@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.btb_attack
    await db.users.create_index("username", unique=True)
    logger.info(f"Connected to MongoDB at {MONGO_URL}")

@app.on_event("shutdown")
async def shutdown():
    if client:
        client.close()

# --- Auth helpers ---

def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- Auth endpoints ---

@app.post("/api/auth/register")
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"username": body.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = pwd_ctx.hash(body.password)
    await db.users.insert_one({"username": body.username, "password": hashed})
    token = create_token(body.username)
    return {"token": token, "username": body.username}

@app.post("/api/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"username": body.username})
    if not user or not pwd_ctx.verify(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.username)
    return {"token": token, "username": body.username}

@app.get("/api/auth/verify")
async def verify(username: str = Depends(get_current_user)):
    return {"valid": True, "user": username}

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
async def deploy_server(username: str = Depends(get_current_user)):
    logger.info(f"{username} ran deploy")
    return await run_shell(COMMANDS["deploy"])

@app.get("/api/configure")
async def configure(username: str = Depends(get_current_user)):
    logger.info(f"{username} ran configure")
    return await run_shell(COMMANDS["configure"])

@app.get("/api/launch")
async def launch(username: str = Depends(get_current_user)):
    logger.info(f"{username} ran launch")
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
async def get_logs(username: str = Depends(get_current_user), lines: int = Query(50, le=500)):
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
    except FileNotFoundError:
        return {"status": "success", "message": "(no log file yet)"}
    tail = all_lines[-lines:]
    return {"status": "success", "message": "".join(tail).rstrip()}

@app.get("/api/containers")
async def list_containers(username: str = Depends(get_current_user)):
    result = await run_shell(f"{docker_prefix}docker ps --format '{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}'")
    if result["status"] == "error":
        return {"containers": []}
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
async def remove_container(body: RemoveRequest, username: str = Depends(get_current_user)):
    return await run_shell(f"{docker_prefix}docker rm -f {body.name}")

@app.get("/api/health")
async def health():
    return {"status": "ok"}
