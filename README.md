# D'furn Modular Systems · Standalone Lead Engine

An isolated, zero-cost B2B lead generation, 5D qualification, and outreach command center designed specifically for **D'furn Modular Systems**.

Running strictly on `localhost:3001` with a local SQLite database (`data/dfurn_lead_engine.db`), completely decoupled from the main ERP codebase.

---

## Features

* **Zero-Cost Multi-Source Discovery**:
  * Scrapes Google Maps local listings via headless Playwright Chromium.
  * Queries Bing search for studio profiles and directories.
  * Captures firm names, studio addresses, ratings, and phone numbers without paid Google Places API subscriptions.
* **Portfolio & Signal Crawler**:
  * Fetches candidate studio websites using fast Cheerio DOM parsing.
  * Detects Principal Architects, Design Directors, and Procurement Heads from About/Team pages.
  * Identifies commercial office scale, turnkey fitout capabilities, and modular workstation mentions.
  * Extracts normalized Indian mobile numbers and verifies WhatsApp availability.
* **Modular Furniture 5D Scoring Model (0–100)**:
  * Weighted across 5 commercial dimensions: **Fit (30%) · Commercial Scale (25%) · Activity (20%) · Accessibility (15%) · OEM Synergy (10%)**.
  * Auto-buckets prospects into **Tier A+ (Swatch Kit)**, **Tier A (Sequence)**, **Tier B (Catalog)**, and **Tier C (General)**.
* **Evidence-Based Copywriting Engine**:
  * **Architect Swatch Box Offer**: Offers physical finish boxes (laminates, powder-coated aluminum extrusions, PUR edge banding) delivered directly to studio desks.
  * **Turnkey Contractor OEM Pitch**: Emphasizes 14-day factory dispatch and precision German beam saws to de-risk on-site penalty clauses.
  * **1-Click WhatsApp Web Launcher**: Directly generates `https://wa.me/...` links with pre-filled personalized scripts.
* **Human-in-the-Loop Review Queue**:
  * No automated outbound spam; all messages require operator review and confirmation.
* **Optional 1-Click Bridge to D'furn ERP**:
  * Pushes qualified leads directly to `http://localhost:3000/api/enquiries/intake` on the local ERP.

---

## Technical Stack

* **Framework**: Next.js 16 (App Router, Turbopack)
* **Frontend**: React 19, Tailwind CSS v4, Lucide React
* **Database**: Local SQLite via `better-sqlite3` and Drizzle ORM
* **Scrapers**: Playwright Chromium & Cheerio
* **Port**: `http://localhost:3001`

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3001` in your browser.

3. **Verify D'furn ERP Integration (Optional)**:
   * Ensure D'furn main ERP is running at `http://localhost:3000`.
   * Click **"Push to ERP"** on any candidate card to test the intake webhook.
