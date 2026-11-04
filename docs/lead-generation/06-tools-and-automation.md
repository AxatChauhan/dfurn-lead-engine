# D'furn Modular Systems · MarTech Stack, Automation & ERP Bridge

> **Document ID:** DFN-TOOL-006  
> **Published Date:** November 2026  
> **Architecture Focus:** Budget-Conscious Lead Capture, Attribution & ERP Ingestion Engine  
> **Author:** Senior B2B Growth Strategist & Manufacturing Lead-Generation Analyst  

---

## 1. Budget-Conscious MarTech Architecture

Rather than burdening D'furn with expensive enterprise software suites (e.g. Salesforce or HubSpot Enterprise costing \$5,000+/year), we prescribe a lean, high-ROI stack tailored for an Indian industrial manufacturer:

```
+-----------------------------------------------------------------------------------+
| RECOMMENDED BUDGET-CONSCIOUS MARTECH STACK                                        |
+--------------------------+----------------------------+---------------------------+
| Functional Layer         | Recommended Tool / Platform| Cost Bracket (INR / Month)|
+--------------------------+----------------------------+---------------------------+
| Tag & Pixel Management   | Google Tag Manager (GTM)   | Free                      |
|                          | (Existing: GTM-56QQVV87)   |                           |
+--------------------------+----------------------------+---------------------------+
| Web & Funnel Analytics   | Google Analytics 4 (GA4) + | Free                      |
|                          | Microsoft Clarity (Heatmaps|                           |
+--------------------------+----------------------------+---------------------------+
| Conversion Landing Pages | Standalone Next.js Engine  | Zero marginal cost        |
|                          | (or Vercel / Cloudflare)   | (hosted on existing infra)|
+--------------------------+----------------------------+---------------------------+
| WhatsApp Business API    | AiSensy or Wati            | ₹999 to ₹2,499 / month    |
|                          | (Official WhatsApp Cloud)  | + Meta conversation fees  |
+--------------------------+----------------------------+---------------------------+
| Inbound Triage & 5D Score| D'furn Lead Engine         | Free                      |
|                          | (Local SQLite + Drizzle ORM| (Internal workspace repo) |
+--------------------------+----------------------------+---------------------------+
| Core Business ERP        | D'furn Main ERP            | In-House Enterprise System|
|                          | (Port 3000 / SQLite / PG)  | (Enquiries & BOM modules) |
+--------------------------+----------------------------+---------------------------+
| Multi-Source Webhooks    | Make.com (Core Plan) or    | Free tier to ₹750 / month |
|                          | Direct Next.js API Routes  |                           |
+--------------------------+----------------------------+---------------------------+
```

---

## 2. End-to-End Data Flow & Ingestion Architecture

```
  [Google Ads]       [Meta Ads]       [Website Form]      [IndiaMART]      [Architect Call]
   (UTM Source)     (Instant Form)     (CAD Upload)         (Lead Push)      (Manual Entry)
        |                 |                  |                   |                 |
        +-----------------+------------------+-------------------+-----------------+
                                             |
                                             v
                           +-----------------------------------+
                           | D'FURN LEAD ENGINE INTAKE GATEWAY |
                           | (Port 3001: API / Webhooks)       |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | 5D QUALIFICATION & SCORING ENGINE |
                           | • Fit (30%) · Scale (25%)         |
                           | • Activity (20%) · Access (15%)   |
                           | • OEM Synergy (10%)               |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | HUMAN-IN-THE-LOOP OPERATOR QUEUE  |
                           | • Verify CAD Layout / Scope       |
                           | • 1-Click WhatsApp Script Launch  |
                           | • Approve for Production Sync     |
                           +-----------------------------------+
                                             |
                                             v  (POST /api/enquiries/intake)
                           +-----------------------------------+
                           | D'FURN MAIN ERP (Port 3000)       |
                           | • Client Master Record Created    |
                           | • Enquiry Code: ENQ-2026-XXXX     |
                           | • Direct Flow to Quotation & BOM  |
                           +-----------------------------------+
```

---

## 3. ERP Integration Protocol (Enquiries Module Sync)

The standalone D'furn Lead Engine (`localhost:3001`) connects seamlessly to the main D'furn ERP (`localhost:3000`) via a dedicated intake endpoint:

* **ERP Endpoint:** `POST http://localhost:3000/api/enquiries/intake`
* **Content-Type:** `application/json`

### 3.1 Field Mapping Specification

The table below defines how raw leads from diverse sources are mapped into the ERP Enquiries schema:

