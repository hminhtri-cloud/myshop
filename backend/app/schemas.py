from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator


class Register(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password exceeds 72 UTF-8 bytes")
        return value


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password exceeds 72 UTF-8 bytes")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    role: Literal["admin", "customer"]
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ProductInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    category: str = Field(min_length=2, max_length=60)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(ge=0)
    image_url: HttpUrl | None = Field(default=None, max_length=500)
    active: bool = True

    @field_validator("price", mode="before")
    @classmethod
    def decimal_only(cls, value):
        if isinstance(value, float):
            raise ValueError("Send price as a decimal string")
        return value


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    category: str
    price: Decimal
    quantity: int
    image_url: str | None
    active: bool
    created_at: datetime


class ProductPage(BaseModel):
    items: list[ProductResponse]
    total: int
    offset: int
    limit: int


class CartItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=99)


class CheckoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    recipient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^\+?[0-9]{9,15}$")
    address: str = Field(min_length=10, max_length=300)
    note: str | None = Field(default=None, max_length=500)
    items: list[CartItemInput] = Field(min_length=1, max_length=20)

    @field_validator("items")
    @classmethod
    def unique_products(cls, value: list[CartItemInput]):
        if len({item.product_id for item in value}) != len(value):
            raise ValueError("Duplicate products in cart")
        return value


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: int
    product_name: str
    unit_price: Decimal
    quantity: int


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    recipient_name: str
    phone: str
    address: str
    note: str | None
    total: Decimal
    payment_status: Literal["pending", "paid"]
    status: Literal["pending", "confirmed", "shipping", "completed", "cancelled"]
    created_at: datetime
    items: list[OrderItemResponse]


class OrderStatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["confirmed", "shipping", "completed"]
