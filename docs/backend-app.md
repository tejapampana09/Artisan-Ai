# Backend App Guide

This document explains every Python module under `backend/app` and how requests move through the FastAPI backend.

## 1. Runtime Overview

The backend is a FastAPI application using:

- SQLAlchemy for database models and sessions
- Pydantic for request and response validation
- JWT bearer tokens for authentication
- SQLite for local development by default
- PostgreSQL for production deployments
- Gemini integration for optional AI features

The application starts in `backend/app/main.py`.

```text
Client
  -> FastAPI route
  -> authentication dependency
  -> service or database query
  -> SQLAlchemy model
  -> Pydantic response
```

## 2. Core Modules

### `backend/app/__init__.py`

Package marker for the backend application. It contains no business logic.

### `backend/app/main.py`

Application entry point.

Responsibilities:

- Creates database tables at startup.
- Applies compatibility columns for existing SQLite databases.
- Creates the FastAPI application.
- Configures CORS.
- Adds request ID and processing-time headers.
- Registers the active routers.
- Exposes health, readiness, and current-user endpoints.

Important endpoints:

- `GET /api/health`: basic application health.
- `GET /api/ready`: database readiness check.
- `GET /api/me`: authenticated user details.
- `PATCH /api/me/mode`: switches between `SELL` and `BUY` modes.

The ONDC router is intentionally not registered. Its source files remain in the repository, but ONDC endpoints are currently inactive.

### `backend/app/config.py`

Central environment configuration.

It loads `.env` values and defines:

