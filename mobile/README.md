# Artisan AI Mobile

Native Expo/React Native client for the existing Artisan AI FastAPI backend.

## Scope

One mobile codebase with separate role experiences:

- Artisan/Seller
- Buyer

The mobile app does not contain Gemini or other server secrets. AI/business logic stays in the FastAPI backend.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to the deployed FastAPI base URL.

Android emulator example:

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

A physical Android phone must use a backend URL reachable from that phone (LAN IP or deployed HTTPS endpoint).

## Current implementation

Seller:
- Login (Email/Password & Google OAuth PKCE)
- Dashboard (Revenue, Orders, Enquiries, Readiness)
- Products (List, Create, Edit, Delete, Status Transitions)
- AI Catalog Draft Generation & Image Enhancement
- Dynamic Explainable Pricing & Autonomous Smart Pricing Toggle
- Market Research Telemetry & Comparables Lookup
- Orders & Customer Enquiries
- ONDC Seller-Side Adapter Readiness & Catalog Sync

Buyer:
- Login/Register & Guest Mode
- Live Marketplace with Dynamic Categorization, Multi-field Search, and Price/Sort Filters
- Direct Collection Filter Navigation via `/buyer?category=...&search=...`
- Product Details with Audio Narration (`expo-speech`) in 5 languages (en, te, hi, ta, bn)
- Verified Buyer Reviews & Ratings (Delivered-order enforcement)
- Master Artisan Public Profile View (`/api/artisan/{id}`)
- Wishlist & Cart
- Server-Authoritative Checkout with Cash on Delivery (COD) & Online Payment Wiring (`/api/marketplace/payments/create` & `/verify`)
- Order Confirmation & Buyer Orders History with Tracking Timeline
- Buyer AI Assistant with Multilingual Speech Output

## Payments & Verifications

- **Cash on Delivery (COD)**: Fully wired and server-authoritative. Orders transition to CONFIRMED with payment status managed on the backend.
- **Online Payment (Razorpay)**: Server-authoritative order creation and signature verification wired to `/api/marketplace/payments/verify`.
- **Verified Reviews**: Enforced by server. Reviews can only be submitted for verified `DELIVERED` orders belonging to the authenticated buyer.
- **ONDC**: Seller-side foundation only; the mobile buyer does not fabricate fake ONDC payments, settlements, or live GPS dispatch.

## Build

Development:

```bash
npm start
```

Android:

```bash
npm run android
```

Before an APK/AAB release, run Expo's current Android build workflow with the project's configured EAS/Android signing credentials.
