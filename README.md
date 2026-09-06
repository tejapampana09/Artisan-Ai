# Artisan AI: AI-Driven Market Linkage & Smart Cataloging for Marginalized Artisans

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Problem Statement ID](https://img.shields.io/badge/Problem%20Statement-26090-blue.svg)](https://www.sih.gov.in/)
[![Theme](https://img.shields.io/badge/Theme-Heritage%20%26%20Culture-green.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF.svg?logo=vite)](https://vitejs.dev)
[![Test Suite](https://img.shields.io/badge/Tests-13%2F13%20Passing-brightgreen.svg)]()

Artisan AI is a production-grade digital marketplace, smart cataloging engine, and business intelligence copilot designed for rural and marginalized Indian artisans. The platform eliminates digital literacy barriers by combining **Voice-First Multilingual Cataloging (Hindi, Telugu, Tamil, Bengali, English)**, **Explainable Dynamic Pricing with Cost Floor Protection**, **Closed-Loop Real-Time Demand Intelligence**, **Atomic Concurrency-Safe Inventory Management**, and **Zero-Downtime Offline First PWA Synchronization**.

---

## 🏛️ System Architecture

```text
                                  ┌────────────────────────────────┐
                                  │   ARTISAN / BUYER CLIENT       │
                                  │      React 19 + Vite PWA       │
                                  │  • Dual-Mode (SELL ↔ BUY)      │
                                  │  • Voice Audio Recording       │
                                  │  • IndexedDB / Local Queue     │
                                  └───────────────┬────────────────┘
                                                  │ HTTP + JWT Bearer
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │      FASTAPI MONOLITH          │
                                  │  • Config & CORS Security      │
                                  │  • JWT Auth & Seller Isolation │
                                  │  • Rate Limiting & Validation  │
                                  └───────────────┬────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
    ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
    │     CATALOG ENGINE     │       │    ANALYTICS ENGINE    │       │     AI INTEGRATION     │
    │  • Product CRUD        │       │  • Weighted Scoring    │       │  • Google Gemini Live  │
    │  • Seller Ownership    │       │  • Category Surges     │       │  • Vision + Multimodal │
    │  • Margin Verification │       │  • Zero-PII Aggregates │       │  • Heuristic Fallback  │
    └────────────┬───────────┘       └────────────┬───────────┘       └────────────┬───────────┘
                 │                                │                                │
                 └────────────────────────────────┼────────────────────────────────┘
                                                  ▼
                                     ┌────────────────────────┐
                                     │  EXPLAINABLE PRICING   │
                                     │ • Floor: Cost + 20%    │
                                     │ • Dynamic Surge: Bounded│
                                     │ • Final Decision: Human│
                                     └────────────┬───────────┘
                                                  │
                                                  ▼
                                     ┌────────────────────────┐
                                     │  TRANSACTIONAL STORAGE │
                                     │  • Orders (Atomic Tx)  │
                                     │  • Enquiries (Privacy) │
                                     │  • Products & Users    │
                                     │  (SQLite MVP / PG Ready│
                                     └────────────────────────┘
```

---

## 📊 Currently Implemented vs Future Scalability

| Dimension | Currently Implemented (SIH Working MVP) | Future Scalability Architecture (Phase 2 Roadmap) |
| :--- | :--- | :--- |
| **Authentication** | Lightweight JWT tokens with PBKDF2-HMAC password hashing; automatic demo provisioning with strict seller ownership checks. | Multi-tenant OAuth2/OIDC, Phone OTP via SMS gateway (Twilio/Gupshup), DigiLocker artisan ID verification. |
| **Database & ORM** | SQLite with SQLAlchemy 2.0, relational foreign keys, column check constraints, and indexed lookups. | Managed PostgreSQL (AWS RDS / Supabase) with PgBouncer connection pooling and Read Replicas. |
| **Concurrency & Orders** | Atomic single-transaction stock checks and decrements; negative stock strictly prevented (`CheckConstraint`). | Distributed transactional locks via Redis/Redlock and Celery worker queues for high-velocity flash sales. |
| **Data Privacy** | Public analytics events stripped of all PII; customer phone and address stored strictly in protected `Order` and `Enquiry` tables. | Column-level database encryption (pghash/AES-256), automated data retention policies, and GDPR/DPDP compliant anonymization. |
| **Market Intelligence** | Weighted event scoring (`ORDER` 5x, `ENQUIRY` 3x, `SAVE` 2x, `VIEW` 1x, `SEARCH` 0.5x) calculating category demand indices and surge multipliers. | Clickhouse/BigQuery OLAP streaming pipeline with Kafka ingestion for real-time national trend analysis. |
| **Dynamic Pricing** | Deterministic formula: Cost Basis Floor (Material + Labour + Packaging + 20% margin) + Bounded Surge Factor [0.95, 1.15]. Artisan human-in-the-loop approval. | Reinforcement learning pricing agents with regional competitor scraping and automated seasonal holiday adjustments. |
| **AI Cataloging** | Google Gemini multimodal integration with structured JSON schema validation, configurable timeouts, and localized Indian heuristic fallback. | Fine-tuned Gemma-2B quantized on-device Edge AI running via ONNX Runtime / WebAssembly directly in the mobile browser. |
| **Offline Resilience** | Full client-side offline draft queue with optimistic UI updates and batch reconciliation endpoint (`/api/sync/batch`). | Background Web Workers with Service Worker sync (Workbox), CRDT-based multi-master conflict resolution. |
| **Market Linkage** | Direct Buyer-to-Artisan marketplace interface with enquiry and order workflows. | Full ONDC (Open Network for Digital Commerce) protocol adapter implementation with Beckn gateway integration. |

---

## 🔒 Security & Privacy Guarantees

1. **Seller Ownership Isolation**: All product modifications (`PATCH /api/products/{id}`), deletions (`DELETE /api/products/{id}`), and dynamic pricing decisions (`POST /api/pricing/decisions`) verify that `product.seller_id == current_user.id`. Cross-seller tampering returns `403 Forbidden`.
2. **Zero-PII Analytics**: Operational events (`SEARCH`, `VIEW`, `SAVE`) capture aggregate behavioral telemetry only. Customer phone numbers and delivery addresses are never leaked into the `events` table or public analytics endpoints.
3. **Inventory Integrity**: The order placement engine (`POST /api/marketplace/order`) operates within an atomic database transaction. If requested quantity exceeds available stock, the transaction aborts with `400 Bad Request` and stock is never allowed to drop below zero.

---

## 🛠️ Technology Stack

- **Backend**: FastAPI 0.110+, Python 3.12, SQLAlchemy 2.0, Pydantic v2, PyJWT, Passlib, Uvicorn
- **Frontend**: React 19, Vite 8.2, Tailwind CSS v4, Lucide React Icons
- **Offline & PWA**: Custom Offline Context, LocalStorage / IndexedDB event queue, Batch Sync Service
- **Testing & Quality**: Pytest 9.1, HTTPX, SQLite in-memory / file fixtures

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `staging`, `production`) |
| `DATABASE_URL` | `sqlite:///./artisan_ai.db` | SQLAlchemy connection string |
| `JWT_SECRET_KEY` | *(Random 32-byte secret)* | Secret key for signing JWT tokens |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `1440` (24 Hours) | Token validity window |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins (comma-separated or `*`) |
| `GEMINI_API_KEY` | *(Optional)* | Google Gemini API key for live AI cataloging |
| `AI_REQUEST_TIMEOUT_SECONDS` | `10.0` | Timeout threshold before fallback triggers |

---

## 🚀 Step-by-Step Local Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm

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

# Start backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The interactive Swagger API documentation will be available at: `http://127.0.0.1:8000/docs`

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

The repository contains an end-to-end automated test suite verifying every stage of the system architecture:

```bash
# Run the complete test suite from the repository root
.venv\Scripts\python.exe -m pytest backend/tests/ -v
```

### Test Coverage Summary:
- `test_audit_improvements.py`: JWT Auth registration/login, multi-seller 403 authorization isolation, atomic inventory decrement & negative stock prevention, and zero-PII data privacy.
- `test_step1.py`: Health, readiness checks, and unified user dual-mode toggle.
- `test_step2.py`: Product catalog CRUD lifecycle and cost margin validation.
- `test_step3.py`: Multimodal AI catalog generation, draft lifecycle, and human review approval.
- `test_step4.py`: Buyer marketplace interactions and event recording.
- `test_step5.py`: Closed-loop market intelligence, weighted demand scoring, and regional opportunity generation.
- `test_step6.py`: Explainable dynamic pricing formulas, cost floors, surge caps, and artisan approval.
- `test_step7.py`: Offline client queue reconciliation and batch data synchronization.

---

## 🎯 SIH 2026 Judge Demonstration Guide

Follow these 8 steps to demonstrate the complete, verified functionality:

1. **Account & Role Isolation**:
   - Open the web application. Click on the user profile pill in the navbar.
   - Observe the pre-provisioned demo artisan account (**Lakshmi Devi — Kalamkari Specialist**).
   - Test creating an account or logging in as another seller to observe strict data isolation.

2. **AI Voice Catalog Studio**:
   - In **SELL** mode, click **"+ AI Voice Studio"**.
   - Select a craft photo and speak or select an Indian artisan prompt (e.g., Telugu Kalamkari story).
   - Watch the AI generate a rich cultural title, craft narrative, tags, and itemized cost breakdown.
   - Edit any field and click **"Approve & Publish Craft"** to demonstrate human-in-the-loop control.

3. **Buyer Commerce View**:
   - Toggle the navbar switch from **SELL** to **BUY**.
   - Browse the live craft marketplace with regional filters (Andhra Pradesh, Odisha, Rajasthan).
   - View detailed craft stories and material certifications.

4. **Market Telemetry Generation**:
   - In **BUY** mode, view crafts, save favorites, submit enquiries, and place orders.
   - Note that order submission prompts for delivery details and instantly decrements inventory in real time.

5. **Closed-Loop Market Intelligence**:
   - Switch back to **SELL** mode.
   - Observe the **"Regional Craft Demand"** widget: the demand score for the interacted category has dynamically surged based on real weighted signals!
   - View the **"AI Business Copilot"** card outlining specific pricing and stock recommendations.

6. **Explainable Dynamic Pricing**:
   - Click on any product card in the catalog.
   - Scroll to the **"Explainable Dynamic Pricing"** section:
     - **Min Safe Price Floor**: Displays exact cost basis (Material + Labour + Packaging) + guaranteed ≥ 20% margin.
     - **Demand Surge Factor**: Derived from live market event weightings.
     - **Artisan Final Authority**: Click **"Accept New Price"** or **"Keep Current Price"** — prices never update without the artisan's explicit consent.

7. **Multi-Seller Security**:
   - Notice that if viewing a product belonging to another artisan, editing and pricing decision buttons are automatically locked with a clear permission banner.

8. **Offline Resilience Simulation**:
   - In the top banner, click **"Simulate Offline Mode"**.
   - Create a new craft draft or accept a price recommendation while disconnected from the cloud.
   - The action is safely stored in the local client queue.
   - Click **"Reconnect to Cloud"**: the batch sync automatically pushes all pending drafts and decisions to the server.

---

## 📜 License & Acknowledgments

Developed for the **Smart India Hackathon 2026** under Problem Statement ID **26090** (*Heritage & Culture*). Designed to empower the traditional artisans and handloom weavers of India with equitable, transparent artificial intelligence.
