import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Product, User
from app.schemas import Register
from app.create_admin import create_admin


class MyShopFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.secret = patch.dict(os.environ, {"JWT_SECRET": "test-only-long-random-enough-secret-0123456789"})
        cls.secret.start()
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        cls.sessions = sessionmaker(bind=cls.engine, autoflush=False)
        cls.engine_patch = patch("app.main.engine", cls.engine)
        cls.engine_patch.start()

        def test_db():
            with cls.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)
        app.dependency_overrides.clear()
        cls.engine_patch.stop()
        cls.engine.dispose()
        cls.secret.stop()

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)

    def register(self, username="customer"):
        data = {"username": username, "email": f"{username}@example.com", "password": "test-password-123"}
        response = self.client.post("/auth/register", json=data)
        self.assertEqual(response.status_code, 201)
        return data

    def token(self, data):
        response = self.client.post("/auth/login", json={"email": data["email"], "password": data["password"]})
        self.assertEqual(response.status_code, 200)
        return {"Authorization": "Bearer " + response.json()["access_token"]}

    def admin(self):
        with self.sessions() as db:
            create_admin(db, Register(username="owner", email="owner@example.com", password="owner-password-123"))
        return self.token({"email": "owner@example.com", "password": "owner-password-123"})

    def product(self, admin, quantity=3):
        data = {"name": "USB-C Adapter", "description": "Dụng cụ chuyển đổi dành cho laptop",
                "category": "Phụ kiện", "price": "125000.00", "quantity": quantity,
                "image_url": None, "active": True}
        response = self.client.post("/admin/products", json=data, headers=admin)
        self.assertEqual(response.status_code, 201)
        return response.json()

    def checkout(self, customer, product_id, qty=1):
        return self.client.post("/orders", headers=customer, json={
            "recipient_name": "Nguyễn Minh Tri", "phone": "0912345678", "address": "123 Đường ABC, TPHCM",
            "items": [{"product_id": product_id, "quantity": qty}],
        })

    def test_registration_login_privileges_and_existing_admin(self):
        data = self.register()
        self.assertEqual(self.client.post("/auth/register", json={**data, "role": "admin"}).status_code, 422)
        self.assertEqual(self.client.post("/auth/register", json=data).status_code, 409)
        admin = self.admin()
        with self.sessions() as db:
            with self.assertRaises(ValueError):
                create_admin(db, Register(**data))
            self.assertEqual(db.scalar(select(User).where(User.email == data["email"])).role, "customer")
        customer = self.token(data)
        self.assertEqual(self.client.get("/auth/me", headers=customer).json()["role"], "customer")
        self.assertNotIn("hashed_password", self.client.get("/auth/me", headers=admin).json())
        self.assertEqual(self.client.post("/admin/products", json={}, headers=customer).status_code, 403)
        self.assertEqual(self.client.get("/admin/orders", headers=customer).status_code, 403)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": data["email"], "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": data["email"], "password": "ế" * 30}).status_code, 422)

    def test_catalog_checkout_stock_and_price_are_server_authoritative(self):
        admin = self.admin()
        item = self.product(admin, quantity=2)
        customer = self.token(self.register())
        self.assertEqual(self.client.get("/products").json()["total"], 1)
        self.assertEqual(self.client.get("/products?search=USB").json()["total"], 1)
        self.assertEqual(self.client.get("/products?search=%25").json()["total"], 0)
        self.assertEqual(self.client.post("/orders", headers=customer, json={
            "recipient_name": "Nguyễn Minh Tri", "phone": "0912345678", "address": "123 Đường ABC, TPHCM",
            "items": [{"product_id": item["id"], "quantity": 1, "price": "1.00"}],
        }).status_code, 422)
        response = self.checkout(customer, item["id"], 2)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["total"], "250000.00")
        self.assertEqual(response.json()["items"][0]["unit_price"], "125000.00")
        self.assertEqual(self.client.get(f"/products/{item['id']}").json()["quantity"], 0)
        self.assertEqual(self.checkout(customer, item["id"]).status_code, 409)

    def test_mock_payment_order_isolation_and_admin_progression(self):
        admin = self.admin()
        item = self.product(admin)
        customer = self.token(self.register())
        other = self.token(self.register("otheruser"))
        order = self.checkout(customer, item["id"]).json()
        order_id = order["id"]
        self.assertEqual(self.client.get(f"/orders/{order_id}", headers=other).status_code, 404)
        self.assertEqual(self.client.post(f"/orders/{order_id}/pay", headers=other).status_code, 404)
        self.assertEqual(self.client.patch(f"/admin/orders/{order_id}/status", headers=admin, json={"status": "confirmed"}).status_code, 409)
        self.assertEqual(self.client.post(f"/orders/{order_id}/pay", headers=customer).json()["payment_status"], "paid")
        self.assertEqual(self.client.post(f"/orders/{order_id}/pay", headers=customer).json()["payment_status"], "paid")
        self.assertEqual(self.client.post(f"/orders/{order_id}/cancel", headers=customer).status_code, 409)
        for status in ("confirmed", "shipping", "completed"):
            result = self.client.patch(f"/admin/orders/{order_id}/status", headers=admin, json={"status": status})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["status"], status)
        self.assertEqual(self.client.patch(f"/admin/orders/{order_id}/status", headers=admin, json={"status": "shipping"}).status_code, 409)
        self.assertEqual(self.client.get("/orders", headers=other).json(), [])
        self.assertEqual(len(self.client.get("/admin/orders", headers=admin).json()), 1)

    def test_cancel_releases_stock_once_and_hidden_product_cannot_sell(self):
        admin = self.admin()
        item = self.product(admin, quantity=1)
        customer = self.token(self.register())
        order_id = self.checkout(customer, item["id"]).json()["id"]
        self.assertEqual(self.client.post(f"/orders/{order_id}/cancel", headers=customer).status_code, 200)
        self.assertEqual(self.client.post(f"/orders/{order_id}/cancel", headers=customer).status_code, 409)
        self.assertEqual(self.client.get(f"/products/{item['id']}").json()["quantity"], 1)
        self.assertEqual(self.client.post(f"/orders/{order_id}/pay", headers=customer).status_code, 409)
        updated = {"name": item["name"], "description": item["description"], "category": item["category"],
                   "price": "150000.00", "quantity": 1, "image_url": None, "active": False}
        self.assertEqual(self.client.put(f"/admin/products/{item['id']}", json=updated, headers=admin).status_code, 200)
        self.assertEqual(self.client.get(f"/products/{item['id']}").status_code, 404)
        self.assertEqual(self.checkout(customer, item["id"]).status_code, 409)

    def test_duplicate_item_validation_and_multi_product_order(self):
        admin = self.admin()
        first = self.product(admin)
        second = self.product(admin)
        customer = self.token(self.register())
        checkout = {"recipient_name": "Nguyễn Minh Tri", "phone": "0912345678", "address": "123 Đường ABC, TPHCM",
                    "items": [{"product_id": first["id"], "quantity": 1}, {"product_id": first["id"], "quantity": 1}]}
        self.assertEqual(self.client.post("/orders", headers=customer, json=checkout).status_code, 422)
        checkout["items"][1]["product_id"] = second["id"]
        response = self.client.post("/orders", headers=customer, json=checkout)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["items"]), 2)
        self.assertEqual(response.json()["total"], "250000.00")


if __name__ == "__main__":
    unittest.main()
