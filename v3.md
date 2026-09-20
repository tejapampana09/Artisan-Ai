# Artisan-AI V3 — Full System Architecture & Engineering Specification

**Version:** 3.0
**Status:** Architecture Freeze / Implementation Baseline
**Primary goal:** Build a secure, explainable, scalable AI-powered artisan marketplace with completely separated Buyer Marketplace, Artisan Studio, and Admin Console authentication domains.

> [!IMPORTANT]
> **Decoupled Architecture Clarification (Current vs. Historical)**:
> In the production implementation, the AI Catalog creation pipeline is strictly decoupled from the ML Demand Engine. Unpublished drafts use a neutral baseline demand factor ($1.0\times$) and zero synthetic events. ML Demand forecasting operates exclusively post-publication inside Seller Business / Market Intelligence, using authentic buyer telemetry (`VIEW`, `SAVE`, `ENQUIRY`, `ORDER`). Any historical mentions of synthetic event simulation during draft creation reflect discarded prototyping paths and are not present in the runtime codebase.

---

# 1. Product Vision

Artisan-AI is a digital marketplace designed to help artisans sell handmade products while providing AI-assisted:

* product catalog creation
* market research
* demand forecasting
* dynamic pricing recommendations
* business analytics
* order management
* customer communication

The platform has **three independent application experiences**:

```text
                    ARTISAN-AI
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   MARKETPLACE      ARTISAN STUDIO    ADMIN CONSOLE
      Buyer            Artisan            Admin
```

The fundamental V3 principle is:

> **Shared business data does not imply shared authentication.**

---

# 2. V3 Architectural Principles

## 2.1 Authentication isolation

Buyer, Artisan and Admin authentication are independent.

```text
Marketplace Login
       ≠
Studio Login
       ≠
Admin Login
```

There is no role switching.

There is no `active_mode`.

There is no "login once and become seller".

---

## 2.2 Server-side authorization

The frontend never determines access.

```text
Frontend protection
       +
Backend authorization
       +
Resource ownership
       +
Business rules
```

Backend is always authoritative.

---

## 2.3 Least privilege

Every account gets only the permissions required for its domain.

```text
BUYER
 └── marketplace permissions

ARTISAN
 └── studio permissions

ADMIN
 └── administration permissions
```

---

## 2.4 Source of truth

PostgreSQL is the authoritative source for:

* accounts
* products
* orders
* payments
* reviews
* pricing recommendations
* forecasts
* artisan verification
* audit records

AI/ML output is **never automatically treated as truth**.

---

## 2.5 Explainable AI

Every important AI/ML result should be traceable.

```text
Input
 ↓
Model
 ↓
Output
 ↓
Evidence / features
 ↓
Recommendation
```

---

## 2.6 Fail safely

If:

* AI fails
* market research is unavailable
* payment isn't verified
* model confidence is insufficient
* authorization fails

the system should **fail closed**, not invent data or grant access.

---

# 3. Complete System Architecture

```text
                         ┌───────────────────────┐
                         │       USERS           │
                         └───────────┬───────────┘
                                     │
               ┌─────────────────────┼─────────────────────┐
               │                     │                     │
               ▼                     ▼                     ▼
       ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
       │  Marketplace  │     │ Artisan Studio│     │ Admin Console │
       │    /shop      │     │    /studio    │     │    /admin     │
       └───────┬───────┘     └───────┬───────┘     └───────┬───────┘
               │                     │                     │
               ▼                     ▼                     ▼
       Marketplace Auth       Studio Auth           Admin Auth
               │                     │                     │
               └─────────────────────┼─────────────────────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │    API LAYER      │
                           │     FastAPI       │
                           └─────────┬─────────┘
                                     │
              ┌──────────────────────┼────────────────────────┐
              │                      │                        │
              ▼                      ▼                        ▼
        Commerce Domain        Artisan Domain          Governance Domain
              │                      │                        │
              ▼                      ▼                        ▼
           Orders                 Catalog                 Moderation
           Payments               Pricing                Users
           Reviews                Demand                 Verification
           Cart                   Analytics               Audit
           Enquiries              Notifications           System
              │                      │                        │
              └──────────────────────┼────────────────────────┘
                                     │
                   ┌─────────────────┼──────────────────┐
                   │                 │                  │
                   ▼                 ▼                  ▼
              PostgreSQL          Redis/Queue       Object Storage
                   │                 │                  │
                   └─────────────────┼──────────────────┘
                                     │
                                     ▼
                              AI / ML Gateway
                                     │
                  ┌──────────────────┼─────────────────┐
                  ▼                  ▼                 ▼
             Catalog AI       Market Research       ML Engine
                  │                  │                 │
                  ▼                  ▼                 ▼
              Gemini             Grounding         Forecasting
```

---

# 4. Application Layer

## 4.1 Marketplace

Route:

```text
/shop
```

Purpose:

> Customer-facing commerce application.

### Features

```text
Home
Search
Categories
Product Details
Cart
Checkout
Orders
Reviews
Enquiries
Profile
```

### Buyer capabilities

```text
REGISTER
LOGIN
GOOGLE_LOGIN

VIEW_PRODUCTS
SEARCH_PRODUCTS
ADD_TO_CART
CREATE_ORDER
PAY
VIEW_ORDER
CREATE_REVIEW
SEND_ENQUIRY
MANAGE_PROFILE
```

