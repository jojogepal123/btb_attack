import os
import base64
import time
import secrets
from pathlib import Path
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
SMTP_APP_NAME = os.getenv("SMTP_APP_NAME", "BTB_ATTACK")

LOGO_PATH = Path(__file__).resolve().parent.parent.parent / "favicon" / "favicon-96x96.png"
_logo_base64 = ""
if LOGO_PATH.exists():
    _logo_base64 = base64.b64encode(LOGO_PATH.read_bytes()).decode()

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


def _build_otp_email_html(otp: str) -> str:
    logo_src = f"data:image/png;base64,{_logo_base64}" if _logo_base64 else ""
    logo_img = f'<img src="{logo_src}" alt="{SMTP_APP_NAME}" width="80" height="80" style="display:block;margin:0 auto;border-radius:16px;" />' if logo_src else ""

    digit_cells = ""
    for i, d in enumerate(otp):
        digit_cells += f'<td style="width:44px;height:52px;text-align:center;font-size:26px;font-weight:700;font-family:\'Courier New\',Courier,monospace;background:#1e293b;color:#22c55e;border:2px solid #334155;border-radius:10px;line-height:52px;">{d}</td>'
        if i < len(otp) - 1:
            digit_cells += '<td style="width:10px;">&nbsp;</td>'

    year = datetime.now(timezone.utc).year

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="background-color:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:48px 40px;text-align:center;">

              {f'<div style="padding-bottom:24px;">{logo_img}</div>' if logo_img else ''}

              <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:3px;text-transform:uppercase;">{SMTP_APP_NAME}</h1>

              <p style="margin:0 0 32px 0;font-size:13px;color:#64748b;letter-spacing:1px;text-transform:uppercase;">Email Verification</p>

              <div style="height:1px;background:linear-gradient(90deg,transparent,#22c55e,transparent);margin-bottom:32px;"></div>

              <p style="margin:0 0 24px 0;font-size:15px;color:#cbd5e1;line-height:1.6;">Your verification code is</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;background:#1a2332;border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:20px 24px;">
                <tr>
                  {digit_cells}
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                This code expires in <strong style="color:#22c55e;">5 minutes</strong>.
              </p>

              <p style="margin:0 0 32px 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Do not share this code with anyone.
              </p>

              <div style="height:1px;background:#1e293b;margin-bottom:24px;"></div>

              <p style="margin:0 0 12px 0;font-size:12px;color:#475569;line-height:1.6;">
                If you didn't request this email, you can safely ignore it.
              </p>
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
                &copy; {year} {SMTP_APP_NAME}. All rights reserved.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_otp_email(email: str, otp: str):
    logger.info("===== OTP for %s: %s =====", email, otp)
    if not SMTP_HOST:
        return

    try:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = f"{SMTP_APP_NAME} - Your Verification Code"
        msg["From"] = f"{SMTP_APP_NAME} <{SMTP_USER}>"
        msg["To"] = email
        msg.set_content(f"Your OTP is: {otp}\nIt expires in 5 minutes.")
        msg.add_alternative(_build_otp_email_html(otp), subtype="html")
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
