# D'furn Lead Engine · System Directives & Context

> [!IMPORTANT]
> This repository is the **standalone D'furn Lead Engine**, running independently on **`localhost:3001`**.
> It is completely separate from the main D'furn ERP (`optimistic-carson`).

---

## 1. Core Architecture & Stack

* **Framework**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
* **Styling**: Tailwind CSS v4 + Lucide React icons
* **Database**: Local SQLite stored at `data/dfurn_lead_engine.db`, managed with Drizzle ORM and `better-sqlite3` with Write-Ahead Logging (WAL) enabled.
* **Scrapers & Discovery**:
  * Headless Playwright Chromium (`src/lib/discovery.ts`) for zero-cost Google Maps place scraping.
  * Cheerio (`src/lib/crawler.ts`) for DOM parsing of studio websites and portfolio projects.
* **5D Lead Scoring Model** (`src/lib/evaluator.ts`):
  * Weighted formula: **Fit (30%) · Commercial Scale (25%) · Activity (20%) · Accessibility (15%) · OEM Synergy (10%)**.
  * Tiers: **A+ (Score 85–100 · Swatch Kit)**, **A (70–84 · Sequence)**, **B (55–69 · Catalog)**, **C/D (<55)**.
* **Copywriting Engine** (`src/lib/copywriting.ts`):
  * Synthesizes personalized pitches for **Architects (Swatch Box Offer)** and **Contractors (OEM Capacity Pitch)** with direct `https://wa.me/` WhatsApp launch links.
* **Local ERP Bridge** (`src/lib/erp-sync.ts`):
  * 1-click push to the local D'furn ERP intake endpoint at `http://localhost:3000/api/enquiries/intake`.

---

## 2. Locked Design Mandates

Whenever generating UI components, screen text, toasts, or copy:

1. **Zero Em Dashes**:
   * Strictly never use em dashes anywhere. Use en dash `–` for uncalculated/empty values, and middle dot `·` for inline separators.
2. **Selected State is Black (`#000000`), Never Orange**:
   * In filter chips, segmented controls, tabs, and toggles, **Black is the selected/active state**.
   * Orange (`#FF7700`) is strictly reserved for primary CTAs and brand marks.
   * Status colors: Green (`#27AE60`) for Done/Approved, Orange (`#FF7700`) for In-Progress/Draft, Red (`#E74C3C`) for Rejected/Error.
3. **Short Choices are Pill Buttons, Not Dropdowns**:
   * Use horizontal pill toggles to save clicks.
4. **Screen Blocking Loaders on Mutations**:
   * Any action initiating scraping or pushing to ERP must block the screen with a spinner overlay.

---

## 3. Directory Map

```text
dfurn-lead-engine/
├── data/
│   └── dfurn_lead_engine.db      # Local SQLite database (WAL mode)
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main Dashboard (metrics, tier filters, discovery wizard)
│   │   ├── queue/page.tsx        # Human Review Queue (WhatsApp Web launch & email copy)
│   │   ├── candidates/[id]/      # Lead deep dive, 5D breakdown, live portfolio re-crawl
│   │   ├── api/
│   │   │   ├── discovery/        # Playwright Google Maps & Bing discovery trigger
│   │   │   ├── candidates/       # Candidate listing & filters
│   │   │   ├── candidates/[id]/  # Single candidate details, on-demand re-crawl & message edits
│   │   │   └── sync-erp/         # Push to D'furn ERP intake webhook
│   │   ├── layout.tsx            # Root shell with Port 3001 status indicator
│   │   └── globals.css           # Tailwind v4 styles & brand palettes
│   ├── db/
│   │   ├── schema.ts             # Drizzle SQLite schema (searches, candidates, outreach_messages, erp_sync_logs)
│   │   ├── init.ts               # Auto-creates SQLite tables on startup
│   │   ├── index.ts              # Drizzle DB export + auto-seeding
│   │   └── seed.ts               # Pre-seeds verified prospects across Ahmedabad, Pune, Surat
│   └── lib/
│       ├── discovery.ts          # Multi-source Google Maps + Bing search
│       ├── crawler.ts            # Cheerio website portfolio & WhatsApp extractor
│       ├── evaluator.ts          # 5D modular furniture scoring model
│       ├── copywriting.ts        # Evidence outreach & WhatsApp link builder
│       ├── erp-sync.ts           # Webhook client for localhost:3000/api/enquiries/intake
│       └── utils.ts              # Utility helpers
```

---

## 4. Verification Commands

* Run Development Server (Port 3001):
  ```bash
  npm run dev
  ```
* Typecheck:
  ```bash
  npx tsc --noEmit
  ```
* Production Build:
  ```bash
  npm run build
  ```
