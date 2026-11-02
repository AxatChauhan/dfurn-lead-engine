import DatabaseConstructor from "better-sqlite3";
import path from "path";
import fs from "fs";

export function initializeDatabase() {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const bundledDbDir = path.join(process.cwd(), "data");
  const bundledDbPath = path.join(bundledDbDir, "dfurn_lead_engine.db");

  let dbPath: string;
  if (isVercel) {
    dbPath = path.join("/tmp", "dfurn_lead_engine.db");
    if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath) && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, dbPath);
      } catch (e) {
        console.error("Failed to copy bundled db to /tmp:", e);
      }
    }
  } else {
    if (!fs.existsSync(bundledDbDir)) {
      fs.mkdirSync(bundledDbDir, { recursive: true });
    }
    dbPath = bundledDbPath;
  }

  const sqlite = new DatabaseConstructor(dbPath);

  // Enable Write-Ahead Logging for high performance concurrency
  sqlite.pragma("journal_mode = WAL");

  // Create tables if they do not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id TEXT PRIMARY KEY,
      industry TEXT NOT NULL,
      location TEXT NOT NULL,
      target_count INTEGER DEFAULT 30,
      status TEXT DEFAULT 'pending',
      candidates_found INTEGER DEFAULT 0,
      qualified_count INTEGER DEFAULT 0,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      search_id TEXT,
      business_name TEXT NOT NULL,
      contact_person TEXT,
      industry TEXT,
      category TEXT DEFAULT 'Commercial Office',
      city TEXT,
      state TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      rating REAL,
      review_count INTEGER,
      source_type TEXT DEFAULT 'paid_ads',
      source_url TEXT,
      lead_source TEXT DEFAULT 'paid_ads_meta',
      campaign_name TEXT,
      adset_name TEXT,
      ad_name TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      project_type TEXT,
      workstation_count INTEGER,
      project_timeline TEXT,
      has_floor_plan INTEGER DEFAULT 0,
      estimated_budget TEXT,
      qualification_stage TEXT DEFAULT 'NEW',
      operator_notes TEXT,
      last_contacted_at INTEGER,
      total_score INTEGER DEFAULT 0,
      lead_tier TEXT DEFAULT 'C',
      fit_score INTEGER DEFAULT 0,
      scale_score INTEGER DEFAULT 0,
      activity_score INTEGER DEFAULT 0,
      accessibility_score INTEGER DEFAULT 0,
      synergy_score INTEGER DEFAULT 0,
      reasoning TEXT,
      decision_makers TEXT,
      portfolio_tags TEXT,
      has_commercial_focus INTEGER DEFAULT 0,
      whatsapp_available INTEGER DEFAULT 0,
      raw_audit TEXT,
      status TEXT DEFAULT 'NEW',
      synced_to_erp_at INTEGER,
      erp_enquiry_code TEXT,
      erp_client_code TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS outreach_messages (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      step_number INTEGER DEFAULT 1,
      subject TEXT,
      body_content TEXT NOT NULL,
      evidence_anchors TEXT,
      approval_status TEXT DEFAULT 'draft_pending_review',
      approved_at INTEGER,
      sent_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS erp_sync_logs (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      erp_enquiry_code TEXT,
      erp_client_code TEXT,
      payload TEXT NOT NULL,
      response TEXT,
      status TEXT DEFAULT 'SUCCESS',
      error_message TEXT,
      synced_at INTEGER NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_tier ON candidates(lead_tier, status);
    CREATE INDEX IF NOT EXISTS idx_candidates_city ON candidates(city);
    CREATE INDEX IF NOT EXISTS idx_outreach_approval ON outreach_messages(approval_status);
  `);

  // Safely migrate existing tables with new columns if missing
  try {
    const candidateCols = sqlite.pragma("table_info(candidates)") as { name: string }[];
    const existingColNames = new Set(candidateCols.map((c) => c.name));

    const colsToAdd = [
      { name: "contact_person", type: "TEXT" },
      { name: "lead_source", type: "TEXT DEFAULT 'paid_ads_meta'" },
      { name: "campaign_name", type: "TEXT" },
      { name: "adset_name", type: "TEXT" },
      { name: "ad_name", type: "TEXT" },
      { name: "utm_source", type: "TEXT" },
      { name: "utm_medium", type: "TEXT" },
      { name: "utm_campaign", type: "TEXT" },
      { name: "project_type", type: "TEXT" },
      { name: "workstation_count", type: "INTEGER" },
      { name: "project_timeline", type: "TEXT" },
      { name: "has_floor_plan", type: "INTEGER DEFAULT 0" },
      { name: "estimated_budget", type: "TEXT" },
      { name: "qualification_stage", type: "TEXT DEFAULT 'NEW'" },
      { name: "operator_notes", type: "TEXT" },
      { name: "last_contacted_at", type: "INTEGER" },
    ];

    for (const col of colsToAdd) {
      if (!existingColNames.has(col.name)) {
        try {
          sqlite.exec(`ALTER TABLE candidates ADD COLUMN ${col.name} ${col.type}`);
        } catch (e) {
          console.warn(`[DB Migration] Column ${col.name} warning:`, e);
        }
      }
    }
  } catch (err) {
    console.warn("[DB Migration] pragma table_info warning:", err);
  }

  return sqlite;
}
