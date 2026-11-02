import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 1. Searches (Discovery Batches)
export const searches = sqliteTable("searches", {
  id: text("id").primaryKey(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  targetCount: integer("target_count").default(30),
  status: text("status").default("pending"), // pending, running, completed, failed
  candidatesFound: integer("candidates_found").default(0),
  qualifiedCount: integer("qualified_count").default(0),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// 2. Candidates (Architects, Interior Designers, Fitout Contractors)
export const candidates = sqliteTable("candidates", {
  id: text("id").primaryKey(),
  searchId: text("search_id").references(() => searches.id),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  industry: text("industry"),
  category: text("category").default("Commercial Office"), // Commercial Office, Coworking, Fitout Contractor, Architect, Residential
  city: text("city"),
  state: text("state"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  sourceType: text("source_type").default("paid_ads"), // paid_ads, google_maps, bing, directory, manual

  // Paid Ads Attribution & UTM Context
  leadSource: text("lead_source").default("paid_ads_meta"), // paid_ads_meta, paid_ads_google, website_form, manual, google_maps
  campaignName: text("campaign_name"),
  adsetName: text("adset_name"),
  adName: text("ad_name"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),

  // Project Specifics (from Lead Forms)
  projectType: text("project_type"), // Modular Workstations, Full Office Fitout, Executive Cabins, Acoustic Pods
  workstationCount: integer("workstation_count"),
  projectTimeline: text("project_timeline"), // Immediate (<15 days), 1-2 months, Planning
  hasFloorPlan: integer("has_floor_plan", { mode: "boolean" }).default(false),
  estimatedBudget: text("estimated_budget"),

  // Operator-Controlled Status Pipeline
  qualificationStage: text("qualification_stage").default("NEW"), // NEW, CONTACTED, FOLLOW_UP, QUALIFIED, CONVERTED, LOST
  operatorNotes: text("operator_notes"),
  lastContactedAt: integer("last_contacted_at", { mode: "timestamp" }),

  // 5D Scoring (0–100)
  totalScore: integer("total_score").default(0),
  leadTier: text("lead_tier").default("C"), // A+, A, B, C, D
  fitScore: integer("fit_score").default(0),
  scaleScore: integer("scale_score").default(0),
  activityScore: integer("activity_score").default(0),
  accessibilityScore: integer("accessibility_score").default(0),
  synergyScore: integer("synergy_score").default(0),
  reasoning: text("reasoning"),

  // Portfolio & Evidence Signals
  decisionMakers: text("decision_makers"), // JSON: Array of { name, title, linkedin }
  portfolioTags: text("portfolio_tags"), // JSON: Array of strings e.g. ["Corporate Office", "Workstations"]
  hasCommercialFocus: integer("has_commercial_focus", { mode: "boolean" }).default(false),
  whatsappAvailable: integer("whatsapp_available", { mode: "boolean" }).default(false),
  rawAudit: text("raw_audit"), // JSON: crawler metrics

  // Pipeline Status & ERP Bridge
  status: text("status").default("NEW"), // NEW, QUEUED, CONTACTED, SYNCED_TO_ERP, REJECTED
  syncedToErpAt: integer("synced_to_erp_at", { mode: "timestamp" }),
  erpEnquiryCode: text("erp_enquiry_code"),
  erpClientCode: text("erp_client_code"),
  notes: text("notes"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// 3. Outreach Messages (WhatsApp, Email, Call Scripts with Human-in-the-Loop Review)
export const outreachMessages = sqliteTable("outreach_messages", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id).notNull(),
  channel: text("channel").notNull(), // whatsapp, email, call_script
  stepNumber: integer("step_number").default(1),
  subject: text("subject"),
  bodyContent: text("body_content").notNull(),
  evidenceAnchors: text("evidence_anchors"), // JSON: Array of strings
  approvalStatus: text("approval_status").default("draft_pending_review"), // draft_pending_review, approved, sent, skipped
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// 4. ERP Sync Logs (Webhook payloads sent to localhost:3000/api/enquiries/intake)
export const erpSyncLogs = sqliteTable("erp_sync_logs", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id).notNull(),
  erpEnquiryCode: text("erp_enquiry_code"),
  erpClientCode: text("erp_client_code"),
  payload: text("payload").notNull(), // JSON
  response: text("response"), // JSON
  status: text("status").default("SUCCESS"), // SUCCESS, FAILED
  errorMessage: text("error_message"),
  syncedAt: integer("synced_at", { mode: "timestamp" }).notNull(),
});
