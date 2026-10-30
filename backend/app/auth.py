from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import Login, Register, TokenResponse, UserResponse
from app.security import DUMMY_HASH, current_user, issue_token, passwords

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: Register, db: Session = Depends(get_db)):
    if db.query(User).filter((User.email == str(data.email)) | (User.username == data.username)).first():
        raise HTTPException(409, "Email or username already registered")
    user = User(username=data.username, email=str(data.email), hashed_password=passwords.hash(data.password), role="customer")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email or username already registered") from None
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: Login, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(data.email)).first()
    if not passwords.verify(data.password, user.hashed_password if user else DUMMY_HASH) or user is None:
        raise HTTPException(401, "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    token, expires = issue_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return user
