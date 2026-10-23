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
  industry: text("industry"),
  category: text("category").default("Architect"), // Architect, Interior Designer, Fitout Contractor, Coworking
  city: text("city"),
  state: text("state"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  sourceType: text("source_type").default("google_maps"), // google_maps, bing, directory
  sourceUrl: text("source_url"),

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
