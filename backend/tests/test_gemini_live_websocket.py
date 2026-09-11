import pytest
import json
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.auth import create_access_token
from backend.app.models import User, InterviewSession
import backend.app.database as db_module

client = TestClient(app)

def get_auth_token(email="lakshmi_live@artisanai.in"):
    with db_module.SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            from backend.app.services.auth import hash_password
            user = User(
                email=email,
                name="Lakshmi Live",
                hashed_password=hash_password("password123"),
                role="SELLER"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(data={"sub": str(user.id)})
        return token, user.id

def create_test_session(user_id: int, status_str="ACTIVE"):
    with db_module.SessionLocal() as db:
        sess = InterviewSession(
            user_id=user_id,
            language="te",
            category_hint="Kondapalli Toy",
            question_count=1,
            status=status_str,
            product_facts=json.dumps({})
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
        return sess.id

def test_websocket_rejects_missing_or_invalid_auth():
    token, user_id = get_auth_token()
    session_id = create_test_session(user_id)

    # 1. Invalid first message type
    with client.websocket_connect(f"/api/interview/{session_id}/live-ws") as websocket:
        websocket.send_json({"type": "invalid", "data": "test"})
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "First message must be auth packet" in data["message"]

    # 2. Invalid JWT token
    with client.websocket_connect(f"/api/interview/{session_id}/live-ws") as websocket:
        websocket.send_json({"type": "auth", "token": "invalid_jwt_token"})
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "Invalid or expired authentication token" in data["message"]

def test_websocket_valid_auth_and_session_checks():
    token, user_id = get_auth_token()
    session_id = create_test_session(user_id, status_str="ACTIVE")

    with client.websocket_connect(f"/api/interview/{session_id}/live-ws") as websocket:
        # Send valid auth packet
        websocket.send_json({"type": "auth", "token": token})
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["session_id"] == session_id
        assert data["max_questions"] == 4

def test_websocket_rejects_non_active_session():
    token, user_id = get_auth_token()
    session_id = create_test_session(user_id, status_str="FACTS_COMPLETE")

    with client.websocket_connect(f"/api/interview/{session_id}/live-ws") as websocket:
        websocket.send_json({"type": "auth", "token": token})
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "Must be in ACTIVE status" in data["message"]