### Explicitly prohibited

```text
CREATE_PRODUCT
MODIFY_PRODUCT
VIEW_OTHER_ARTISAN_DATA
PRICING_ENGINE
DEMAND_ENGINE
ADMIN_PANEL
ARTISAN_ANALYTICS
```

---

# 5. Artisan Studio

Route:

```text
/studio
```

Purpose:

> Artisan business management workspace.

This is **not a seller mode**.

It is a separate application domain.

---

## 5.1 Studio authentication

```text
POST /api/studio/auth/login
POST /api/studio/auth/logout
POST /api/studio/auth/refresh
GET  /api/studio/auth/me
```

No public Studio registration.

Artisan account lifecycle:

```text
Application
    ↓
Admin verification
    ↓
Account creation
    ↓
Invitation
    ↓
Studio login
```

---

# 6. Artisan Studio Modules

```text
Studio
│
├── Dashboard
│
├── Products
│   ├── Create
│   ├── Edit
│   ├── Draft
│   ├── Publish
│   └── Archive
│
├── AI Catalog
│   ├── Generate title
│   ├── Generate description
│   ├── Extract attributes
│   └── Category suggestion
│
├── Market Research
│
├── Pricing
│   ├── Current price
│   ├── AI recommendation
│   ├── Market range
│   └── Accept/reject
│
├── Demand
│   ├── Forecast
│   ├── Trends
│   └── Confidence
│
├── Orders
│
├── Enquiries
│
├── Analytics
│
├── Notifications
│
└── Profile
```

---

# 7. Admin Console

Route:

```text
/admin
```

Purpose:

> Platform governance and operational control.

Authentication:

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
POST /api/admin/auth/refresh
GET  /api/admin/auth/me
```

No:

```text
/admin/register
/admin/google-login
```

---

# 8. Admin Responsibilities

```text
Admin
│
├── Artisan Management
│   ├── Applications
│   ├── Verification
│   ├── Approval
│   ├── Suspension
│   └── Activation
│
├── User Management
│
├── Product Moderation
│
├── Order Monitoring
│
├── Review Moderation
│
├── AI Monitoring
│
├── Analytics
│
├── System Health
│
└── Audit Logs
```

---

# 9. Authentication Architecture

## 9.1 Authentication domains

```text
MARKETPLACE
ARTISAN_STUDIO
ADMIN
```

Each session explicitly identifies its domain.

---

## 9.2 Marketplace token

```json
{
  "sub": "account_id",
  "auth_domain": "MARKETPLACE",
  "session_type": "BUYER",
  "token_version": 1,
  "exp": "..."
}
```

---

## 9.3 Studio token

```json
{
  "sub": "account_id",
  "auth_domain": "ARTISAN_STUDIO",
  "session_type": "STUDIO",
  "token_version": 1,
  "exp": "..."
}
```

---

## 9.4 Admin token

```json
{
  "sub": "account_id",
  "auth_domain": "ADMIN",
  "session_type": "ADMIN",
  "token_version": 1,
  "exp": "..."
}
```

---

# 10. Authorization Architecture

Every protected request follows:

```text
Request
 ↓
Authenticate token
 ↓
Validate signature
 ↓
Validate expiry
 ↓
Validate token version
 ↓
Validate auth domain
 ↓
Validate account status
 ↓
Validate role/permission
 ↓
Validate resource ownership
 ↓
Validate business rules
 ↓
Execute operation
```

Example:

```text
POST /api/studio/products
```

requires:

```text
Valid token
AND
auth_domain = ARTISAN_STUDIO
AND
session_type = STUDIO
AND
account_type = ARTISAN
AND
status = ACTIVE
```

Then product is automatically associated with:

```text
token.account_id
```

not a user-supplied arbitrary artisan ID.

---

# 11. Authorization Dependencies

Backend should have explicit dependencies:

```python
require_buyer()
require_artisan()
require_admin()
```

Potential future:

```python
require_permission("PRODUCT_APPROVE")
require_permission("USER_SUSPEND")
```

---

# 12. Account Model

V3 should eliminate:

```text
active_mode
```

Current conceptual model:

```text
User
├── role
└── active_mode
```

V3:

```text
Account
├── id
├── email
├── password_hash
├── account_type
├── status
├── token_version
├── created_at
└── last_login_at
```

Types:

```text
BUYER
ARTISAN
ADMIN
```

Statuses:

```text
PENDING
ACTIVE
SUSPENDED
DISABLED
```

---

# 13. Artisan Profile

```text
ArtisanProfile
├── id
├── account_id
├── business_name
├── description
├── contact_information
├── location
├── verification_status
├── verification_notes
├── verified_at
└── created_at
```

Verification:

```text
PENDING
UNDER_REVIEW
VERIFIED
REJECTED
SUSPENDED
```

---

# 14. Important Identity Rule

A buyer logging into Marketplace **does not become an artisan**.

There is no:

```text
BUYER → SELLER MODE
```

Instead:

```text
Marketplace Account
        │
        └── Buyer identity

Studio Account
        │
        └── Artisan identity
