# 🏗️ Artisan AI — System Architecture

## Overview

Artisan AI is a full-stack, voice-first AI business platform and direct market linkage system designed to empower traditional Indian artisans. The project is organized as a clean, unified monorepo containing a high-performance **React 19 + Vite** frontend, a **FastAPI** backend with modular services, and a resilient database tier.

```text
┌────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend             │
│   (Artisan Studio / Buyer Marketplace / Voice Studio)  │
└───────────────────────────┬────────────────────────────┘
                            │  HTTP / JSON (REST API)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│   ┌────────────────────────────────────────────────┐   │
│   │ Routers: Auth, Products, Pricing, AI, Sync     │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │ Services: Auth, AI Adapter, Pricing, Demand    │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    Development: SQLite          Production: PostgreSQL
    (artisan_ai.db)              (with Alembic migrations)
```

---

## 📂 Monorepo Structure

```text
Artisan-AI/
│
├── backend/                         # FastAPI backend
│   ├── app/
│   │   ├── routes/                  # Modular API endpoints
│   │   │   ├── auth.py              # JWT authentication & session management
│   │   │   ├── products.py          # CRUD & status lifecycle for crafts
│   │   │   ├── pricing.py           # Explainable cost-plus pricing decisions
│   │   │   ├── ai_catalog.py        # Multimodal Gemini catalog generation
│   │   │   ├── intelligence.py      # Real-time category demand & copilot
│   │   │   ├── ondc.py              # ONDC protocol integration prototype
│   │   │   └── sync.py              # Rural offline delta synchronization
│   │   │
│   │   ├── services/                # Pure business logic layer
│   │   │   ├── auth.py              # PBKDF2 hashing, JWT verification
│   │   │   ├── ai_adapter.py        # Gemini multimodal integration & honest drafts
│   │   │   ├── pricing_engine.py    # Cost breakdown & 20% margin floor
│   │   │   ├── demand_engine.py     # Aggregated buyer behavior demand metrics
│   │   │   ├── ondc_adapter.py      # ONDC Beckn schema transformation
│   │   │   └── rate_limiter.py      # Sliding-window rate limiter
│   │   │
│   │   ├── config.py                # Environment-driven configuration & CORS
│   │   ├── database.py              # SQLAlchemy engine & session management
│   │   ├── models.py                # SQLAlchemy ORM relational models
│   │   ├── schemas.py               # Pydantic validation & transfer schemas
│   │   ├── main.py                  # FastAPI application factory & middlewares
│   │   └── seed.py                  # Seed script utilities
│   │
│   ├── tests/                       # Backend test suite (pytest)
│   └── requirements.txt             # Single consolidated Python dependencies
│
├── frontend/                        # React 19 + Vite Single Page Application
│   ├── src/
│   │   ├── api/                     # Modular API client layer (index, client, auth, products)
│   │   ├── components/              # Dual-mode views (Artisan Studio & Buyer Marketplace)
│   │   ├── context/                 # Application state providers
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # Offline sync queue & client caching
│   │   ├── assets/                  # Images & craft media
│   │   ├── App.jsx                  # Main application orchestrator
│   │   └── main.jsx                 # React root entry point
│   │
│   ├── tests/                       # Node native test suite
│   ├── package.json                 # Frontend dependencies & scripts
│   └── vite.config.js               # Vite config & API reverse-proxy
│
├── docs/                            # Documentation
│   ├── architecture.md              # System design & component interactions
│   ├── setup.md                     # Installation & running guide
│   └── api.md                       # API reference & endpoints
│
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore configuration
├── package.json                     # Root orchestrator scripts
└── README.md                        # Project documentation
```

---

## 🗄️ Database Strategy

- **Development**: FastAPI connects to a local SQLite database (`sqlite:///./artisan_ai.db`). `Base.metadata.create_all(bind=engine)` initializes all required tables cleanly and automatically on startup.
- **Production**: Supports PostgreSQL connection pooling (`pool_size=10`, `max_overflow=20`, `pre_ping=True`).
- **Simplicity**: Schema tables are managed directly by SQLAlchemy ORM models (`backend/app/models.py`), eliminating external migration tool overhead for simple, robust deployment.

---

## 🔒 Security & Provenance

1. **Authentication**: Strict JWT Bearer token authentication. No mock, fake, or hardcoded demo credentials.
2. **Explainable Pricing**: Strict 20% minimum protected margin floor calculated via Decimal arithmetic.
3. **Multimodal AI Safety**: Factual craft claims and pricing are generated as editable drafts and require artisan verification.
4. **Production CORS**: Strictly restricted in production to explicit domain origins; `localhost` fallbacks are only allowed in development.
