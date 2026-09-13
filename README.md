# Artisan AI: AI-Driven Market Linkage & Smart Cataloging for Marginalized Artisans

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Problem Statement ID](https://img.shields.io/badge/Problem%20Statement-26090-blue.svg)](https://www.sih.gov.in/)
[![Theme](https://img.shields.io/badge/Theme-Heritage%20%26%20Culture-green.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF.svg?logo=vite)](https://vitejs.dev)
[![AWS Elastic Beanstalk](https://img.shields.io/badge/AWS%20Elastic%20Beanstalk-v1.1.6%20(t3.small)-FF9900.svg?logo=amazon-aws)](https://dd8bq7j24onss.cloudfront.net)
[![AWS S3 + CloudFront CDN](https://img.shields.io/badge/AWS%20CloudFront-Live%20CDN-232F3E.svg?logo=amazon-aws)](https://dd8bq7j24onss.cloudfront.net)
[![Test Suite](https://img.shields.io/badge/Tests-78%2F78%20Passing-brightgreen.svg)]()

Artisan AI is a production-grade digital marketplace, multimodal smart cataloging engine, live delivery tracking system, and explainable business intelligence copilot designed for rural and marginalized Indian artisans. The platform eliminates digital literacy barriers by combining **Voice-First Multilingual Cataloging (Hindi, Telugu, Tamil, Bengali, English)**, **Parallel Multimodal Gemini Vision (`POST /api/ai/process-catalog`)**, **Scikit-Learn ML Demand Forecasting Engine (`RandomForestRegressor`)**, **Real-Time Live Market Research & Comparables Intelligence**, **Explainable Dynamic Pricing with Sovereign Cost Floor Protection**, **Real-Time Targeted Buyer Delivery Notifications**, **Instant Mobile Cache & Offline Batch Synchronization**, and **Enterprise AWS Cloud Infrastructure (Elastic Beanstalk t3.small + 2GB Swap + Classic ELB Cross-Zone + S3 CloudFront CDN)**.

---

## 🏛️ System Architecture

```text
                                   ┌─────────────────────────────────────────┐
                                   │        ARTISAN / BUYER CLIENT           │
                                   │        React 19 + Vite PWA              │
                                   │   (AWS CloudFront CDN Edge Delivery)    │
                                   │  • Dual-Mode: SELL (Artisan) ↔ BUY      │
                                   │  • Voice Audio & Multilingual Input     │
                                   │  • 0ms Instant Cache / Offline Sync     │
                                   └────────────────────┬────────────────────┘
                                                        │ HTTPS (TLS 1.3)
                                                        ▼
                                   ┌─────────────────────────────────────────┐
                                   │     AWS CLOUDFRONT CDN (Global Edge)    │
                                   │      Origin Timeout: 60s | HTTP/2       │
                                   └────────────────────┬────────────────────┘
                                                        │
                                                        ▼
                                   ┌─────────────────────────────────────────┐
                                   │       AWS CLASSIC LOAD BALANCER         │
                                   │   Cross-Zone Load Balancing: ENABLED    │
                                   │     Idle Connection Timeout: 120s       │
                                   └────────────────────┬────────────────────┘
                                                        │
                                                        ▼
                                   ┌─────────────────────────────────────────┐
                                   │       NGINX REVERSE PROXY (AL2023)      │
                                   │   proxy_read_timeout 120s | Port 8000   │
                                   └────────────────────┬────────────────────┘
                                                        │
                                                        ▼
                                   ┌─────────────────────────────────────────┐
                                   │       AWS ELASTIC BEANSTALK (v1.1.6)    │
                                   │      EC2 t3.small (2 vCPU, 2GB RAM)     │
                                   │   + 2GB Dedicated Linux Swap Partition  │
                                   │    FastAPI + Gunicorn Uvicorn Worker    │
                                   └──────────────┬──────────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
     ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
     │  PARALLEL AI ENGINE    │       │   ML DEMAND ENGINE     │       │   MARKET RESEARCH      │
     │  • Google Gemini Flash │       │  • scikit-learn        │       │  • Serper / DDG Engine │
     │  • Multimodal Vision   │       │  • RandomForestRegressor│      │  • 5 Live Comparables  │
     │  • Cultural Heritage   │       │  • Category Elasticity │       │  • Real Price Medians  │
     │  • Parallel in ~7.5s   │       │  • Model Info & Retrain│       │  • Confidence Scoring  │
     └───────────┬────────────┘       └───────────┬────────────┘       └───────────┬────────────┘
                 │                                │                                │
                 └────────────────────────────────┼────────────────────────────────┘
                                                  ▼
                                     ┌────────────────────────┐
                                     │  EXPLAINABLE PRICING   │
                                     │ • Floor: Cost + >=20%  │
                                     │ • Bounded Demand Surge │
                                     │ • Decimal Money Math   │
                                     │ • Final Sovereign Vote │
                                     └────────────┬───────────┘
                                                  │
                                                  ▼
                                     ┌────────────────────────┐
                                     │  TRANSACTIONAL STORAGE │
                                     │  • RDS PostgreSQL /    │
                                     │    SQLite fallback     │
                                     │  • SQLAlchemy QueuePool│
                                     │  • Alembic Migrations  │
                                     │  • Exact NUMERIC(12,2) │
                                     └────────────────────────┘
```

---

## 📊 Comprehensive Feature & Implementation Matrix

| Dimension | Production Implementation (Live on AWS) | Architectural Impact |
| :--- | :--- | :--- |
| **Cloud Hosting & CDN** | **AWS CloudFront CDN** (`https://dd8bq7j24onss.cloudfront.net`) delivering optimized React 19 SPA assets + **AWS Elastic Beanstalk** (`artisan-ai-backend-prod`) running FastAPI on Python 3.12. | Instant global TTFB, zero blocking startup spinners, high availability. |
| **Compute & Memory Stability** | **EC2 `t3.small`** (2 vCPU, 2 GB RAM) with **2 GB Dedicated Linux Swapfile** via `.ebextensions/01_swap.config`. | Eliminates Linux OOM SIGKILL failures permanently; provides 4 GB effective memory headroom. |
| **High-Performance Load Balancing** | **Classic ELB with `CrossZoneLoadBalancing: true`** and 120s idle timeout; Nginx `proxy_read_timeout 120s`. | Eliminates 502/504 gateway timeouts across multi-AZ routing. |
| **Multimodal AI Smart Cataloging** | **Parallel Gemini Vision + Market Intelligence** (`POST /api/ai/process-catalog`) executing concurrently via `asyncio.gather`. Response time: **~7.5 seconds**. | Artisans upload a photo or speak; system outputs catalog title, craft story, materials, and fair market price. |
| **Market Comparables Intelligence** | **Live Competitive Pricing Provider** returning 5 comparable listings with titles, prices, source marketplaces (Amazon, Etsy, Craftsvilla), and similarity scores. | Real-time market anchoring without manual search friction. |
| **ML Demand Forecasting Engine** | **`scikit-learn` `RandomForestRegressor`** (`POST /api/ml/predict-demand`, `GET /api/ml/model-info`, `POST /api/ml/retrain`) with $N \ge 20$ event training threshold. | Predicts category demand velocity [0–100] and elasticity based on telemetry. |
| **Explainable Sovereign Dynamic Pricing** | **Cost-Floor Protection**: Material + Labour + Packaging + $\ge 20\%$ minimum margin guaranteed. Bounded demand multipliers. Human-in-the-loop approval. | Protects artisans against exploitative underpricing while capitalizing on demand surges. |
| **Targeted Buyer Delivery Alerts** | **Real-Time Order Tracking**: Order status transitions (`CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`) trigger targeted notifications to the specific buyer. | Live transparency between artisan and buyer. |
| **Authentication & Tenant Isolation** | Lightweight JWT tokens with PBKDF2 password hashing; token versioning (`token_version`) for instant session revocation; strict seller isolation (`403 Forbidden` on foreign crafts). | Zero multi-tenant cross-contamination. |
| **Exact Money Representation** | Currency represented as exact `NUMERIC(12, 2)` and Python `Decimal` arithmetic with non-negative constraints. | Zero IEEE-754 floating-point rounding drift. |
| **Inventory Concurrency** | Atomic single-transaction conditional stock updates (`WHERE stock >= requested_quantity`). | Guaranteed zero overselling or negative stock. |
| **Offline Resilience & PWA** | Client-side IndexedDB/localStorage caching for **0ms instant initial paint**; idempotent offline queue (`client_operation_id`) and batch synchronization (`POST /api/sync/batch`). | Seamless operation in low-connectivity rural handloom clusters. |
| **ONDC & Digital Commerce** | Protocol adapter prototype for Open Network for Digital Commerce (`/api/ondc/search`, `/api/ondc/init`, `/api/ondc/confirm`). | Ready for national e-commerce discovery on Beckn protocol. |

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

### Test Coverage Summary (78/78 Passing):
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
