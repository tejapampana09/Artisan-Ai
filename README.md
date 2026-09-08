# Artisan AI: AI-Driven Market Linkage & Smart Cataloging for Marginalized Artisans

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Problem Statement ID](https://img.shields.io/badge/Problem%20Statement-26090-blue.svg)](https://www.sih.gov.in/)
[![Theme](https://img.shields.io/badge/Theme-Heritage%20%26%20Culture-green.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF.svg?logo=vite)](https://vitejs.dev)
[![AWS Elastic Beanstalk](https://img.shields.io/badge/AWS%20Elastic%20Beanstalk-v1.0.3-FF9900.svg?logo=amazon-aws)](http://artisan-ai-backend-prod.us-east-1.elasticbeanstalk.com)
[![AWS S3 + CloudFront CDN](https://img.shields.io/badge/AWS%20CloudFront-Live-232F3E.svg?logo=amazon-aws)](https://dd8bq7j24onss.cloudfront.net)
[![Test Suite](https://img.shields.io/badge/Tests-100%2F100%20Passing-brightgreen.svg)]()

Artisan AI is a production-grade digital marketplace, smart cataloging engine, live delivery tracking system, and business intelligence copilot designed for rural and marginalized Indian artisans. The platform eliminates digital literacy barriers by combining **Voice-First Multilingual Cataloging (Hindi, Telugu, Tamil, Bengali, English)**, **AI Fair Market Price Estimation (`POST /api/ai/estimate-price`)**, **ML Demand Prediction Engine (`scikit-learn` `RandomForestRegressor`)**, **Explainable Dynamic Pricing with Cost Floor Protection**, **Real-Time Targeted Buyer Delivery Notifications**, **Instant Mobile Cache & Offline Batch Synchronization**, and **AWS Cloud Infrastructure (Elastic Beanstalk + S3 CloudFront CDN)**.

---

## 🏛️ System Architecture

```text
                                  ┌────────────────────────────────┐
                                  │   ARTISAN / BUYER CLIENT       │
                                  │   React 19 + Vite PWA (AWS)    │
                                  │  • Dual-Mode (SELL ↔ BUY)      │
                                  │  • Voice Audio & AI Estimate   │
                                  │  • 0ms Offline Cache / Sync    │
                                  └───────────────┬────────────────┘
                                                  │ HTTP + JWT Bearer
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │    AWS ELASTIC BEANSTALK       │
                                  │   FastAPI Monolith (v1.0.3)    │
                                  │  • CORS & Sliding Rate Limit   │
                                  │  • JWT Auth & Seller Isolation │
                                  │  • Targeted Order Dispatcher   │
                                  └───────────────┬────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
     ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
     │     CATALOG ENGINE     │       │    ANALYTICS ENGINE    │       │     AI INTEGRATION     │
     │  • Product CRUD        │       │  • Weighted Scoring    │       │  • Google Gemini Live  │
     │  • Seller Ownership    │       │  • Category Surges     │       │  • Market Price Solver │
     │  • Margin Verification │       │  • Zero-PII Aggregates │       │  • Gemini 2.5 Flash    │
     └────────────┬───────────┘       └────────────┬───────────┘       └────────────┬───────────┘
                  │                                │                                │
                  └────────────────────────────────┼────────────────────────────────┘
                                                   ▼
                                      ┌────────────────────────┐
                                      │  EXPLAINABLE PRICING   │
                                      │ • Floor: Cost + 20%    │
                                      │ • Dynamic Surge: Bounded│
                                      │ • Decimal Money Math   │
                                      │ • Final Decision: Human│
                                      └────────────┬───────────┘
                                                   │
                                                   ▼
                                      ┌────────────────────────┐
                                      │  TRANSACTIONAL STORAGE │
                                      │  • PostgreSQL / SQLite │
                                      │  • Connection Pooling  │
                                      │  • Alembic Migrations  │
                                      │  • Exact NUMERIC(12,2) │
                                      └────────────────────────┘
```

---

## 📊 Currently Implemented vs Future Scalability

| Dimension | Currently Implemented (Production-Ready Foundation) | Future Scalability Architecture (Phase 2 Roadmap) |
| :--- | :--- | :--- |
| **Cloud Deployment** | **AWS CloudFront CDN** (`https://dd8bq7j24onss.cloudfront.net`) for static frontend SPA delivery + **AWS Elastic Beanstalk** (`artisan-ai-backend-prod`) v1.0.3 for FastAPI backend server. | Multi-region AWS ECS Fargate microservices with CloudFront edge lambdas for global low latency. |
| **AI Price Estimation** | **AI Fair Market Price Engine** (`POST /api/ai/estimate-price`) analyzing product titles, craft materials, and category demand indices to estimate fair market pricing when cost inputs are omitted. | Real-time e-commerce scraper benchmark feed comparing active artisan crafts against national handicrafts portals. |
| **Targeted Delivery Alerts** | **Real-Time Targeted Buyer Notifications**: Status updates (`CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) automatically dispatch targeted notifications to the specific ordering buyer account. | WebPush FCM (Firebase Cloud Messaging) background push service and SMS notification alerts. |
| **Authentication** | Lightweight JWT tokens with PBKDF2-HMAC password hashing; token versioning (`token_version`) for password change session revocation; strict production secret validation. | Multi-tenant OAuth2/OIDC, Phone OTP via SMS gateway (Twilio/Gupshup), DigiLocker artisan ID verification. |
| **Database & ORM** | PostgreSQL (production) with hardened QueuePool (`pool_size=10`, `max_overflow=20`, `pre_ping=True`, `recycle=300`) and SQLite (development); managed via Alembic migrations. | PgBouncer connection multiplexing and read replicas for read-heavy marketplace catalogs. |
| **Money Handling** | Exact `NUMERIC(12, 2)` currency representation and Python `Decimal` arithmetic for product costs, order totals, and dynamic pricing decisions; zero IEEE-754 floating-point drift. | Multi-currency conversions (INR, USD, EUR) with live RBI/forex exchange rate feeds. |
| **Concurrency & Orders** | Atomic single-transaction conditional stock update (`WHERE stock >= requested_quantity`); negative stock strictly prevented (`CheckConstraint`). | Distributed transactional locks via Redis/Redlock and Celery worker queues for high-velocity flash sales. |
| **Data Privacy** | Public analytics events stripped of all PII; customer phone and address stored strictly in protected `Order` and `Enquiry` tables. | Column-level database encryption (pghash/AES-256), automated data retention policies, and GDPR/DPDP compliant anonymization. |
| **Market Intelligence** | Weighted event scoring (`ORDER` 10x, `ENQUIRY` 6x, `SAVE` 4x, `SEARCH` 2x, `VIEW` 1x) calculating category demand indices and surge multipliers. | Clickhouse/BigQuery OLAP streaming pipeline with Kafka ingestion for real-time national trend analysis. |
| **Dynamic Pricing & ML Engine** | **Hybrid ML & Cost Basis Engine**: `scikit-learn` `RandomForestRegressor` (`POST /api/ml/predict-demand`, `GET /api/ml/model-info`, `POST /api/ml/retrain`) predicting demand velocity scores [0–100] combined with strict Cost Floor Basis (Material + Labour + Packaging + Other + ≥20% margin). Protected retraining threshold ($N \ge 20$ events). Artisan human-in-the-loop sovereign approval. | Reinforcement learning pricing agents with regional competitor scraping, automated seasonal holiday adjustments, and automated retraining pipelines. |
| **AI Cataloging** | Google Gemini multimodal API integration with structured JSON schema validation and configurable timeouts. Transparently falls back to `MANUAL_DRAFT` (preserving raw artisan text without fabrication). | Fine-tuned Gemma-2B quantized on-device Edge AI running via ONNX Runtime / WebAssembly directly in the mobile browser. |
| **Offline Resilience** | Mobile localStorage & IndexedDB caching (`getCachedProducts`) for instant 0ms initial render; offline draft queue with persistent operation ID idempotency (`ProcessedOperation`) and batch synchronization via `/api/sync/batch`. | Background Web Workers with Service Worker sync (Workbox), CRDT-based multi-master conflict resolution. |
| **Market Linkage** | Direct Buyer-to-Artisan marketplace interface with enquiry/order workflows and ONDC / Beckn integration adapter prototype. | Full ONDC (Open Network for Digital Commerce) protocol adapter implementation with Beckn gateway integration. |

---

## 🔒 Security & Production Hardening Guarantees

1. **Strict Production Environment Validation**: At startup, if `ENVIRONMENT=production`, the application validates that:
   - `DEMO_MODE` is strictly `False` (demo bypasses are completely rejected).
   - `DATABASE_URL` is a valid PostgreSQL connection string (`sqlite` is strictly disallowed).
   - `JWT_SECRET_KEY` is set to an unpredictable, cryptographically strong secret (development defaults abort startup).
2. **Database Connection Pool Hardening**: For PostgreSQL, SQLAlchemy `QueuePool` is hardened with `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True` (to prevent stale dropped connections), and `pool_recycle=300`.
3. **Exact Currency Representation**: Product prices and cost breakdowns (`material_cost`, `labour_cost`, `packaging_cost`), order prices (`unit_price`, `total_price`), and pricing decisions are modeled as `NUMERIC(12, 2)` and calculated using Python's `Decimal` with non-negative `CheckConstraint` bounds.
4. **Seller Ownership Isolation**: All product modifications (`PATCH /api/products/{id}`), deletions (`DELETE /api/products/{id}`), and dynamic pricing decisions verify that `product.seller_id == current_user.id`. Cross-seller tampering returns `403 Forbidden`.
5. **Zero-PII Analytics**: Operational events (`SEARCH`, `VIEW`, `SAVE`) capture aggregate behavioral telemetry only. Customer phone numbers and delivery addresses are never leaked into the `events` table or public analytics endpoints.
6. **Inventory Integrity**: The order placement engine (`POST /api/marketplace/order`) operates within an atomic database transaction. If requested quantity exceeds available stock, the transaction aborts with `400 Bad Request` and stock is never allowed to drop below zero.

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `production`). Enforces strict checks in production. |
| `DEMO_MODE` | `true` | Allows demo accounts/seeding in development; MUST be `false` in production. |
| `DATABASE_URL` | `sqlite:///./artisan_ai.db` | SQLAlchemy connection string (`sqlite:///...` in dev; `postgresql://...` in prod). |
| `JWT_SECRET_KEY` | *(Dev fallback)* | Secret key for signing JWT tokens. Required 32+ character key in production. |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `1440` (24 Hours) | Token validity window |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins (comma-separated) |
| `GEMINI_API_KEY` | *(Optional)* | Google Gemini API key for live AI cataloging and AI market pricing |
| `AI_REQUEST_TIMEOUT_SECONDS` | `10.0` | Timeout threshold before fallback triggers |

---

## 🗄️ Database Migrations (Alembic)

Database schema evolution is managed with **Alembic**.

```bash
# Run latest migrations (creates all tables and constraints)
alembic upgrade head

# Create a new migration after updating models
alembic revision --autogenerate -m "describe_schema_change"

# Rollback one migration revision
alembic downgrade -1
```

> **Note on Production**: In production mode (`ENVIRONMENT=production`), the application does not rely on `Base.metadata.create_all()`. Instead, run `alembic upgrade head` as part of the deployment pipeline.

---

## 🚀 Step-by-Step Local Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL (for production) or SQLite (for local dev)

### 2. Backend Setup
```bash
# Navigate to project root
cd "Artisan-Ai"

# Create and activate virtual environment
python -m venv .venv
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Apply database migrations
alembic upgrade head

# Start backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger API documentation is available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
# In a new terminal tab, navigate to frontend
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 🧪 Automated Testing

The repository contains a 100% verified automated test suite covering every component of the platform architecture:

```bash
# Run the complete test suite from the repository root
.venv\Scripts\python.exe -m pytest backend/tests/ -v
```

### Test Coverage Summary (95/95 Passing):
- `test_p1_features.py`: **AI Fair Market Price Endpoint (`POST /api/ai/estimate-price`)**, password change token version invalidation (`token_version`), ONDC Beckn gateway adapter, seller analytics CSV export, request observability headers, auth sliding rate limiting, operation ID idempotency (`client_operation_id`), tenant isolation, and inventory restoration on order cancellation.
- `test_audit_improvements.py`: User registration/login, user password reset, product ownership isolation, order inventory concurrency, targeted user notifications, order delivery tracking status progression (`CONFIRMED` → `DELIVERED`), seller analytics endpoint, enquiry reply flow, and large base64 image support.
- `test_ai_catalog_production_purity.py`: 12 strict production purity tests verifying zero synthetic price/materials hallucinations, honest title derivation, and Gemini Flash 2.5 API integration contracts.
- `test_p0_security_fixes.py`: Authenticated password change with token version invalidation, rejection of unauthorized reset, sync decision ownership verification, non-existent product skip logic, custom image preservation, whitespace normalization, and registration constraints.
- `test_p0_p1_p2_architecture.py`: Cost floor calculations, dynamic surge calculation, AI catalog cost breakdown pipelines, automated smart pricing execution, admin auth requirements, dynamic safety metadata, and equilibrium guards.
- `test_production_database_foundation.py`: PostgreSQL URL normalization, strict production configuration validation, connection pool hardening (`pool_size=10`, `pre_ping=True`), exact `Decimal` / `NUMERIC(12, 2)` money calculations, check constraint enforcement, and fresh database Alembic migration.
- `test_trust_systems.py`: Artisan public profiles, profile updating, product search/filters, product review lists, targeted user notifications, and self-review restriction.
- `test_auth_audit_fixes.py`: AI catalog generation auth requirements, product translation authorization, ONDC confirm security, verified review enforcement, and contact detail sanitization.
- `test_image_enhancer.py`: Image background enhancer pipeline, fallback corner sampling, and honest fallback handling.
- `test_offline_audit_fixes.py`: Offline batch synchronization with item status reporting and cost basis preservation.
- `test_doc_spec_compliance.py`: Specification compliance for market endpoints, enquiry/order endpoints, ONDC adapter, and sync endpoints.
- `test_integration_phases.py`: Sales channels integration, AI provider abstraction, and marketplace adapter abstractions.
- `test_step1.py` - `test_step7.py`: Core baseline verification of health, catalog CRUD, multimodal AI, market events, intelligence scoring, pricing formulas, and offline client queue reconciliation.

---

## 🎯 Platform Demonstration & Verification Guide

Follow these 8 steps to demonstrate the complete, verified platform workflow:

1. **Secure Registration & Account Isolation**:
   - Open the web application at `https://dd8bq7j24onss.cloudfront.net` (or `http://localhost:5173`). Click the user account badge in the navbar.
   - Register a new Artisan or Connoisseur (Buyer) account with your own name, phone, craft, and location.
   - Each artisan enjoys multi-tenant security: products, pricing decisions, and catalog revenues remain strictly isolated to the authenticated seller.

2. **Multilingual AI Voice Cataloging & AI Market Price Estimation**:
   - In **Artisan Studio** (`SELL` mode), click **"AI Voice Catalog"**.
   - Speak or enter an artisan description in any regional Indian language (e.g., Telugu Kalamkari story, Hindi pottery narrative).
   - Click **"✨ Let AI Decide"** to invoke the **AI Fair Market Price Estimation Engine** (`POST /api/ai/estimate-price`), automatically analyzing product context, materials, and regional market demand.
   - Powered by **Google Gemini 2.5 Flash**, the system outputs an evocative title, rich cultural story, verified materials list, and transparent cost-floor calculation.
   - Edit any field and click **"Save & Publish Craft"** to maintain human-in-the-loop sovereign control.

3. **Buyer Marketplace Commerce & Targeted Delivery Alerts**:
   - Toggle the workspace switch from **Artisan Studio** to **Buyer Marketplace** (`BUY` mode).
   - Browse craft listings with regional filters (Andhra Pradesh, Bastar, Rajasthan, Karnataka) with **0ms instant initial rendering** powered by local cache.
   - Place an order for an artisan craft.
   - Switch back to **Artisan Studio** (`SELL` mode), locate the order under **Order Management**, and update the delivery status to `SHIPPED` or `DELIVERED`.
   - The ordering buyer immediately receives a **Real-Time Delivery Push Notification** in their account portal.

4. **Telemetry & Real-Time Market Events**:
   - In **BUY** mode, view crafts, save items to your wishlist, submit craft enquiries, and place orders.
   - Order placement executes within an atomic database transaction that decrements stock with concurrency protection.

5. **Closed-Loop Market Intelligence**:
   - Switch back to **Artisan Studio** (`SELL` mode).
   - Inspect the **"Regional Craft Demand"** widget: the demand index for interacted categories surges dynamically based on weighted consumer telemetry.
   - Review the **"AI Business Copilot"** card providing actionable pricing and inventory advice.

6. **Explainable Dynamic Pricing with Cost Floors**:
   - Select any product in your catalog.
   - Review the **"Explainable Dynamic Pricing"** interface:
     - **Cost Floor Guarantee**: Strict cost basis (Material + Labour + Packaging) + guaranteed ≥ 20% margin.
     - **Bounded Demand Surge**: Dynamic adjustment strictly bounded within non-exploitative limits.
     - **Artisan Final Authority**: Click **"Accept Recommendation"** or **"Keep Current Price"** — prices never update without explicit artisan consent.

7. **Multi-Seller Data Protection & Native Language Preservation**:
   - If an artisan inspects a piece crafted by another creator, editing forms and pricing actions are disabled with clear ownership indicators.
   - Multi-language selectors protect native script labels (`notranslate`, `translate="no"`) during full-page browser translations.

8. **Rural Offline First Synchronization**:
   - In the top navbar, toggle the network control to **Offline Cache**.
   - Draft a craft or approve a price recommendation during simulated rural network outages.
   - Reconnect to the cloud: the client batch queue automatically reconciles via `POST /api/sync/batch` with persistent operation ID idempotency (`client_operation_id`).

---

## 📜 License & Acknowledgments

Engineered to empower traditional Indian artisans and handloom communities with transparent, ethical, and explainable artificial intelligence.