```

If the same real person eventually needs both experiences, that relationship can be explicitly modeled later. It must **never happen implicitly through role switching**.

---

# 15. Product Architecture

```text
Product
├── id
├── artisan_id
├── title
├── description
├── category
├── price
├── stock
├── status
├── created_at
├── updated_at
└── published_at
```

Statuses:

```text
DRAFT
AI_PROCESSING
PENDING_REVIEW
PUBLISHED
SUSPENDED
ARCHIVED
```

---

# 16. Product Ownership

Every product belongs to exactly one artisan.

```text
Product.artisan_id
        ↓
ArtisanProfile
        ↓
Account
```

Studio request:

```text
GET /api/studio/products
```

returns only:

```text
WHERE artisan_id = current_artisan_id
```

Admin can access across artisans.

Marketplace sees only:

```text
status = PUBLISHED
```

---

# 17. Product Publication Pipeline

```text
Artisan creates product
        ↓
DRAFT
        ↓
AI catalog processing
        ↓
PENDING_REVIEW
        ↓
Validation / moderation
        ↓
PUBLISHED
```

Do **not** make new products automatically published.

---

# 18. AI Catalog Architecture

```text
Artisan
   ↓
Product Input / Image
   ↓
AI Gateway
   ↓
Catalog AI
   ├── Title
   ├── Description
   ├── Attributes
   ├── Category
   └── Tags
   ↓
Validation
   ↓
Draft Product
```

AI output is always editable by the artisan.

---

# 19. AI Provenance

Every generated artifact should record:

```text
AIArtifact
├── id
├── entity_type
├── entity_id
├── task_type
├── input_hash
├── output
├── model_provider
├── model_name
├── model_version
├── confidence
├── source_metadata
├── created_at
```

This gives us:

* reproducibility
* debugging
* auditability
* model comparison

---

# 20. AI Gateway

Business logic must not directly depend on Gemini SDK everywhere.

Architecture:

```text
Application
      ↓
AI Gateway
      ↓
Provider Interface
      ↓
Gemini Provider
```

Future:

```text
Gemini
OpenAI
Other provider
Local model
```

without rewriting business logic.

---

# 21. Market Research

Pipeline:

```text
Product
 ↓
Market Research Request
 ↓
Grounded Search
 ↓
Evidence
 ↓
Validation
 ↓
Market Insight
```

Market insight:

```text
MarketInsight
├── product/category
├── observed_price_range
├── demand_signals
├── competitors
├── sources
├── evidence
├── confidence
├── retrieved_at
└── expiry
```

---

# 22. Grounding Rule

LLM-generated market information without evidence must not be represented as verified market data.

```text
Grounded
    ↓
usable

Ungrounded
    ↓
reject / mark unavailable
```

---

# 23. Demand Prediction Architecture

```text
Historical Orders
Product Views
Searches
Enquiries
Inventory
Price
Category
Seasonality
Market Signals
       ↓
Feature Pipeline
       ↓
ML Model
       ↓
Demand Forecast
```

---

# 24. Correct Forecast Target

If we claim:

> Predict next 7 days demand

then:

```text
Features at T
       ↓
Target = demand(T+1 ... T+7)
```

Not:

```text
Current orders
       ↓
Predict current orders
```

and not a synthetic target derived directly from the same feature.

---

# 25. ML Feature Store Concept

```text
DemandFeatures
├── product_id
├── snapshot_date
├── rolling_7d_orders
├── rolling_30d_orders
├── rolling_7d_views
├── rolling_30d_views
├── enquiries
├── inventory
├── current_price
├── category
├── season
└── market_signal
```

Target:

```text
future_7d_orders
```

---

# 26. ML Output

```text
DemandForecast
├── product_id
├── forecast_date
├── horizon_days
├── predicted_demand
├── lower_bound
├── upper_bound
├── confidence
├── model_version
└── generated_at
```

---

# 27. Pricing Engine

Pricing should combine:

```text
Current Price
+
Demand Forecast
+
Market Research
+
Inventory
+
Seasonality
+
Business Rules
```

Pipeline:

```text
Demand Model
      │
      ▼
Market Intelligence
      │
      ▼
Pricing Engine
      │
      ▼
Safety Constraints
      │
      ▼
Recommendation
      │
      ▼
Artisan Decision
```

---

# 28. Pricing Safety

Global pricing safety constraint:

```text
recommended_price
≤
current_price × 1.25
```

unless an explicitly approved future policy changes the limit.

The constraint must be applied **after all pricing calculations**, so no scenario can bypass it.

---

# 29. Pricing Recommendation

```text
PricingRecommendation
├── id
├── product_id
├── current_price
├── recommended_price
├── demand_score
├── market_low
├── market_high
├── adjustment_percentage
├── explanation
├── confidence
├── safety_cap
├── model_version
├── status
└── created_at
```

Status:

```text
GENERATED
ACCEPTED
REJECTED
EXPIRED
```

---

# 30. Explainable Pricing

Instead of:

> AI recommends ₹1,250.

Studio should show:

```text
Recommended Price: ₹1,150

Why?

• Demand forecast: High
• Recent sales trend: +18%
• Market range: ₹1,100–₹1,300
• Current price: ₹1,000
• Suggested increase: +15%
• Safety limit: +25%

