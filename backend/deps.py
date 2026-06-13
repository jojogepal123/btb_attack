import os
import logging
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
    import secrets as _secrets
    SECRET_KEY = _secrets.token_urlsafe(32)
    logger.warning("SECRET_KEY is not set; using an ephemeral key. Sessions will reset on restart.")

ALGORITHM = "HS256"


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
