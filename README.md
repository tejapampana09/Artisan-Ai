# Artisan AI

> **Smart India Hackathon 2026** | **Problem Statement ID: 26090** | **Theme: Heritage & Culture**
> **Title: AI-Driven Market Linkage and Smart Cataloging Mobile Application for Marginalized Artisans**

Artisan AI is a voice-first, AI-driven commerce platform designed specifically for marginalized artisans, weavers, and rural micro-entrepreneurs. It lowers the barrier to digital trade via **Photo + Multilingual Voice Cataloging**, provides **explainable dynamic pricing**, feeds a **closed-loop market intelligence engine**, and assists artisans with an **AI Business Copilot**.

---

## 🏛️ System Architecture

```text
               ┌────────────────────────┐
               │       REACT PWA        │
               │   SELL ↔ BUY TOGGLE    │
               └───────────┬────────────┘
                           │
                        REST API
                           │
               ┌───────────▼────────────┐
               │    FASTAPI BACKEND     │
               │   (MODULAR MONOLITH)   │
               └───────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
   PRODUCTS          MARKET ENGINE         AI PIPELINE
(CRUD & Catalog)   (Event Aggregation)  (Vision + Multilingual)
       │                   │                   │
       │                   ▼                   ▼
       │              Demand Score        Smart Catalog
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                     PRICING ENGINE
            (Cost + Margin + Demand Factor)
                           │
                           ▼
                     SELLER COPILOT
                           │
                           ▼
                        SQLite
```

---

## 🚀 Key Features

* **Dual-Mode Commerce (SELL ↔ BUY)**: A single unified account allows seamless switching between seller management and buyer discovery without multiple logins.
* **Voice-First AI Smart Catalog**: Artisans speak in their native Indian languages (Hindi, Telugu, Tamil, Bengali, English) and snap a photo. AI generates craft stories, titles, categories, and tags.
* **Deterministic Explainable Pricing**: Strict protection of artisan margins:
  $$\text{Min Fair Price} = \text{Material} + \text{Labour} + \text{Packaging} + \text{Min Margin}$$
  $$\text{Recommended Price} = \text{Base Price} \times \text{Demand Factor} \times \text{Market Adjustment}$$
* **Closed-Loop Market Intelligence**: Buyer searches, views, and enquiries immediately update regional craft demand scores, turning market activity into actionable seller opportunities.
* **Human-in-the-Loop**: All AI-generated drafts require explicit artisan review, edit, and approval before publishing.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons
* **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic v2, Uvicorn
* **Testing**: Pytest, HTTPX

---

## 💻 Local Setup & Running

### Backend
```bash
# Activate venv & install dependencies
pip install -r backend/requirements.txt
# Run FastAPI server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.
