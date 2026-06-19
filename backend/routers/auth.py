import os
import time
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from deps import ALGORITHM, SECRET_KEY, get_current_user, get_db, hash_otp, verify_otp_hash, logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() in {"1", "true", "yes"}
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
ACCESS_TOKEN_REMEMBER_MINUTES = 30 * 24 * 60
OTP_EXPIRE_SECONDS = 300
OTP_SESSION_EXPIRE_HOURS = 12
MIN_PASSWORD_LENGTH = 8

_login_attempts: dict[str, list[float]] = defaultdict(list)
_otp_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 10
_MAX_OTP_ATTEMPTS = 10
_RATE_WINDOW = 300


def _is_rate_limited(store: dict, key: str) -> bool:
    now = time.time()
    entries = store[key]
    store[key] = [t for t in entries if now - t < _RATE_WINDOW]
    if len(store[key]) >= _MAX_LOGIN_ATTEMPTS:
        return True
    store[key].append(now)
    return False


def _check_password_strength(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password too short (min {MIN_PASSWORD_LENGTH} chars)"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one digit"
    return None


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


class LogoutRequest(BaseModel):
    token: str


def create_token(email: str, remember: bool = False) -> str:
    minutes = ACCESS_TOKEN_REMEMBER_MINUTES if remember else ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    from jose import jwt
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def generate_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


async def send_otp_email(email: str, otp: str):
    logger.info("===== OTP for %s: %s =====", email, otp)
    if not SMTP_HOST:
        return

    try:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = "2FA Email Bypass - your verification code"
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
        logger.info("OTP also emailed to %s", email)
    except Exception as exc:
        logger.warning("SMTP failed: %s", exc)


def _otp_is_expired(user: dict) -> bool:
    sent_at = user.get("otp_sent_at")
    if not sent_at:
        return True
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - sent_at > timedelta(seconds=OTP_EXPIRE_SECONDS)


def _otp_session_is_valid(user: dict) -> bool:
    verified_at = user.get("otp_verified_at")
    if not verified_at:
        return False
    if verified_at.tzinfo is None:
        verified_at = verified_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - verified_at < timedelta(hours=OTP_SESSION_EXPIRE_HOURS)


@router.post("/register")
async def register(body: RegisterRequest):
    db = get_db()
    if not ALLOW_REGISTER:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    pw_error = _check_password_strength(body.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    import bcrypt
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    otp = generate_otp()
    otp_h = hash_otp(otp)
    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "name": body.name,
        "email": body.email,
        "password": hashed,
        "verified": False,
        "otp": otp_h,
        "otp_sent_at": now,
        "otp_verified_at": None,
    })
    await send_otp_email(body.email, otp)
    return {"message": "OTP sent to email"}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if _is_rate_limited(_otp_attempts, body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    stored_otp = user.get("otp", "")
    if not stored_otp or not verify_otp_hash(body.otp, stored_otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if _otp_is_expired(user):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new code.")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"email": body.email},
        {
            "$set": {
                "verified": True,
                "otp_verified_at": now,
            },
            "$unset": {"otp": "", "otp_sent_at": ""},
        },
    )
    _otp_attempts.pop(body.email, None)

    token = create_token(body.email)
    user_data = await db.users.find_one({"email": body.email}, {"name": 1, "email": 1})
    return {"token": token, "email": body.email, "name": user_data["name"]}


@router.post("/resend-otp")
async def resend_otp(body: ResendOtpRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    if _is_rate_limited(_otp_attempts, body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    otp = generate_otp()
    otp_h = hash_otp(otp)
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp_h, "otp_sent_at": now}},
    )
    await send_otp_email(body.email, otp)
    return {"message": "OTP resent", "otp_sent_at": now.isoformat()}


@router.post("/login")
async def login(body: LoginRequest):
    db = get_db()

    if _is_rate_limited(_login_attempts, body.email):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    import bcrypt
    try:
        valid = bcrypt.checkpw(body.password.encode(), user["password"].encode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _login_attempts.pop(body.email, None)

    if _otp_session_is_valid(user):
        token = create_token(body.email)
        return {"token": token, "email": body.email, "name": user["name"]}

    otp = generate_otp()
    otp_h = hash_otp(otp)
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp_h, "otp_sent_at": now}},
    )
    await send_otp_email(body.email, otp)
    raise HTTPException(status_code=403, detail="OTP verification required. A code has been sent to your email.")


@router.post("/login-remember")
async def login_remember(body: LoginRequest):
    """Login with extended token expiry (30 days)."""
    db = get_db()

    if _is_rate_limited(_login_attempts, body.email):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    import bcrypt
    try:
        valid = bcrypt.checkpw(body.password.encode(), user["password"].encode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _login_attempts.pop(body.email, None)

    if _otp_session_is_valid(user):
        token = create_token(body.email, remember=True)
        return {"token": token, "email": body.email, "name": user["name"]}

    otp = generate_otp()
    otp_h = hash_otp(otp)
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp_h, "otp_sent_at": now}},
    )
    await send_otp_email(body.email, otp)
    raise HTTPException(status_code=403, detail="OTP verification required. A code has been sent to your email.")


@router.get("/verify")
async def verify(email: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"email": email}, {"name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"valid": True, "email": user["email"], "name": user["name"]}


@router.post("/logout")
async def logout(body: LogoutRequest, email: str = Depends(get_current_user)):
    db = get_db()
    try:
        from jose import jwt as _jwt
        payload = _jwt.decode(body.token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        exp = payload.get("exp")
        if exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            ttl = max(int((expires_at - datetime.now(timezone.utc)).total_seconds()), 1)
        else:
            ttl = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    except Exception:
        ttl = ACCESS_TOKEN_EXPIRE_MINUTES * 60

    await db.token_blacklist.insert_one({
        "token": body.token,
        "blacklisted_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl),
    })

    await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)

    logger.info("%s logged out", email)
    return {"message": "Logged out"}