Confidence: 87%
```

The artisan makes the final decision.

---

# 31. Commerce Architecture

```text
Buyer
 ↓
Browse
 ↓
Cart
 ↓
Checkout
 ↓
Order Draft
 ↓
Payment
 ↓
Verification
 ↓
Confirmed Order
 ↓
Fulfillment
 ↓
Delivered
 ↓
Review
```

---

# 32. Order Model

```text
Order
├── id
├── buyer_id
├── status
├── subtotal
├── shipping
├── total
├── payment_status
├── shipping_address
├── created_at
└── updated_at
```

Order items:

```text
OrderItem
├── order_id
├── product_id
├── artisan_id
├── quantity
├── unit_price
└── total
```

Store the purchase price at order time.

Do not dynamically recalculate historical order prices from the current Product price.

---

# 33. Payment Architecture

```text
Checkout
 ↓
Create payment intent/order
 ↓
Payment provider
 ↓
Provider response
 ↓
Backend verification
 ↓
Payment VERIFIED
 ↓
Order CONFIRMED
```

Never:

```text
Frontend
 ↓
"success"
 ↓
CONFIRMED
```

---

# 34. Payment Entity

```text
Payment
├── id
├── order_id
├── provider
├── provider_order_id
├── provider_payment_id
├── amount
├── currency
├── status
├── signature_verified
├── created_at
└── verified_at
```

Statuses:

```text
CREATED
PENDING
VERIFIED
FAILED
REFUNDED
```

---

# 35. Order State Machine

```text
PENDING_PAYMENT
      │
      ├── payment failed
      ▼
CONFIRMED
      ↓
PROCESSING
      ↓
SHIPPED
      ↓
DELIVERED
```

Exceptional:

```text
CANCELLED
REFUND_PENDING
REFUNDED
```

Only valid transitions are allowed.

---

# 36. Review Architecture

Eligibility:

```text
Buyer
 +
Own Order
 +
Order DELIVERED
 +
Product in Order
 +
No existing review
```

Then:

```text
Review
├── order_id
├── buyer_id
├── product_id
├── rating
├── comment
└── created_at
```

DB-level constraint:

```text
UNIQUE(order_id, product_id, buyer_id)
```

Application checks are not enough.

---

# 37. Enquiries

```text
Buyer
 ↓
Product
 ↓
Enquiry
 ↓
Artisan
 ↓
Reply
```

Entity:

```text
Enquiry
├── id
├── buyer_id
├── artisan_id
├── product_id
├── message
├── status
├── created_at
└── updated_at
```

Statuses:

```text
OPEN
RESPONDED
CLOSED
```

---

# 38. Notification Architecture

Use an event-driven model.

```text
Business Event
      ↓
Event / Queue
      ↓
Notification Service
      ├── In-app
      ├── Email
      └── Future channels
```

Examples:

```text
ORDER_CONFIRMED
ORDER_SHIPPED
ORDER_DELIVERED

PRODUCT_APPROVED
PRODUCT_REJECTED

PRICE_RECOMMENDATION_READY
DEMAND_FORECAST_READY

ARTISAN_VERIFIED
ARTISAN_SUSPENDED
```

---

# 39. Analytics

## Marketplace analytics

```text
Sales
Orders
Conversion
Popular products
Categories
Customer behavior
```

## Artisan analytics

```text
Revenue
Orders
Product performance
Demand
Price performance
Enquiries
Views
```

## Admin analytics

```text
GMV
Orders
Active buyers
Active artisans
Product count
Category performance
AI usage
Marketplace health
```

---

# 40. Event Architecture

Eventually:

```text
OrderService
     ↓
ORDER_CONFIRMED
     ↓
Event Bus
 ┌───┼──────┬──────────┐
 ▼   ▼      ▼          ▼
Notif Analytics Demand  Audit
```

For hackathon, a simple background-job/queue abstraction is sufficient.

---

# 41. Admin Audit System

Sensitive operations generate:

```text
AuditLog
├── id
├── actor_id
├── action
├── resource_type
├── resource_id
├── before_state
├── after_state
├── reason
├── ip_metadata
└── timestamp
```

Examples:

```text
ARTISAN_APPROVED
ARTISAN_SUSPENDED
PRODUCT_REJECTED
USER_SUSPENDED
PRICE_POLICY_CHANGED
```

---

# 42. Remove Current Admin Secret Architecture

Do not use:

```text
X-Admin-Secret
```

especially not:

```text
JWT_SECRET_KEY
```

as the admin secret.

Admin access must come through:

```text
Admin authentication
       ↓
Admin session
       ↓
Admin authorization
```

---

# 43. Public API

Only genuinely public information:

```text
/api/public/products
/api/public/categories
```

Potentially:

```text
/api/public/artisans/{id}
```

with only approved/public fields.

No internal account information.

---

# 44. API Architecture

Final namespace:

```text
/api

