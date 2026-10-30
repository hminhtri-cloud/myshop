"""Create the owner's admin account interactively; never promote an existing user."""
from getpass import getpass

from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import User
from app.schemas import Register
from app.security import passwords


def create_admin(db, data: Register):
    if db.query(User).filter(or_(User.username == data.username, User.email == str(data.email))).first():
        raise ValueError("Email or username already exists; account not changed")
    user = User(username=data.username, email=str(data.email),
                hashed_password=passwords.hash(data.password), role="admin")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Email or username already exists") from None
    db.refresh(user)
    return user


def main():
    try:
        username = input("Admin username: ").strip()
        email = input("Admin email: ").strip()
        password = getpass("Admin password: ")
        if password != getpass("Confirm admin password: "):
            raise ValueError("Passwords do not match")
        data = Register(username=username, email=email, password=password)
        with SessionLocal() as db:
            user = create_admin(db, data)
            print(f"Admin created: {user.username} (id={user.id})")
    except ValidationError as error:
        for item in error.errors(include_input=False, include_context=False):
            print(f"{'.'.join(map(str, item['loc']))}: {item['msg']}")
        raise SystemExit(1)
    except ValueError as error:
        print(str(error))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
