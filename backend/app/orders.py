from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, OrderItem, Product, User
from app.schemas import CheckoutInput, OrderResponse, OrderStatusInput
from app.security import admin_user, current_user

router = APIRouter(tags=["orders"])


def owned_order(order_id: int, db: Session, user: User):
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(404, "Order not found")
    return order


@router.post("/orders", status_code=201, response_model=OrderResponse)
def checkout(data: CheckoutInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    requested = {item.product_id: item.quantity for item in data.items}
    # InnoDB row locks serialize competing checkouts of the last stock unit.
    products = db.scalars(select(Product).where(Product.id.in_(requested)).order_by(Product.id).with_for_update()).all()
    if len(products) != len(requested) or any(not p.active or p.quantity < requested[p.id] for p in products):
        db.rollback()
        raise HTTPException(409, "Product unavailable or insufficient stock")
    total = sum((p.price * requested[p.id] for p in products), Decimal("0.00"))
    order = Order(customer_id=user.id, recipient_name=data.recipient_name, phone=data.phone,
                  address=data.address, note=data.note, total=total, status="pending", payment_status="pending")
    db.add(order)
    db.flush()
    for product in products:
        db.add(OrderItem(order_id=order.id, product_id=product.id, product_name=product.name,
                         unit_price=product.price, quantity=requested[product.id]))
        product.quantity -= requested[product.id]
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=list[OrderResponse])
def my_orders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Order).where(Order.customer_id == user.id).order_by(Order.id.desc())).all()


@router.get("/orders/{order_id}", response_model=OrderResponse)
def my_order(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return owned_order(order_id, db, user)


@router.post("/orders/{order_id}/pay", response_model=OrderResponse)
def mock_pay(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    order = db.scalars(select(Order).where(Order.id == order_id, Order.customer_id == user.id).with_for_update()).first()
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        raise HTTPException(409, "Cancelled order cannot be paid")
    if order.payment_status == "pending":
        order.payment_status = "paid"  # Simulation only: no actual payment provider.
        db.commit()
        db.refresh(order)
    return order


@router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
def cancel(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Lock order before checking state so repeated cancellation cannot restock twice.
    order = db.scalars(select(Order).where(Order.id == order_id, Order.customer_id == user.id).with_for_update()).first()
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.status != "pending" or order.payment_status != "pending":
        raise HTTPException(409, "Only unpaid pending orders can be cancelled")
    for item in sorted(order.items, key=lambda entry: entry.product_id):
        product = db.scalars(select(Product).where(Product.id == item.product_id).with_for_update()).one()
        product.quantity += item.quantity
    order.status = "cancelled"
    db.commit()
    db.refresh(order)
    return order


@router.get("/admin/orders", response_model=list[OrderResponse])
def all_orders(offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
               admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return db.scalars(select(Order).order_by(Order.id.desc()).offset(offset).limit(limit)).all()


@router.patch("/admin/orders/{order_id}/status", response_model=OrderResponse)
def advance(order_id: int, data: OrderStatusInput, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    order = db.scalars(select(Order).where(Order.id == order_id).with_for_update()).first()
    if order is None:
        raise HTTPException(404, "Order not found")
    transitions = {"pending": "confirmed", "confirmed": "shipping", "shipping": "completed"}
    if order.payment_status != "paid" or transitions.get(order.status) != data.status:
        raise HTTPException(409, "Invalid order transition or payment pending")
    order.status = data.status
    db.commit()
    db.refresh(order)
    return order