```
+------------------------------------------------------------------------------------+
| FIELD MAPPING: LEAD ENGINE TO D'FURN ERP                                           |
+----------------------+----------------------+--------------------------------------+
| Lead Engine Field    | ERP Enquiries Field  | Transformation / Logic               |
+----------------------+----------------------+--------------------------------------+
| candidate.id         | externalId           | Unique UUID preventing duplicates    |
| candidate.business   | clientName           | Sanitized company / institution name |
| candidate.phone      | clientPhone          | Normalized E.164 (+91 XXXXX XXXXX)   |
| candidate.email      | clientEmail          | Optional RFC-5322 email string       |
| "IN"                 | clientCountry        | Fixed country code                   |
| candidate.category   | sourceCategory       | "Architect/Designer" | "Social Media"|
|                      |                      | | "Direct" | "Marketplace"           |
| campaignName / utm   | sourceName           | Exact adset or campaign identifier   |
| Synthesized Brief    | brief                | Scope · Scale · Floor Plan · Timeline|
| candidate.leadTier   | payload.leadTier     | "A+", "A", "B", "C"                  |
| candidate.totalScore | payload.totalScore   | Integer (0–100)                      |
| candidate.workstation| payload.workstations | Seat count for BOM sizing            |
+----------------------+----------------------+--------------------------------------+
```

### 3.2 Canonical JSON Intake Payload Example

When an operator reviews an A+ candidate and clicks **"Push to ERP"**, the following payload is transmitted:

```json
{
  "channel": "Paid Ads",
  "externalId": "lead_ad_meta_ahd_019",
  "clientName": "Apex FinTech Solutions LLP",
  "clientPhone": "+919825088990",
  "clientEmail": "admin@apexfintech.in",
  "clientCountry": "IN",
  "sourceCategory": "Social Media",
  "sourceName": "Meta_Ahd_OfficeFitout_Q4",
  "brief": "Paid Ad Lead (Meta_Ahd_OfficeFitout_Q4) in Ahmedabad · Scope: Modular Workstations · Scale: 60 Workstations · Floor Plan: Verified/Available · Timeline: Immediate (<15 days) · Contact: Karan Singhal · Notes: Inquired via Meta Instant Form for 60 linear workstations with acoustic screen partitions. Has CAD layout ready.",
  "payload": {
    "category": "Commercial Office",
    "city": "Ahmedabad",
    "leadSource": "paid_ads_meta",
    "campaignName": "Meta_Ahd_OfficeFitout_Q4",
    "projectType": "Modular Workstations (60 Seats)",
    "workstationCount": 60,
    "hasFloorPlan": true,
    "qualificationStage": "QUALIFIED",
    "operatorNotes": "CAD layout received. Needs dual-screen linear desks with concealed wire raceways.",
    "leadTier": "A+",
    "totalScore": 92
  }
}
```

### 3.3 ERP Response & Lifecycle Management
Upon receiving the payload, the main ERP executes an atomic transaction:
1. Verifies if a Client record already exists for `clientPhone`. If not, creates a new Client record (`clientCode: "CLI-2026-084"`).
2. Generates an official Enquiry record (`enquiryCode: "ENQ-2026-112"`).
3. Assigns the enquiry to the designated Commercial Estimator for 2D CAD layout and BOM costing.
4. Returns HTTP 200 with `{ "success": true, "enquiryCode": "ENQ-2026-112", "clientCode": "CLI-2026-084" }`, which updates the local candidate card to status `SYNCED_TO_ERP`.

---

## 4. Multi-Touch Tracking & UTM Attribution Hygiene

To track every Rupee spent on Google and Meta ads through to the final factory invoice, D'furn must enforce rigid UTM parameter governance:

```
https://dfurn.in/commercial/workstations?
  utm_source=google
  &utm_medium=cpc
  &utm_campaign=ahd_commercial_workstations_q4
  &utm_term=modular_workstation_manufacturer_ahmedabad
  &utm_content=14day_dispatch_text_v1
```

### UTM Taxonomy Standards:
* `utm_source`: `google` | `meta` | `linkedin` | `indiamart` | `email`
* `utm_medium`: `cpc` | `paid_social` | `organic` | `referral` | `swatch_box`
* `utm_campaign`: Lowercase city and product theme (e.g. `ahd_workstations`, `pune_fitout_contractors`, `giftcity_compactors`).
* `utm_content`: Angle variation (e.g. `14day_guarantee`, `factory_video`, `swatch_kit`).
