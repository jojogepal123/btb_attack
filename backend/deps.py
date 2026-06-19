import os
import hmac
import logging
import secrets
from typing import Optional

from fastapi import Header, HTTPException
from jose import jwt, JWTError

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

client = None
db = None


def get_db():
    global client, db
    return db


def set_db(new_client, new_db):
    global client, db
    client = new_client
    db = new_db


SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning(
        "SECRET_KEY is not set; using an ephemeral key. "
        "Sessions will reset on restart. Set SECRET_KEY in your environment."
    )

ALGORITHM = "HS256"


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    if db is not None:
        blacklisted = await db.token_blacklist.find_one({"token": token})
        if blacklisted:
            raise HTTPException(status_code=401, detail="Token has been revoked")

    return email


def verify_otp_hash(otp: str, otp_hash: str) -> bool:
    """Timing-safe comparison of OTP against its bcrypt hash."""
    import bcrypt
    return bcrypt.checkpw(otp.encode(), otp_hash.encode())


def hash_otp(otp: str) -> str:
    """Hash an OTP with bcrypt for secure storage."""
    import bcrypt
    return bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()
