import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")
DUMMY_HASH = passwords.hash("dummy-password-for-missing-user")
bearer = HTTPBearer(auto_error=False)


def settings():
    secret = os.getenv("JWT_SECRET", "")
    if len(secret.encode()) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 bytes")
    minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    if minutes <= 0:
        raise RuntimeError("JWT_EXPIRE_MINUTES must be positive")
    return secret, minutes


def issue_token(user_id: int):
    secret, minutes = settings()
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=minutes),
              "iss": "myshop-auth", "aud": "myshop"}
    return jwt.encode(claims, secret, algorithm="HS256"), minutes * 60


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    unauthorized = HTTPException(401, "Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, settings()[0], algorithms=["HS256"],
                             issuer="myshop-auth", audience="myshop",
                             options={"require_sub": True, "require_exp": True, "require_iat": True})
        user_id = int(payload["sub"])
        if user_id < 1 or user_id > 2**31 - 1:
            raise ValueError("Invalid ID")
    except (JWTError, ValueError, TypeError, KeyError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def admin_user(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin permission required")
    return user
