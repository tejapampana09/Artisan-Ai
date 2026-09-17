# 📡 Artisan AI — API Reference

The Artisan AI API is built with FastAPI. All endpoints are prefixed with `/api`.

Interactive OpenAPI documentation is available at `/docs` when running the backend.

---

## 🔐 Authentication (`/api/auth`)

All artisan operations require a JWT Bearer token in the `Authorization` header:
`Authorization: Bearer <token>`

### `POST /api/auth/register`
Register a new artisan or buyer account.
- **Request Body**:
  ```json
  {
    "name": "Artisan Name",
    "email": "artisan@example.com",
    "phone": "+91 9876543210",
    "password": "secure_password",
    "role": "ARTISAN",
    "craft": "Kalamkari",
    "location": "Machilipatnam, AP"
  }
  ```
- **Response**: `201 Created` with `access_token`, `token_type`, and `user` object.

### `POST /api/auth/login`
Authenticate with email or phone number.
- **Request Body**:
  ```json
  {
    "email_or_phone": "artisan@example.com",
    "password": "secure_password"
  }
  ```
- **Response**: `200 OK` with `access_token` and `user` profile.

### `GET /api/auth/me`
Retrieve currently authenticated user profile.
- **Headers**: `Authorization: Bearer <token>`

### `POST /api/auth/change-password`
Update password with token invalidation.

---

## 🎨 Products & Marketplace (`/api/products`)

### `GET /api/products`
List published craft products with optional filtering.
- **Query Params**:
  - `category`: Filter by craft category (e.g., `Kalamkari`, `Wooden Toys`)
  - `status`: Filter by lifecycle state (`PUBLISHED`, `DRAFT`, etc.)
  - `seller_id`: Filter by specific artisan

### `GET /api/products/{id}`
Retrieve complete product details, craft story, materials, and pricing.

### `POST /api/products` (Authenticated)
Create a new product listing.
- **Request Body**: Title, description, craft_story, category, materials, price, stock, cost breakdown (`material_cost`, `labour_cost`, `packaging_cost`).

### `PATCH /api/products/{id}` (Authenticated)
Update product information or lifecycle status.

---

## 🤖 AI Cataloging Studio (`/api/ai/catalog`)

### `POST /api/ai/catalog/process`
Process voice description and craft photos using Google Gemini Multimodal models.
- **Request Body**:
  ```json
  {
    "voice_description": "Hand-painted silk scarf with Tree of life in vegetable dyes",
    "language": "en",
    "category_hint": "Kalamkari",
    "material_cost": 300,
    "labour_cost": 400,
    "packaging_cost": 50
  }
  ```
- **Response**: AI-generated draft title, cultural craft story, materials, suggested fair price with protected 20% margin, and editable draft tags.

### `POST /api/ai/catalog/approve` (Authenticated)
Verify and publish an AI-generated draft into the live catalog.

---

## 💰 Explainable Dynamic Pricing (`/api/products/{id}/price-*`)

### `GET /api/products/{id}/price-recommendation`
Retrieve an explainable price calculation factoring in:
- Production cost basis (material + labour + packaging)
- 20% minimum non-negotiable fair margin floor
- Real-time buyer market demand multiplier

### `POST /api/products/{id}/price-decision` (Authenticated)
Artisan accepts or rejects the recommended price.
- **Request Body**: `{"decision": "ACCEPT"}` or `{"decision": "REJECT"}`

---

## 📊 Market Intelligence (`/api/market` & `/api/seller`)

### `GET /api/market/demand`
Real-time category demand indices derived from aggregated buyer searches, views, and enquiries.

### `GET /api/seller/dashboard` (Authenticated)
Artisan seller dashboard metrics: total revenue, units sold, order status breakdown, and product views.

### `GET /api/seller/copilot-insight` (Authenticated)
Context-aware business recommendations for the logged-in artisan.

---

## 🔄 Offline Synchronization (`/api/sync`)

### `POST /api/sync/batch` (Authenticated)
Reconciles client-side offline queued operations (craft creations and pricing approvals) created during rural connectivity dropouts.

---

## 🌐 ONDC Retail Seller-Side Integration (`/api/ondc` & `/ondc`)

- **Protocol**: Beckn Protocol v1.2 (Retail)
- **Supported Domains**: `ONDC:RET12` (Fashion / Handloom - Default Primary), `ONDC:RET15` (Home & Decor / Handicrafts)
- **Inbound Security**: RFC 8032 Ed25519 signing + BLAKE-512 digest verification via `ONDCSubscriberRegistry`. `ONDC_ENFORCE_AUTH=false` for local development, `true` for staging/production.
- **Endpoints**:
  - `POST /ondc/search` & `POST /api/ondc/search`: Beckn v1.2 discovery endpoint. Returns immediate synchronous `ACK` and dispatches signed background `/on_search` callback to `bap_uri`.
  - `POST /api/ondc/catalog/query`: Synchronous catalog search query for local diagnostic verification.
  - `GET /api/ondc/status`: Honest integration health, supported domains, participant configuration, and verification state.
  - `POST /api/ondc/select`: [Deprecated Prototype] Quotation mock.
  - `POST /api/ondc/init`: [Deprecated Prototype] Order drafting mock.
  - `POST /api/ondc/confirm`: [Deprecated Prototype] Order confirmation mock.
- **Demo Status**: *"ONDC Retail seller-side discoverability foundation implemented; live network verification pending participant onboarding."*

