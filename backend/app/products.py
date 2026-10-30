from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, User
from app.schemas import ProductInput, ProductPage, ProductResponse
from app.security import admin_user

router = APIRouter(tags=["products"])


def page(db, filters, offset, limit):
    total = db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
    items = db.scalars(select(Product).where(*filters).order_by(Product.id.desc()).offset(offset).limit(limit)).all()
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/products", response_model=ProductPage)
def catalog(search: str | None = Query(None, max_length=120), category: str | None = Query(None, max_length=60),
            offset: int = Query(0, ge=0), limit: int = Query(12, ge=1, le=100), db: Session = Depends(get_db)):
    filters = [Product.active.is_(True)]
    if search and search.strip():
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filters.append(Product.name.ilike(f"%{escaped}%", escape="\\"))
    if category:
        filters.append(Product.category == category)
    return page(db, filters, offset, limit)


@router.get("/products/{product_id}", response_model=ProductResponse)
def detail(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None or not product.active:
        raise HTTPException(404, "Product not found")
    return product


@router.get("/admin/products", response_model=ProductPage)
def all_products(offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
                 admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return page(db, [], offset, limit)


@router.post("/admin/products", response_model=ProductResponse, status_code=201)
def create(data: ProductInput, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    product = Product(**data.model_dump(mode="json"))
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/admin/products/{product_id}", response_model=ProductResponse)
def update(product_id: int, data: ProductInput, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    for key, value in data.model_dump(mode="json").items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product
