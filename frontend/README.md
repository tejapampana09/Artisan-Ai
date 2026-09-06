# Artisan AI — Frontend Web Application

The Artisan AI frontend is a high-performance React 19 Single Page Application built with Vite and Tailwind CSS. It is engineered with dual-mode operational views (**Artisan Studio** and **Buyer Marketplace**), voice recording multimodal AI cataloging, and rural-first offline synchronization.

## 🚀 Key Frontend Features

1. **Dual-Mode Artisan/Buyer Workspace**:
   - **Artisan Studio (`SELL`)**: Manage product catalog, review AI price recommendations, track regional demand indices, and review AI copilot insights.
   - **Buyer Marketplace (`BUY`)**: Direct-to-artisan craft marketplace with category filtering, detailed craft stories, wishlist saving, customer enquiry forms, and instant order placement.
2. **Voice-First AI Multimodal Cataloging**:
   - Integrates with Google Gemini Multimodal models for automatic craft title generation, cultural heritage storytelling, authentic materials detection, and cost floor calculations in Hindi, Telugu, Tamil, Bengali, and English.
3. **Zero-Data-Loss Rural Offline First Resilience**:
   - Client-side IndexedDB / `localStorage` caching and action queueing.
   - Allows artisans to draft crafts and approve price decisions during rural network dropouts, automatically reconciling via `/api/sync/batch` upon reconnection.
4. **Role-Based Auth & Safe Money Presentation**:
   - JWT authentication integration with auto-attached Bearer headers.
   - Indian Rupee (`₹`) precision formatting for all cost baselines and catalog valuations.

## 🛠️ Development & Build Scripts

```bash
# Install dependencies
npm install

# Start Vite local development server (with proxy to FastAPI backend on 8000)
npm run dev

# Run Oxlint static analysis
npm run lint

# Compile optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

## 🌐 Environment Configuration

By default, Vite proxies `/api` requests to `http://127.0.0.1:8000`.
For decoupled cloud deployments (e.g. Vercel frontend + Render/Fly backend):
Set `VITE_API_BASE=https://api.yourdomain.com/api` in your deployment environment or `.env` file.

