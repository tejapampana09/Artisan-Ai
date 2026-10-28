"""Production regressions tested without contacting live services."""
import asyncio
import os
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from sqlalchemy import create_engine, inspect, text

from backend.app.models import Order, Payment, User
from backend.app.schemas import PaymentCreateRequest, PaymentVerifyRequest
from backend.app.routes import marketplace_payments as payments


def pending_order(db, status='PENDING_PAYMENT'):
    buyer = User(name='Buyer', email='production-test@example.invalid', role='BUYER', status='ACTIVE')
    db.add(buyer)
    db.flush()
    order = Order(user_id=buyer.id, product_id=1, buyer_name='Buyer', quantity=1,
                  unit_price=Decimal('100'), total_price=Decimal('100'), status=status,
                  delivery_address='Test address', payment_status='UNPAID')
    db.add(order)
    db.commit()
    return buyer, order


def test_idempotency_key_cannot_return_another_orders_payment(db):
    buyer, order = pending_order(db)
    foreign_payment = Payment(order_id=order.id + 1, provider='COD', amount=100,
                              idempotency_key='already-used', status='CREATED')
    db.add(foreign_payment)
    db.commit()
    with pytest.raises(HTTPException) as caught:
        payments.create_payment(PaymentCreateRequest(order_id=order.id, provider='COD',
                                idempotency_key='already-used'), db, buyer)
    assert caught.value.status_code == 409


def test_cancelled_order_cannot_be_verified(db):
    buyer, order = pending_order(db, 'CANCELLED')
    db.add(Payment(order_id=order.id, provider='COD', amount=100, status='CREATED'))
    db.commit()
    with pytest.raises(HTTPException) as caught:
        payments.verify_payment(PaymentVerifyRequest(order_id=order.id, provider='COD'), db, buyer)
    assert caught.value.status_code == 409
    assert order.status == 'CANCELLED'


def test_production_does_not_create_fake_gateway_order(db, monkeypatch):
    buyer, order = pending_order(db)
    monkeypatch.setattr(payments, 'ENVIRONMENT', 'production')
    with pytest.raises(HTTPException) as caught:
        payments.create_payment(PaymentCreateRequest(order_id=order.id, provider='RAZORPAY'), db, buyer)
    assert caught.value.status_code == 503
    assert db.query(Payment).count() == 0


def test_buyer_cannot_mark_production_cod_as_paid(db, monkeypatch):
    buyer, order = pending_order(db)
    db.add(Payment(order_id=order.id, provider='COD', amount=100, status='CREATED'))
    db.commit()
    monkeypatch.setattr(payments, 'ENVIRONMENT', 'production')
    with pytest.raises(HTTPException) as caught:
        payments.verify_payment(PaymentVerifyRequest(order_id=order.id, provider='COD'), db, buyer)
    assert caught.value.status_code == 409
    assert order.payment_status == 'UNPAID'


def test_error_response_does_not_reflect_untrusted_origin(monkeypatch):
    import backend.app.main as main
    monkeypatch.setattr(main, 'cors_origins', ['https://shop.example'])
    monkeypatch.setitem(main.cors_kwargs, 'allow_origin_regex', None)
    for origin, allowed in [('https://evil.vercel.app', False), ('https://shop.example', True)]:
        request = Request({'type': 'http', 'method': 'GET', 'path': '/api/test',
                           'headers': [(b'origin', origin.encode())]})
        response = asyncio.run(main.global_exception_handler(request, RuntimeError('test')))
        assert ('access-control-allow-origin' in response.headers) is allowed
        if allowed:
            assert response.headers['access-control-allow-origin'] == origin
            assert response.headers['vary'] == 'Origin'


def test_fresh_database_migrations_and_repeated_upgrade(tmp_path):
    root = Path(__file__).resolve().parents[2]
    url = f'sqlite:///{tmp_path / "fresh.db"}'
    env = {**os.environ, 'DATABASE_URL': url, 'ENVIRONMENT': 'ci', 'DEMO_MODE': 'false'}
    for _ in range(2):
        result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'],
                                cwd=root, env=env, capture_output=True, text=True, timeout=60)
        assert result.returncode == 0, result.stderr
    engine = create_engine(url)
    try:
        tables = inspect(engine).get_table_names()
        assert {'users', 'products', 'orders', 'payments', 'reviews', 'addresses'} <= set(tables)
        with engine.connect() as conn:
            assert conn.execute(text('select version_num from alembic_version')).scalar() == 'f31a89b0d1e2'
    finally:
        engine.dispose()


def test_phone_match_does_not_grant_order_ownership(db):
    from backend.app.routes.events import update_order_status
    from backend.app.schemas import OrderStatusUpdate
    buyer, order = pending_order(db, 'CONFIRMED')
    order.buyer_phone = '9876543210'
    other = User(name='Other buyer', email='other@example.invalid', role='BUYER',
                 status='ACTIVE', phone='9876543210')
    db.add(other)
    db.commit()
    with pytest.raises(HTTPException) as caught:
        update_order_status(order.id, OrderStatusUpdate(status='CANCELLED'), db, other)
    assert caught.value.status_code == 403
    assert order.status == 'CONFIRMED'


def test_repeated_cancellation_restores_stock_once(db):
    from backend.app.routes.events import update_order_status
    from backend.app.schemas import OrderStatusUpdate
    buyer, order = pending_order(db, 'CONFIRMED')
    original_stock = order.product.stock
    for _ in range(2):
        update_order_status(order.id, OrderStatusUpdate(status='CANCELLED'), db, buyer)
    db.refresh(order.product)
    assert order.product.stock == original_stock + order.quantity


def test_checkout_returns_real_order_id_and_unpaid_cod(client, db, monkeypatch):
    from backend.app import config
    from backend.app.models import Event
    from backend.tests.conftest import make_buyer
    _, _, _, headers = make_buyer(client)
    # Analytics IDs are independent from order IDs.
    db.add(Event(event_type='VIEW', product_id=1))
    db.commit()
    monkeypatch.setattr(config, 'ENVIRONMENT', 'production')
    response = client.post('/api/marketplace/order', headers=headers, json={
        'product_id': 1, 'quantity': 1, 'buyer_name': 'Buyer',
        'delivery_address': 'Test delivery address'
    })
    assert response.status_code == 201, response.text
    payload = response.json()
    order = db.get(Order, payload['order_id'])
    assert order is not None
    assert payload['id'] != payload['order_id']
    assert order.payment_method == 'COD'
    assert order.payment_status == 'UNPAID'
