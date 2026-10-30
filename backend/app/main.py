from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base, engine
from app import models  # Import before creating tables.
from app.auth import router as auth_router
from app.products import router as products_router
from app.orders import router as orders_router
from app.security import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings()
    # Initial local bootstrap only: use versioned migrations for future schema changes.
    Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        engine.dispose()


app = FastAPI(title="MyShop API", version="0.1.0", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/ready")
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable") from None
    return {"status": "ready"}
