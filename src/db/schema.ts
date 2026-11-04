import { pgSchema, text, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// Isolate all tables in the dedicated "lead_engine" schema in Mumbai PostgreSQL
export const leadEngineSchema = pgSchema("lead_engine");

// 1. Searches (Discovery Batches & Ad Campaigns)
export const searches = leadEngineSchema.table("searches", {
  id: text("id").primaryKey(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  targetCount: integer("target_count").default(30),
  status: text("status").default("pending"), // pending, running, completed, failed
  candidatesFound: integer("candidates_found").default(0),
  qualifiedCount: integer("qualified_count").default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// 2. Candidates (Architects, Interior Designers, Fitout Contractors, Paid Ad Leads)
export const candidates = leadEngineSchema.table("candidates", {
  id: text("id").primaryKey(),
  searchId: text("search_id").references(() => searches.id),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  industry: text("industry"),
  category: text("category").default("Commercial Office"), // Commercial Office, Coworking, Fitout Contractor, Architect, Residential
  city: text("city").default("Ahmedabad"),
  state: text("state").default("Gujarat"),
  address: text("address"),
  phone: text("phone").notNull(),
  email: text("email"),
  website: text("website"),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count"),
  sourceType: text("source_type").default("paid_ads"), // paid_ads, google_maps, bing, directory, manual
  sourceUrl: text("source_url"),

  // Paid Ads Attribution & UTM Context
  leadSource: text("lead_source").default("paid_ads_meta"), // paid_ads_meta, paid_ads_google, website_form, manual, google_maps
  campaignName: text("campaign_name"),
  adsetName: text("adset_name"),
  adName: text("ad_name"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),

  // Project Specifics (from Lead Forms)
  projectType: text("project_type").default("Modular Workstations"), // Modular Workstations, Full Office Fitout, Executive Cabins, Acoustic Pods
  workstationCount: integer("workstation_count"),
  projectTimeline: text("project_timeline").default("1-2 months"), // Immediate (<15 days), 1-2 months, Planning
  hasFloorPlan: boolean("has_floor_plan").default(false),
  estimatedBudget: text("estimated_budget"),

  // Operator-Controlled Status Pipeline (7 Unified Stages)
  // NEW, CONTACTED, FOLLOW_UP, QUALIFIED, CONVERTED, LOST
  qualificationStage: text("qualification_stage").default("NEW"),
  operatorNotes: text("operator_notes"),
  firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),

  // 5D Scoring (0 to 100)
  totalScore: integer("total_score").default(0),
  leadTier: text("lead_tier").default("A"), // A+, A, B, C, D
  fitScore: integer("fit_score").default(0),
  scaleScore: integer("scale_score").default(0),
  activityScore: integer("activity_score").default(0),
  accessibilityScore: integer("accessibility_score").default(0),
  synergyScore: integer("synergy_score").default(0),
  reasoning: text("reasoning"),

  // Portfolio & Evidence Signals
  decisionMakers: text("decision_makers"), // JSON: Array of { name, title, linkedin }
  portfolioTags: text("portfolio_tags"), // JSON: Array of strings
  hasCommercialFocus: boolean("has_commercial_focus").default(true),
  whatsappAvailable: boolean("whatsapp_available").default(true),
  rawAudit: text("raw_audit"),

  // Pipeline Status & ERP Bridge
  status: text("status").default("NEW"), // NEW, QUEUED, CONTACTED, SYNCED_TO_ERP, REJECTED
  syncedToErpAt: timestamp("synced_to_erp_at", { withTimezone: true }),
  erpEnquiryCode: text("erp_enquiry_code"),
  erpClientCode: text("erp_client_code"),
  erpQuoteCode: text("erp_quote_code"),
  erpQuoteValue: numeric("erp_quote_value", { precision: 12, scale: 2 }),

  // Multichannel Quality & Google Maps Enrichment Flags
  isDummyPhone: boolean("is_dummy_phone").default(false),
  enrichmentStatus: text("enrichment_status").default("NONE"), // NONE, PENDING, ENRICHED, FAILED

  // Swatch Box Sampling Pipeline
  swatchBoxStatus: text("swatch_box_status").default("NONE"), // NONE, REQUESTED, DISPATCHED, DELIVERED, FOLLOWED_UP
  swatchBoxCourier: text("swatch_box_courier"),
  swatchBoxAwb: text("swatch_box_awb"),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. Outreach Messages (WhatsApp, Email, Call Scripts with Review Queue)
export const outreachMessages = leadEngineSchema.table("outreach_messages", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").default("WHATSAPP").notNull(),
  stepNumber: integer("step_number").default(1),
  subject: text("subject"),
  bodyContent: text("body_content").notNull(),
  evidenceAnchors: text("evidence_anchors"),
  approvalStatus: text("approval_status").default("draft_pending_review"), // draft_pending_review, approved, sent
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4. Swatch Boxes
export const swatchBoxes = leadEngineSchema.table("swatch_boxes", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  kitType: text("kit_type").default("Standard Commercial Finishes"),
  status: text("status").default("REQUESTED"), // REQUESTED, DISPATCHED, DELIVERED, FOLLOWED_UP
  courierPartner: text("courier_partner"),
  awbNumber: text("awb_number"),
  dispatchDate: timestamp("dispatch_date", { withTimezone: true }),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. ERP Sync Logs (Webhook payloads sent to port 3000 /api/enquiries/intake)
export const erpSyncLogs = leadEngineSchema.table("erp_sync_logs", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  erpEnquiryCode: text("erp_enquiry_code"),
  erpClientCode: text("erp_client_code"),
  payload: jsonb("payload").notNull(),
  response: jsonb("response"),
  status: text("status").default("SUCCESS"),
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

// 6. Candidate Events & Audit Timeline
export const candidateEvents = leadEngineSchema.table("candidate_events", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(), // LEAD_CAPTURED, STAGE_CHANGED, OUTREACH_SENT, SWATCH_UPDATED, NOTE_UPDATED, ERP_SYNCED, CALL_LOGGED, PHONE_ENRICHED
  title: text("title").notNull(),
  description: text("description"),
  channel: text("channel").default("SYSTEM"), // WHATSAPP, EMAIL, PHONE, SYSTEM, ERP
  metadata: jsonb("metadata"),
  actor: text("actor").default("Sales Operator"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 7. Rejected Leads (Strictly explicit rejections: residential kitchen/villa decorators, competitors, non-decision makers)
export const rejectedLeads = leadEngineSchema.table("rejected_leads", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  city: text("city").default("Ahmedabad"),
  leadSource: text("lead_source").default("paid_ads_meta"),
  category: text("category").default("Residential Decorator"),
  rejectionReason: text("rejection_reason").notNull(), // RESIDENTIAL_MISMATCH, COMPETITOR, NON_DECISION_MAKER, SPAM
  notes: text("notes"),
  rawPayload: jsonb("raw_payload"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }).defaultNow().notNull(),
});
