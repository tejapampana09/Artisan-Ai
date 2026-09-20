# 🏗️ Artisan AI — System Architecture

## Overview

Artisan AI is a full-stack, voice-first AI business platform and direct market linkage system designed to empower traditional Indian artisans. The project is organized as a clean, unified monorepo containing a high-performance **React 19 + Vite** web application, an **Expo / React Native** mobile app for rural artisans, a **FastAPI** backend with modular services, and a resilient database tier.

```text
┌────────────────────────────────────────────────────────┐
│             Web (React 19) & Mobile (Expo)             │
│   (Artisan Studio / Buyer Marketplace / Voice Studio)  │
└───────────────────────────┬────────────────────────────┘
                            │  HTTP / JSON (REST API)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│   ┌────────────────────────────────────────────────┐   │
│   │ Routers: Auth, Products, Pricing, AI, ML, Sync │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │ Services: Catalog, Market Research, Pricing,   │   │
│   │           Demand Engine, ML Demand Engine      │   │
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
├── backend/                         # FastAPI backend & ML engine
│   ├── alembic/                     # Versioned database schema migrations
│   │   ├── versions/                # Migration scripts (e.g. 0001_v3_auth_domains.py)
│   │   └── env.py
│   ├── ml/                          # Machine learning demand training & artifacts
│   │   ├── train_demand_model.py    # RandomForest training with chronological split
│   │   ├── demand_model.joblib      # Trained model weights
│   │   └── model_meta.json          # Model metadata (R², MAE, feature importances)
│   ├── app/
│   │   ├── routes/                  # Modular API endpoints
│   │   │   ├── auth.py              # JWT authentication & session management
│   │   │   ├── products.py          # CRUD & status lifecycle for crafts
│   │   │   ├── pricing.py           # Explainable cost-plus pricing decisions
│   │   │   ├── ai_catalog.py        # Multimodal Gemini catalog generation
│   │   │   ├── intelligence.py      # Category demand velocity & seller copilot
│   │   │   ├── ml_demand.py         # Product-level ML demand forecasting endpoints
│   │   │   ├── ondc.py              # ONDC Beckn v1.2 discovery router
│   │   │   └── sync.py              # Rural offline delta synchronization
│   │   │
│   │   ├── integrations/            # External protocol & channel adapters
│   │   │   └── ondc/                # ONDC Retail v1.2 adapter (signing, schemas, client)
│   │   │
│   │   ├── services/                # Pure business logic layer
│   │   │   ├── auth.py              # PBKDF2 hashing, JWT verification, domain isolation
│   │   │   ├── catalog_orchestrator.py # Multimodal catalog generation & facts extraction
│   │   │   ├── market_research.py   # SSRF-guarded extractor & comparability matcher
│   │   │   ├── market_research_provider.py # SearXNG external market research provider
│   │   │   ├── pricing_engine.py    # Cost breakdown, margin floor, market-aware pricing
│   │   │   ├── demand_engine.py     # Macro category demand shares & seller restock alerts
│   │   │   ├── ml_demand_engine.py  # Micro product-level Random Forest ML demand forecast
│   │   │   └── rate_limiter.py      # Sliding-window rate limiter
│   │   │
│   │   ├── config.py                # Environment-driven configuration & CORS
│   │   ├── database.py              # SQLAlchemy engine & session management
│   │   ├── models.py                # SQLAlchemy ORM relational models
│   │   ├── schemas.py               # Pydantic validation & transfer schemas
│   │   ├── main.py                  # FastAPI application factory & middlewares
│   │   └── seed.py                  # Seed script utilities
│   │
│   ├── tests/                       # Backend test suite (pytest: 107+ tests)
│   └── requirements.txt             # Consolidated Python dependencies
│
├── frontend/                        # React 19 + Vite Single Page Application
│   ├── src/
│   │   ├── api/                     # Modular API client layer (index, client, auth, products)
│   │   ├── components/              # Dual-mode views (Artisan Studio & Buyer Marketplace)
│   │   ├── context/                 # Application state providers
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # Offline sync queue & client caching
│   │   ├── App.jsx                  # Main application orchestrator
│   │   └── main.jsx                 # React root entry point
│   ├── tests/                       # Node native test suite
│   ├── package.json                 # Frontend dependencies & scripts
│   └── vite.config.js               # Vite config & API reverse-proxy
│
├── mobile/                          # Expo / React Native application
│   ├── app/                         # Expo Router screens (seller-business, catalog, etc.)
│   ├── src/
│   │   ├── api.ts                   # Type-safe mobile API client
│   │   ├── components/              # Design system components (Card, Chip, Button, etc.)
│   │   ├── offline-queue.ts         # SQLite/AsyncStorage rural offline queue
│   │   └── theme.ts                 # Visual design tokens & typography
│   └── package.json                 # Mobile dependencies
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

## 🗄️ Database & Migration Strategy

- **Development**: FastAPI connects to a local SQLite database (`sqlite:///./artisan_ai.db`). `Base.metadata.create_all(bind=engine)` initializes all required tables automatically on startup for instant zero-dependency local runs.
- **Production**: Supports PostgreSQL connection pooling (`pool_size=10`, `max_overflow=20`, `pre_ping=True`).
- **Migrations**: Versioned schema migrations are managed via **Alembic** (`backend/alembic/`), guaranteeing deterministic schema upgrades across staging and production without data loss.

