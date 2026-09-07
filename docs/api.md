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

## 🌐 ONDC Protocol Prototype (`/api/ondc`)

- `POST /api/ondc/search`: Beckn-compliant search query
- `POST /api/ondc/select`: Item selection and stock check
- `POST /api/ondc/init`: Order initialization
- `POST /api/ondc/confirm`: Order confirmation
