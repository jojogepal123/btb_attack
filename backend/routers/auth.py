import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel

from deps import ALGORITHM, SECRET_KEY, get_current_user, get_db, logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() in {"1", "true", "yes"}
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
MIN_PASSWORD_LENGTH = 8

pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


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


def create_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
        msg["Subject"] = "BTB Attack - your verification code"
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


@router.post("/register")
async def register(body: RegisterRequest):
    db = get_db()
    if not ALLOW_REGISTER:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password too short (min {MIN_PASSWORD_LENGTH} chars)")

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


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("verified"):
        raise HTTPException(status_code=400, detail="Already verified")
    if user.get("otp") != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if user.get("otp_expires") and user["otp_expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    await db.users.update_one(
        {"email": body.email},
        {"$set": {"verified": True}, "$unset": {"otp": "", "otp_expires": ""}},
    )
    token = create_token(body.email)
    user_data = await db.users.find_one({"email": body.email}, {"name": 1, "email": 1})
    return {"token": token, "email": body.email, "name": user_data["name"]}


@router.post("/resend-otp")
async def resend_otp(body: VerifyOtpRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("verified"):
        return {"message": "Already verified"}

    otp = generate_otp()
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp, "otp_expires": datetime.now(timezone.utc) + timedelta(minutes=5)}},
    )
    await send_otp_email(body.email, otp)
    return {"message": "OTP resent"}


@router.post("/re-verify")
async def re_verify(body: VerifyOtpRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("verified"):
        return {"message": "User not verified yet"}

    otp = generate_otp()
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"otp": otp, "otp_expires": datetime.now(timezone.utc) + timedelta(minutes=5)}},
    )
    await send_otp_email(body.email, otp)
    return {"message": "OTP sent for re-verification"}


@router.post("/login")
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or not pwd_ctx.verify(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("verified"):
        if user.get("otp_expires") and user["otp_expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            otp = generate_otp()
            await db.users.update_one(
                {"email": body.email},
                {"$set": {"otp": otp, "otp_expires": datetime.now(timezone.utc) + timedelta(minutes=5)}},
            )
            await send_otp_email(body.email, otp)
            raise HTTPException(status_code=403, detail="OTP expired. New OTP sent to your email.")
        raise HTTPException(status_code=403, detail="Email not verified")

    token = create_token(body.email)
    return {"token": token, "email": body.email, "name": user["name"]}


@router.get("/verify")
async def verify(email: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"email": email}, {"name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"valid": True, "email": user["email"], "name": user["name"]}
