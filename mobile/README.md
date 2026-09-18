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
- Login
- Dashboard
- Products
- AI Catalog draft request
- Image selection
- Orders
- Enquiries

Buyer:
- Login/register
- Marketplace
- Search
- Product details
- Wishlist
- Cart
- Orders
- Enquiries
- Buyer AI assistant

## Important

Payment is not implemented in this mobile client because the current hackathon scope can keep payment/settlement separate.

ONDC is displayed as the existing backend integration status; the mobile app never fabricates a live ONDC connection.

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