- `DATABASE_URL`
- `ENVIRONMENT`
- `DEMO_MODE`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS`
- `GEMINI_API_KEY`
- `AI_REQUEST_TIMEOUT_SECONDS`

Production safeguards reject unsafe configuration such as:

- Demo mode enabled in production
- SQLite used in production
- Missing or predictable JWT secrets

### `backend/app/database.py`

Database engine and session setup.

Main responsibilities:

- Builds SQLite or PostgreSQL SQLAlchemy engines.
- Uses connection pooling and health checks for PostgreSQL.
- Falls back to local SQLite in non-production when remote PostgreSQL is unreachable.
- Defines `Base` for model declarations.
- Defines `SessionLocal` for request sessions.
- Provides `get_db()` for FastAPI dependency injection.
- Adds missing compatibility columns to old SQLite databases.

Local default:

```env
DATABASE_URL=sqlite:///./artisan_ai.db
```

Production should use PostgreSQL.

### `backend/app/models.py`

Defines the SQLAlchemy database tables and relationships.

Main models:

- `User`: account, role, profile, authentication version, and mode.
- `Product`: catalog item, seller, price, stock, costs, images, translations, and status.
- `Order`: buyer order, quantity, prices, delivery address, and fulfillment status.
- `Enquiry`: buyer question or lead connected to a product.
- `Review`: verified buyer review linked to a delivered order.
- `Notification`: targeted user notification.
- `Event`: sanitized buyer activity such as view, save, search, enquiry, or order.
- `PricingDecision`: price recommendation audit record.
- `ProcessedOperation`: offline-sync idempotency record.

Relationships connect users, products, orders, enquiries, events, reviews, pricing decisions, and notifications.

### `backend/app/schemas.py`

Defines Pydantic validation contracts.

Schema groups include:

- Authentication and user profiles
- Product creation, updates, and responses
- Event telemetry
- Enquiries and replies
- Orders and status changes
- Pricing recommendations and decisions
- Seller dashboards
- Reviews and notifications
- Offline synchronization
- Buyer copilot requests and responses

Schemas validate incoming data and shape outgoing API responses.

### `backend/app/seed.py`

Provides idempotent sample product insertion for a specified seller. It is useful for local demos and test setup, not for production data generation.

## 3. AI Integrations

### `backend/app/integrations/ai/__init__.py`

Exports the AI provider classes for convenient imports.

### `backend/app/integrations/ai/base.py`

Defines the abstract `BaseAIProvider` contract.

The contract requires an asynchronous catalog-draft method. This allows the application to depend on a provider interface instead of a specific AI vendor.

### `backend/app/integrations/ai/gemini_provider.py`

Concrete Gemini provider implementation.

Responsibilities:

- Sends catalog-generation requests to Gemini.
- Parses structured catalog output.
- Calculates cost-based prices.
- Marks provenance and verification requirements.
- Falls back to a manual draft when AI credentials or upstream calls fail.

The active route-level AI behavior is primarily implemented in `services/ai_adapter.py`; this provider remains the formal integration abstraction.

### `backend/app/integrations/__init__.py`

Package marker for integration modules.

## 4. Marketplace Integrations

### `backend/app/integrations/marketplace/__init__.py`

Exports marketplace adapter implementations.

### `backend/app/integrations/marketplace/base.py`

Defines the marketplace adapter interface:

- Publish a product
- Update a product
- Remove a product
- Report synchronization status

### `backend/app/integrations/marketplace/internal_marketplace.py`

Represents the active direct Artisan AI marketplace channel.

It keeps the core catalog independent from external marketplace protocols.

### `backend/app/integrations/marketplace/mock_provider.py`

Provides explicitly labeled sandbox behavior for external channels such as the export hub.

It must not be presented as a real external marketplace integration.

## 5. API Routes

All route modules expose an `APIRouter`. `main.py` imports and registers the active routers.

### `backend/app/routes/__init__.py`

Package marker for API route modules.

### `backend/app/routes/auth.py`

Authentication endpoints under `/api/auth`.

Responsibilities:

- User registration
- Login
- Current-user lookup
- Password change
- Password reset behavior where enabled
- Authentication rate limiting

Uses `services/auth.py` for hashing, JWT handling, and authentication dependencies.

### `backend/app/routes/products.py`

Product catalog endpoints under `/api/products`.

Responsibilities:

- Create, read, update, and delete products
- Search and filter products
- Enforce seller ownership
- Allow controlled admin seller assignment
- Manage product lifecycle statuses
- Preserve image and cost information

### `backend/app/routes/ai_catalog.py`

AI catalog endpoints under `/api/ai`.

Responsibilities:

- Generate catalog drafts from artisan descriptions
- Approve and publish drafts
- Translate catalog text
- Estimate fair prices
- Preserve manual fallback behavior when live AI is unavailable

Delegates business logic to `services/ai_adapter.py`.

### `backend/app/routes/events.py`

Buyer activity and commerce workflows.

Endpoints include:

- `POST/GET /api/events`: record and list sanitized activity.
- `POST /api/marketplace/enquire`: create an enquiry.
- `GET /api/marketplace/enquiries`: list enquiries.
- `PUT /api/marketplace/enquiries/{id}/reply`: reply to an enquiry.
- `POST /api/marketplace/order`: create an order with atomic stock decrement.
- `GET /api/marketplace/orders`: list visible orders.
- `PATCH /api/marketplace/orders/{id}/status`: update fulfillment or cancel an order.
- `GET /api/marketplace/trending`: weighted trending products.
- `GET /api/recommendations`: personalized or cold-start recommendations.

Orders and enquiries also create notifications and can trigger automatic pricing.

### `backend/app/routes/intelligence.py`

Market intelligence and seller analytics.

Responsibilities:

- Category demand data
- Seller opportunities
- Seller copilot insight
- Seller dashboard metrics
- CSV analytics export
- Buyer copilot chat and live product search

Uses `services/demand_engine.py`, `services/pricing_engine.py`, and `services/ai_adapter.py`.

### `backend/app/routes/pricing.py`

Explainable pricing endpoints under `/api/products`.

Responsibilities:

- Return a price recommendation
- Accept or reject seller pricing decisions
- Toggle smart pricing
- Evaluate smart pricing for one product
- Run admin pricing cycles for all enabled products

Uses `services/pricing_engine.py` and records decisions for auditability.

### `backend/app/routes/sync.py`

Offline synchronization endpoints.

Responsibilities:

- Accept batches of offline product changes
- Synchronize pricing decisions
- Avoid duplicate operations with `ProcessedOperation`
- Preserve tenant ownership
- Report operation and job status

### `backend/app/routes/channels.py`

Sales-channel endpoints.

The active choices are:

- Internal Artisan AI marketplace
- Explicitly mocked export sandbox

ONDC is not exposed here because it was intentionally removed from the active application.

### `backend/app/routes/reviews.py`

Review endpoints.

Responsibilities:

- List product reviews
- Allow reviews only from buyers with delivered orders
- Prevent self-review and unauthorized review creation
- Notify sellers about new reviews

### `backend/app/routes/notifications.py`

Notification endpoints for the authenticated user.

Responsibilities:

- List notifications
- Mark individual notifications as read
- Keep notification access tenant-scoped

### `backend/app/routes/artisan.py`

Artisan profile endpoints.

Responsibilities:

- Public artisan profile lookup
- Product count and average rating calculation
- Derived verification information
- Authenticated profile updates

### `backend/app/routes/ondc.py`

Retained ONDC/Beckn prototype router.

It contains prototype search, select, init, and confirm endpoints, but `main.py` does not register this router. Therefore these endpoints are unreachable through the active app.

This file should be treated as dormant prototype code unless ONDC is intentionally reintroduced.

## 6. Services

### `backend/app/services/__init__.py`

Package marker for service modules.

### `backend/app/services/auth.py`

Authentication service layer.

Responsibilities:

- PBKDF2 password hashing and verification
- JWT creation and decoding
- Bearer token extraction
- Strict authenticated-user dependency
- Controlled demo-mode fallback
- Optional authentication dependency
- Token-version revocation after password changes

### `backend/app/services/ai_adapter.py`

Active AI business layer.

Responsibilities:

- Gemini model fallback sequence
- Catalog draft generation
- Honest manual draft fallback
- Buyer intent extraction
- Buyer explanation generation
- Catalog translation
- Fair-price estimation
- Decimal cost calculations
- Optional image-enhancement integration

The manual fallback preserves the artisan description and does not invent materials, heritage claims, or prices when required data is missing.

### `backend/app/services/demand_engine.py`

Market demand and seller opportunity engine.

Responsibilities:

- Aggregate event activity by craft category
- Apply event weights to buyer actions
- Calculate category demand shares
- Calculate live price benchmarks from published products
- Generate seller-specific opportunities
- Produce copilot guidance for stock, demand, and pricing

It calls the pricing engine for product-specific recommendations.

### `backend/app/services/pricing_engine.py`

Deterministic explainable pricing engine.

Calculation inputs include:

- Material, labour, packaging, and other costs
- Minimum margin percentage
- Category demand
- Live market benchmark range
- Current product price

Safety rules include:

- Minimum fair price protection
- Maximum upward adjustment
- Maximum downward adjustment
- Bounded demand factor
- Bounded market adjustment
- Equilibrium protection after an accepted or automatic price change

It also provides automatic pricing and creates `PricingDecision` audit rows.

### `backend/app/services/image_enhancer.py`

Image processing pipeline.

Responsibilities:

- Accept data URIs or image URLs
- Decode and validate images
- Attempt background removal with `rembg`
- Use a corner-sampling fallback when segmentation is unavailable
- Normalize lighting, color, contrast, and sharpness
- Compose a studio-style backdrop
- Return enhanced image data plus honest processing status

### `backend/app/services/ondc_adapter.py`

Standalone ONDC/Beckn transformation helper.

Main functions:

- `transform_product_to_ondc_item`
- `build_ondc_catalog`
- `handle_ondc_search`

It is currently source-only and is not part of the active request flow.

### `backend/app/services/rate_limiter.py`

In-memory sliding-window rate limiter.

It provides:

- Client identifier generation from request and user context
- Per-action request limits
- Protection for authentication, AI, and pricing endpoints

It is suitable for one-process development deployments. A distributed production deployment should use a shared limiter such as Redis.

## 7. Main Request Flows

### Authentication

1. Client calls registration or login in `routes/auth.py`.
2. `services/auth.py` hashes or verifies the password.
3. A JWT is returned.
4. Protected routes resolve the user through `get_current_user`.

### AI catalog creation

1. Artisan submits text, language, category, costs, and optional image.
2. `routes/ai_catalog.py` calls `services/ai_adapter.py`.
3. Gemini is attempted when configured.
4. Manual draft fallback is used when live AI is unavailable.
5. `image_enhancer.py` processes an image when possible.
6. The artisan verifies and publishes the product.

### Marketplace order

1. Buyer submits an order through `routes/events.py`.
2. Product ownership and self-purchase rules are checked.
3. Stock is decremented atomically only when enough stock exists.
4. An `Order` and sanitized `Event` are stored.
5. Targeted buyer and seller notifications are created.
6. Automatic pricing may be triggered.

### Demand and pricing

1. Buyer activity becomes `Event` rows.
2. `demand_engine.py` weights those events.
3. Published product prices form live category benchmarks.
4. `pricing_engine.py` calculates a bounded recommendation.
5. Seller decisions create `PricingDecision` audit rows.

### Offline synchronization

1. Frontend queues changes while offline.
2. `routes/sync.py` receives a batch.
3. `ProcessedOperation` prevents duplicate application.
4. Ownership checks prevent cross-seller updates.
5. The response reports each operation status.

## 8. Current Database Setup

For local development, use SQLite:

```env
ENVIRONMENT=development
DATABASE_URL=sqlite:///./artisan_ai.db
DEMO_MODE=false
```

For production, use PostgreSQL and set a strong JWT secret:

```env
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@host:5432/artisan_ai
JWT_SECRET_KEY=<long-random-secret>
DEMO_MODE=false
```

The current code intentionally falls back to SQLite outside production when a remote PostgreSQL connection is unavailable.

## 9. Current Disabled Features

ONDC is currently disabled from the running application:

- The ONDC router is not registered in `main.py`.
- ONDC marketplace event endpoints were removed from the active events router.
- ONDC is not listed as an active sales channel.
- Prototype ONDC files remain only as dormant source code.

## 10. Running the Backend

From the repository root:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

Useful URLs:

- API: `http://127.0.0.1:8001`
- Health: `http://127.0.0.1:8001/api/health`
- Readiness: `http://127.0.0.1:8001/api/ready`
- OpenAPI docs: `http://127.0.0.1:8001/docs`