---

## ⚖️ Evidence Invariant Hierarchy

All market research and pricing decisions adhere strictly to a 4-tier evidence invariant:

| Evidence Level | Description | Price Verification | Eligible for Market Median? | Sets `market_is_reliable`? |
| :--- | :--- | :--- | :--- | :--- |
| **`EXTERNAL_LIVE`** | Live external web page discovered via SearXNG, fetched via SSRF-guarded HTTP client, validated via JSON-LD/OpenGraph/HTML schema | `price_verified=True` | **YES** (Only level) | **YES** ($\ge 1$ verified listing) |
| **`INTERNAL_MARKETPLACE`** | Internal Artisan AI database product | N/A | NO | **NO** (`False`) |
| **`AI_ESTIMATE`** | Informational LLM reference price | Non-observed | NO | **NO** (`False`) |
| **`NONE`** | No market claims found | None | NO | **NO** (`False`) |

---

## 🔄 Decoupled Catalog & ML Demand Pipeline

The platform enforces a strict boundary between pre-publication craft catalog creation and post-publication machine learning forecasting:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          1. AI CATALOG STUDIO                           │
│                      (Creation & Pre-Publishing)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Artisan Input (Photos, Voice, Q&A)                                     │
│         │                                                               │
│         ▼                                                               │
│  Canonical Facts (Craft, Materials, Time, Production Costs)             │
│         │                                                               │
│         ▼                                                               │
│  Market Research (Verified External Comparables via SearXNG)            │
│         │                                                               │
│         ▼                                                               │
│  Pricing Recommendation (Cost-Floor + Market Median + Fair Margin)      │
│  [demand_factor = 1.0 (Neutral Baseline), Zero Synthetic Telemetry]     │
│         │                                                               │
│         ▼                                                               │
│  Seller & Admin Review ──► Publish to Marketplace                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      2. MARKETPLACE TELEMETRY                           │
│                          (Post-Publishing)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Buyer Activity: Search, Views, Wishlist/Saves, Enquiries, Orders       │
│  Logged into `Event` table with exact product_id & timestamps           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               3. SELLER BUSINESS / MARKET INTELLIGENCE                  │
│                     (Random Forest ML Demand Engine)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Extract Telemetry: Real Views, Saves, Enquiries, Orders, Price/Cost    │
│         │                                                               │
│         ▼                                                               │
│  Random Forest Inference: Demand Score (0–100), Level, Multiplier       │
│         │                                                               │
│         ▼                                                               │
│  Seller Copilot Restock Alerts & Optional Autonomous Dynamic Pricing    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Provenance

1. **Authentication & Domain Isolation**: Strict JWT Bearer token authentication with domain isolation (`MARKETPLACE`, `ARTISAN_STUDIO`, `ADMIN`).
2. **SSRF Guarded Web Ingestion**: External market research blocks all private/loopback IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), non-HTTP schemes, and unsafe redirects.
3. **Protected Artisan Margin Floor**: Minimum $\ge 20\%$ profit margin floor calculated via Decimal arithmetic, preventing predatory downward pricing.
4. **Anti-Compounding Baseline Anchor**: Autonomous dynamic pricing anchors adjustments to the artisan's base manual price, bounding adjustments strictly to $\pm 15\%$.
5. **No Synthetic Telemetry**: Unpublished drafts never simulate buyer engagement. Telemetry is 100% authentic and logged from real buyer interactions.
