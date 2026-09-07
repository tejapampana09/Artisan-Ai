# 🚀 Artisan AI — Setup & Installation Guide

This guide walks you through setting up and running Artisan AI locally.

## Prerequisites

- **Python**: 3.10+ (Python 3.11, 3.12, 3.13, 3.14 supported)
- **Node.js**: 18+ (Node 20+ or 24+ recommended)
- **npm**: 9+

---

## 1. Clone & Workspace Setup

```bash
git clone https://github.com/tejapampana09/Artisan-Ai.git
cd Artisan-Ai
```

---

## 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Key environment variables in `.env`:

```env
# Application Environment (development or production)
ENVIRONMENT=development
DEMO_MODE=false

# Database Configuration (SQLite default for local development)
DATABASE_URL=sqlite:///./artisan_ai.db

# Security / JWT
JWT_SECRET_KEY=artisan_ai_dev_secret_key_marginalized_artisans_safety_first
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Network & CORS
HOST=127.0.0.1
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Multimodal AI (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here
AI_REQUEST_TIMEOUT_SECONDS=15.0

# Frontend API Base
VITE_API_BASE=/api
```

---

## 3. Backend Setup

Create a virtual environment and install backend dependencies:

```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### Initialize Database

Starting the FastAPI backend server automatically creates all required tables cleanly via SQLAlchemy `Base.metadata.create_all()`.


---

## 4. Frontend Setup

Install the React frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Or from the root directory:

```bash
npm run install:frontend
```

---

## 5. Running the Application

### Option A: Run Both Services Separately

**Terminal 1 (Backend FastAPI)**:
```bash
# From workspace root with venv active
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend Vite)**:
```bash
# From workspace root
npm run dev
# OR from frontend folder:
cd frontend && npm run dev
```

### Option B: Root Orchestration

From the project root:
```bash
npm run dev
```

---

## 6. Accessing the Platform

- **Frontend App**: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- **Backend API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 7. Running Tests

**Frontend Tests**:
```bash
npm --prefix frontend test
```

**Backend Tests**:
```bash
pytest backend/tests
```