├── /public
│
├── /marketplace
│   ├── /auth
│   ├── /products
│   ├── /cart
│   ├── /orders
│   ├── /payments
│   ├── /reviews
│   ├── /enquiries
│   └── /profile
│
├── /studio
│   ├── /auth
│   ├── /profile
│   ├── /products
│   ├── /catalog
│   ├── /market-research
│   ├── /pricing
│   ├── /demand
│   ├── /orders
│   ├── /enquiries
│   ├── /analytics
│   └── /notifications
│
└── /admin
    ├── /auth
    ├── /artisans
    ├── /users
    ├── /products
    ├── /orders
    ├── /reviews
    ├── /moderation
    ├── /analytics
    └── /system
```

---

# 45. Frontend Architecture

```text
src/
│
├── app/
│   ├── marketplace/
│   ├── studio/
│   └── admin/
│
├── features/
│   ├── marketplace/
│   ├── studio/
│   └── admin/
│
├── components/
│   └── shared/
│
├── auth/
│   ├── marketplace/
│   ├── studio/
│   └── admin/
│
├── api/
│   ├── marketplace/
│   ├── studio/
│   └── admin/
│
├── types/
├── utils/
└── config/
```

---

# 46. Route Protection

### Marketplace

```text
/shop/*
```

requires Buyer session only where necessary.

### Studio

```text
/studio/*
```

requires Studio session.

### Admin

```text
/admin/*
```

requires Admin session.

A Marketplace token attempting:

```text
/api/studio/*
```

must receive:

```text
403 Forbidden
```

or an appropriate authentication-domain error.

---

# 47. Session Separation

Hackathon implementation can use separate storage keys:

```text
marketplace_session
studio_session
admin_session
```

But production target:

```text
HttpOnly
Secure
SameSite
```

cookie/session architecture.

Never store sensitive long-lived credentials unnecessarily in normal JavaScript-accessible storage.

---

# 48. Database Integrity

Important constraints:

```text
Product.artisan_id → ArtisanProfile
Order.buyer_id → Account
OrderItem.order_id → Order
OrderItem.product_id → Product
Review.order_id → Order
Review.buyer_id → Account
```

Add:

```text
NOT NULL
FOREIGN KEY
UNIQUE
CHECK
INDEX
```

where appropriate.

---

# 49. Database Indexes

Likely important indexes:

```text
products(artisan_id)
products(status)
products(category)
orders(buyer_id)
orders(status)
order_items(product_id)
reviews(product_id)
reviews(order_id)
enquiries(artisan_id)
demand_predictions(product_id)
pricing_recommendations(product_id)
notifications(account_id)
audit_logs(actor_id)
audit_logs(resource_type, resource_id)
```

---

# 50. Data Lifecycle

### Product

```text
Draft
 → Review
 → Published
 → Suspended
 → Archived
```

### Artisan

```text
Application
 → Review
 → Verified
 → Active
 → Suspended
```

### Order

```text
Pending Payment
 → Confirmed
 → Processing
 → Shipped
 → Delivered
```

### Pricing recommendation

```text
Generated
 → Accepted / Rejected
 → Expired
```

---

# 51. Security Architecture

Security layers:

```text
HTTPS
 ↓
Authentication
 ↓
Authorization
 ↓
Ownership checks
 ↓
Input validation
 ↓
Database constraints
 ↓
Rate limiting
 ↓
Audit logging
 ↓
Secrets management
```

---

# 52. Security Requirements

Must have:

* password hashing
* token expiry
* token versioning
* account status validation
* rate limiting on auth endpoints
* input validation
* SQLAlchemy parameterization
* CORS restriction
* secure cookies in production
* secret management
* audit logging
* ownership checks
* payment verification

---

# 53. Secret Management

Never commit:

```text
GEMINI_API_KEY
JWT_SECRET
RAZORPAY_SECRET
DATABASE_PASSWORD
```

Use environment/secret management.

Production must reject insecure defaults.

---

# 54. Rate Limiting

At minimum:

```text
/login
/register
/google-login
/password operations
AI endpoints
market research
payment endpoints
```

should be rate-limited.

Especially AI endpoints because they directly create external API cost.

---

# 55. AI Cost Protection

Don't allow:

```text
user
 ↓
infinite Gemini calls
```

Use:

```text
authentication
+
rate limit
+
per-account quota
+
request validation
+
caching
```

---

# 56. AI Failure Strategy

If Gemini unavailable:

```text
Catalog AI
 → return retryable failure
```

Do not generate fake AI output.

If market research fails:

```text
Pricing recommendation
 → mark market signal unavailable
 → do not fabricate market price
```

---

# 57. ML Failure Strategy

If forecast unavailable:

```text
Demand unavailable
```

not:

```text
Demand = 0
```

unless zero is genuinely measured.

Pricing engine should know the difference between:

```text
ZERO DEMAND
```

and:

```text
NO DATA
```

---

# 58. Observability

System should produce:

```text
Application logs
Error logs
Authentication events
AI usage logs
Payment logs
ML prediction logs
Audit logs
```

Metrics:

```text
API latency
error rate
AI latency
AI failure rate
payment success rate
forecast generation success
queue backlog
database health
```

---

# 59. Background Jobs

Use background workers for:

```text
AI catalog processing
Market research
Demand forecasting
Analytics aggregation
Notifications
Periodic model evaluation
```

Architecture:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Result
 ↓
Database
```

---

# 60. Caching

Potential Redis usage:

```text
product catalog
categories
market research results
AI responses
rate limiting
sessions
job status
```

But PostgreSQL remains the source of truth.

---

# 61. Object Storage

Images should not be stored directly as large DB blobs.

```text
Client
 ↓
Upload
 ↓
Object Storage
 ↓
Image URL/reference
 ↓
ProductImage
```

Future:

```text
CDN
 ↓
optimized image
```

---

# 62. Image Pipeline

For artisan product images:

```text
Upload
 ↓
Validation
 ↓
Malware/content checks
 ↓
Resize/compress
 ↓
Object storage
 ↓
AI processing
```

---

# 63. Search Architecture

Initial:

```text
PostgreSQL search
```

Future:

```text
PostgreSQL
      ↓
Search Index
      ↓
Elasticsearch/OpenSearch/etc.
```

Search should support:

```text
keyword
category
price
artisan
availability
```

Future AI search:

```text
semantic embeddings
+
keyword search
```

---

# 64. ONDC Integration

ONDC should remain an **integration boundary**, not be mixed into core commerce logic.

```text
Core Order
     ↓
ONDC Adapter
     ↓
ONDC Network
```

Use adapter interfaces so ONDC implementation can evolve independently.

---

# 65. Integration Architecture

External systems:

```text
Gemini
Payment Provider
Google OAuth
Object Storage
Email Provider
ONDC
```

should be behind adapters/providers.

Example:

```text
PaymentService
      ↓
PaymentProvider
      ├── Razorpay
      └── Future Provider
```

Same principle for AI.

---

# 66. Service Layer

FastAPI routes should remain thin.

Bad:

```text
route
 ├── database logic
 ├── pricing algorithm
 ├── Gemini call
 ├── notification
 └── payment logic
```

Good:

```text
Route
 ↓
Service
 ↓
Repository
 ↓
Database
```

For AI:

```text
Service
 ↓
AI Gateway
```

---

# 67. Suggested Backend Structure

```text
backend/app/

├── main.py
│
├── core/
│   ├── config.py
│   ├── security.py
│   ├── database.py
│   └── dependencies.py
│
├── models/
│
├── schemas/
│
├── routes/
│   ├── public.py
│   ├── marketplace/
│   ├── studio/
│   └── admin/
│
├── services/
│   ├── auth/
│   ├── catalog/
│   ├── orders/
│   ├── payments/
│   ├── reviews/
│   ├── pricing/
│   ├── demand/
│   ├── market_research/
│   ├── notifications/
│   └── analytics/
│
├── ai/
│   ├── gateway.py
│   ├── providers/
│   └── tasks/
│
├── ml/
│   ├── features/
│   ├── training/
│   ├── inference/
│   └── evaluation/
│
├── repositories/
│
├── workers/
│
└── tests/
```

---

# 68. Testing Architecture

Testing should happen at multiple levels.

```text
Unit
 ↓
Service
 ↓
API
 ↓
Integration
 ↓
End-to-end
```

Critical security tests:

```text
Buyer → Studio API ❌
Buyer → Admin API ❌
Artisan → Admin API ❌
Artisan A → Artisan B product ❌
Artisan A → Artisan B order ❌
Admin → protected admin API ✅
```

---

# 69. Critical Test Matrix

| Request                                   | Expected          |
| ----------------------------------------- | ----------------- |
| Buyer → marketplace                       | ✅                 |
| Buyer → studio                            | ❌                 |
| Buyer → admin                             | ❌                 |
| Artisan → marketplace                     | ❌ for Studio APIs |
| Artisan → own Studio data                 | ✅                 |
| Artisan → other artisan data              | ❌                 |
| Admin → admin                             | ✅                 |
| Anonymous → published products            | ✅                 |
| Anonymous → private data                  | ❌                 |
| Unverified artisan → Studio business APIs | ❌                 |
| Suspended artisan → Studio                | ❌                 |

---

# 70. CI/CD

Pipeline:

```text
Git Push
 ↓
Lint
 ↓
Type checks
 ↓
Backend tests
 ↓
Frontend tests
 ↓
Frontend build
 ↓
Security checks
 ↓
Deploy
 ↓
Smoke tests
```

Current deployment should be updated so frontend lint/tests are actually executed rather than merely existing in `package.json`.

---

# 71. Environment Architecture

```text
.env.local
.env.test
.env.staging
.env.production
```

Configuration must validate:

```text
DATABASE_URL
JWT_SECRET
AI credentials
PAYMENT credentials
CORS origins
ENVIRONMENT
```

Production must reject:

```text
default JWT secret
SQLite
demo configuration
missing payment configuration
```

where required.

---

# 72. Production Scaling

Initial:

```text
1 FastAPI instance
1 PostgreSQL
1 Redis
1 worker
```

Scaling:

```text
                  Load Balancer
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       API #1       API #2       API #3
          │            │            │
          └────────────┼────────────┘
                       ▼
                   PostgreSQL
                       │
                     Redis
                       │
                    Workers
```

FastAPI instances should remain stateless where practical.

---

# 73. 100,000 User Direction

For a large user base:

```text
CDN
 ↓
Load Balancer
 ↓
Stateless API
 ↓
Redis
 ↓
PostgreSQL
```

AI workloads:

```text
API
 ↓
Queue
 ↓
Workers
 ↓
Gemini
```

Don't make 100,000 simultaneous users directly create synchronous AI requests.

---

# 74. AI Scaling

Bad:

```text
1000 users
 ↓
1000 synchronous Gemini requests
```

Better:

```text
1000 requests
 ↓
Queue
 ↓
Worker pool
 ↓
Rate-controlled provider calls
 ↓
Results stored
```

Also cache identical/near-identical operations where appropriate.

---

# 75. Data Ownership Matrix

| Resource               |          Buyer |                   Artisan |      Admin |
| ---------------------- | -------------: | ------------------------: | ---------: |
| Published products     |           Read |                      Read |       Full |
| Own products           |              — |                      Full |       Full |
| Other artisan products |              — |                         ❌ |       Full |
| Own orders             |           Full | Relevant fulfillment data |       Full |
| Other buyer orders     |              ❌ |                         ❌ | Controlled |
| Reviews                |            Own |             Product-level |       Full |
| Pricing                |              ❌ |              Own products |  Oversight |
| Demand                 |              ❌ |              Own products |       Full |
| Market research        | Public/limited |                   Own use |       Full |
| User management        |              ❌ |                         ❌ |       Full |
| Artisan verification   |              ❌ |                         ❌ |       Full |
| System configuration   |              ❌ |                         ❌ |       Full |

---

# 76. What V3 Removes

These concepts should be deprecated:

```text
active_mode
BUY/SELL mode switching
shared buyer/artisan login
public artisan registration
admin via generic auth
required_role as the main authorization mechanism
X-Admin-Secret
JWT signing secret as admin secret
automatic seller conversion
product auto-publication
fake transaction IDs as payment proof
pricing cap bypass
ML target leakage
fake T+7 forecasting
```

---

# 77. What V3 Preserves

We are **not throwing away the project**.

Keep:

```text
AI catalog
Gemini integration
grounded market research
pricing engine
demand prediction
artisan marketplace
reviews
enquiries
notifications
analytics
ONDC direction
FastAPI
React/Vite
PostgreSQL
SQLAlchemy
production configuration
```

The difference is that these now sit inside clear domain boundaries.

---

# 78. V3 Request Lifecycle Example

## Artisan creates a product

```text
Artisan
 ↓
Studio
 ↓
Studio session
 ↓
POST /api/studio/products
 ↓
require_artisan()
 ↓
ownership/account checks
 ↓
Create DRAFT
 ↓
AI catalog job
 ↓
Generate metadata
 ↓
Validation
 ↓
PENDING_REVIEW
 ↓
Publish
 ↓
Marketplace sees product
```

---

# 79. Buyer purchases

```text
Buyer
 ↓
Marketplace
 ↓
Published Product
 ↓
Cart
 ↓
Checkout
 ↓
Payment Provider
 ↓
Backend verification
 ↓
CONFIRMED
 ↓
Artisan Studio
 ↓
Order appears in artisan's orders
 ↓
Fulfillment
 ↓
DELIVERED
 ↓
Buyer review
```

---

# 80. AI Pricing Lifecycle

```text
Product
 ↓
Historical behavior
 ↓
Feature generation
 ↓
Demand forecast
 ↓
Market research
 ↓
Pricing engine
 ↓
Safety cap
 ↓
Recommendation
 ↓
Artisan Studio
 ↓
Accept / Reject
 ↓
New product price
```

---

# 81. Admin Artisan Verification

```text
Artisan application
       ↓
Admin Console
       ↓
Review information
       ↓
Approve
       ↓
Artisan Account ACTIVE
       ↓
Studio invitation
       ↓
Studio login
```

---

# 82. Failure Scenarios

### Gemini unavailable

```text
AI task → FAILED_RETRYABLE
```

No fabricated response.

### Payment verification fails

```text
Payment → FAILED
Order → NOT CONFIRMED
```

### Artisan suspended

```text
Studio API → 403
```

### Product moderation fails

```text
Product → PENDING_REVIEW
```

### ML has insufficient data

```text
Forecast → INSUFFICIENT_DATA
```

Not fabricated demand.

---

# 83. Architecture Decision Records

## ADR-001 — Separate portal authentication

**Decision:** Marketplace, Studio and Admin use independent authentication endpoints and session domains.

**Reason:** Prevent accidental privilege escalation and eliminate role-switching complexity.

---

## ADR-002 — Remove active_mode

**Decision:** `active_mode` is removed.

**Reason:** Authentication context should not be mutable from BUY → SELL.

---

## ADR-003 — One PostgreSQL database initially

**Decision:** Shared PostgreSQL database.

**Reason:** Data relationships such as products/orders/artisans remain easy to query while logical security boundaries are enforced at application/service level.

---

## ADR-004 — AI Gateway

**Decision:** All AI calls go through an abstraction layer.

**Reason:** Provider independence, observability, cost controls and testing.

---

## ADR-005 — Payment verification

**Decision:** Backend verifies provider payment before confirming orders.

**Reason:** Frontend success state is not payment authority.

---

## ADR-006 — Pricing safety cap

**Decision:** Global safety constraint.

**Reason:** No pricing branch may bypass price protection.

---

## ADR-007 — Human approval for pricing

**Decision:** AI recommends; artisan decides.

**Reason:** AI should assist business decisions rather than silently mutate financial outcomes.

---

# 84. V3 Implementation Phases

Do **not** implement everything simultaneously.

## Phase 0 — Freeze

```text
Architecture
Database model
API boundaries
Auth boundaries
Security rules
```

No feature development until these are finalized.

---

## Phase 1 — Authentication Migration

Implement:

```text
MarketplaceAuth
StudioAuth
AdminAuth
```

Remove:

```text
active_mode
shared portal auth
X-Admin-Secret
```

Add:

```text
require_buyer
require_artisan
require_admin
```

---

## Phase 2 — Authorization

Fix:

```text
ownership
role checks
account status
resource access
```

Test cross-portal attacks.

---

## Phase 3 — Product Integrity

Implement:

```text
DRAFT
PENDING_REVIEW
PUBLISHED
SUSPENDED
ARCHIVED
```

and ownership checks.

---

## Phase 4 — Commerce Integrity

Implement:

```text
payment verification
order state machine
review DB constraints
```

---

## Phase 5 — AI Gateway

Consolidate Gemini implementations.

```text
AI Gateway
 ↓
Gemini provider
```

Remove duplicate/hardcoded provider paths.

---

## Phase 6 — ML Correctness

Fix:

```text
target leakage
T+7 target
feature generation
evaluation
```

---

## Phase 7 — Pricing Integrity

Implement:

```text
global +25% cap
recommendation entity
explainability
approval workflow
```

---

## Phase 8 — Async Processing

Introduce:

```text
Redis
Queue
Workers
```

for expensive operations.

---

## Phase 9 — Observability

Add:

```text
audit logs
structured logs
metrics
AI tracing
payment logs
```

---

## Phase 10 — Production Hardening

Finally:

```text
rate limiting
secure cookies
secret management
CORS
CI/CD
backup
monitoring
scaling
```

---

# 85. Final Repository Direction

The current repository should evolve approximately toward:

```text
Artisan-Ai/
│
├── frontend/
│   └── src/
│       ├── marketplace/
│       ├── studio/
│       ├── admin/
│       ├── auth/
│       ├── shared/
│       └── api/
│
├── backend/
│   └── app/
│       ├── core/
│       ├── models/
│       ├── schemas/
│       ├── repositories/
│       ├── services/
│       │   ├── auth/
│       │   ├── catalog/
│       │   ├── commerce/
│       │   ├── pricing/
│       │   ├── demand/
│       │   ├── market_research/
│       │   ├── notifications/
│       │   └── analytics/
│       │
│       ├── ai/
│       ├── ml/
│       ├── workers/
│       ├── routes/
│       │   ├── marketplace/
│       │   ├── studio/
│       │   └── admin/
│       └── tests/
│
├── migrations/
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── security/
│   ├── ai/
│   └── ml/
│
└── infrastructure/
```

---

# 86. Definition of Done — V3

V3 architecture is considered implemented only when:

### Authentication

* [ ] Marketplace login independent
* [ ] Studio login independent
* [ ] Admin login independent
* [ ] No `active_mode`
* [ ] No portal switching
* [ ] No public artisan registration
* [ ] No public admin registration

### Authorization

* [ ] Buyer cannot access Studio
* [ ] Buyer cannot access Admin
* [ ] Artisan cannot access Admin
* [ ] Artisan can access only own resources
* [ ] Suspended accounts blocked
* [ ] Backend owns authorization decisions

### Product

* [ ] Product ownership enforced
* [ ] Draft workflow
* [ ] Moderation workflow
* [ ] Published-only public catalog

### Commerce

* [ ] Real payment verification
* [ ] Valid order state transitions
* [ ] Historical purchase price preserved
* [ ] Review uniqueness enforced at DB level

### AI

* [ ] AI Gateway
* [ ] Provider abstraction
* [ ] Provenance
* [ ] Grounding validation
* [ ] AI failure handling
* [ ] AI rate limits

### ML

* [ ] No target leakage
* [ ] Genuine future target
* [ ] T+7 forecasting
* [ ] Confidence
* [ ] Model versioning
* [ ] Evaluation

### Pricing

* [ ] Global +25% safety cap
* [ ] No bypass paths
* [ ] Explainable recommendations
* [ ] Artisan approval
* [ ] Recommendation history

### Operations

* [ ] Notifications
* [ ] Audit logs
* [ ] Background jobs
* [ ] Structured logs
* [ ] Metrics
* [ ] CI tests
* [ ] Production configuration

---

# 🔒 Final V3 Architecture Rule

This is the rule we should use for **every future feature**:

```text
                 WHO ARE YOU?
                      │
                      ▼
              Authentication
                      │
                      ▼
              WHICH PORTAL?
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Marketplace     Studio        Admin
        │             │             │
        ▼             ▼             ▼
      Buyer         Artisan        Admin
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                Authorization
                      │
                      ▼
               Resource Ownership
                      │
                      ▼
                Business Rules
                      │
                      ▼
                  Service
                      │
             ┌────────┴────────┐
             ▼                 ▼
          Database           AI/ML
```

**Authentication says who you are.
Authorization says what you can do.
Ownership says whose data you can touch.
Business rules say whether the operation is valid.
AI/ML provides intelligence — it does not become the source of truth.**
