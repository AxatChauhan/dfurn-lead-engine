import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.mwvbjdifhphfpvrnqqhs:superSecretSupabasePassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function runMigration() {
  console.log("Starting PostgreSQL migration for lead_engine schema...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  const client = await pool.connect();
  try {
    console.log("Connected to Mumbai PostgreSQL cluster.");

    await client.query(`CREATE SCHEMA IF NOT EXISTS lead_engine;`);

    // 1. Searches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_engine.searches (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        location TEXT NOT NULL,
        target_count INTEGER DEFAULT 30,
        status TEXT DEFAULT 'completed',
        candidates_found INTEGER DEFAULT 0,
        qualified_count INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // 2. Candidates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_engine.candidates (
        id TEXT PRIMARY KEY,
        search_id TEXT REFERENCES lead_engine.searches(id) ON DELETE SET NULL,
        business_name TEXT NOT NULL,
        contact_person TEXT,
        industry TEXT,
        category TEXT DEFAULT 'Commercial Office',
        city TEXT DEFAULT 'Ahmedabad',
        state TEXT DEFAULT 'Gujarat',
        address TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        website TEXT,
        rating NUMERIC(3, 2),
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
        project_type TEXT DEFAULT 'Modular Workstations',
        workstation_count INTEGER,
        project_timeline TEXT DEFAULT '1-2 months',
        has_floor_plan BOOLEAN DEFAULT FALSE,
        estimated_budget TEXT,
        qualification_stage TEXT DEFAULT 'NEW',
        operator_notes TEXT,
        first_contacted_at TIMESTAMPTZ,
        last_contacted_at TIMESTAMPTZ,
        total_score INTEGER DEFAULT 0,
        lead_tier TEXT DEFAULT 'A',
        fit_score INTEGER DEFAULT 0,
        scale_score INTEGER DEFAULT 0,
        activity_score INTEGER DEFAULT 0,
        accessibility_score INTEGER DEFAULT 0,
        synergy_score INTEGER DEFAULT 0,
        reasoning TEXT,
        decision_makers TEXT,
        portfolio_tags TEXT,
        has_commercial_focus BOOLEAN DEFAULT TRUE,
        whatsapp_available BOOLEAN DEFAULT TRUE,
        raw_audit TEXT,
        status TEXT DEFAULT 'NEW',
        synced_to_erp_at TIMESTAMPTZ,
        erp_enquiry_code TEXT,
        erp_client_code TEXT,
        erp_quote_code TEXT,
        erp_quote_value NUMERIC(12, 2),
        swatch_box_status TEXT DEFAULT 'NONE',
        swatch_box_courier TEXT,
        swatch_box_awb TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Outreach Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_engine.outreach_messages (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL REFERENCES lead_engine.candidates(id) ON DELETE CASCADE,
        channel TEXT NOT NULL DEFAULT 'WHATSAPP',
        step_number INTEGER DEFAULT 1,
        subject TEXT,
        body_content TEXT NOT NULL,
        evidence_anchors TEXT,
        approval_status TEXT DEFAULT 'draft_pending_review',
        approved_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Swatch Boxes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_engine.swatch_boxes (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL REFERENCES lead_engine.candidates(id) ON DELETE CASCADE,
        kit_type TEXT DEFAULT 'Standard Commercial Finishes',
        status TEXT DEFAULT 'REQUESTED',
        courier_partner TEXT,
        awb_number TEXT,
        dispatch_date DATE,
        delivery_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. ERP Sync Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_engine.erp_sync_logs (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL REFERENCES lead_engine.candidates(id) ON DELETE CASCADE,
        erp_enquiry_code TEXT,
        erp_client_code TEXT,
        payload JSONB NOT NULL,
        response JSONB,
        status TEXT DEFAULT 'SUCCESS',
        error_message TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidates_stage ON lead_engine.candidates(qualification_stage);
      CREATE INDEX IF NOT EXISTS idx_candidates_phone ON lead_engine.candidates(phone);
      CREATE INDEX IF NOT EXISTS idx_candidates_city ON lead_engine.candidates(city);
      CREATE INDEX IF NOT EXISTS idx_candidates_source ON lead_engine.candidates(lead_source);
      CREATE INDEX IF NOT EXISTS idx_outreach_status ON lead_engine.outreach_messages(approval_status);
      CREATE INDEX IF NOT EXISTS idx_swatch_status ON lead_engine.swatch_boxes(status);
    `);

    console.log("✓ All PostgreSQL tables and indexes created in schema lead_engine.");

    // Check if SQLite data exists to migrate
    const sqlitePath = path.join(process.cwd(), "data", "dfurn_lead_engine.db");
    if (fs.existsSync(sqlitePath)) {
      console.log("Found SQLite database at:", sqlitePath, "Migrating records...");
      const sqlite = new Database(sqlitePath);

      // Migrate Searches
      try {
        const searches = sqlite.prepare("SELECT * FROM searches").all() as any[];
        console.log(`Found ${searches.length} searches to migrate.`);
        for (const s of searches) {
          await client.query(`
            INSERT INTO lead_engine.searches (id, industry, location, target_count, status, candidates_found, qualified_count, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [
            s.id, s.industry, s.location, s.target_count, s.status, s.candidates_found, s.qualified_count,
            new Date(s.started_at), s.completed_at ? new Date(s.completed_at) : null
          ]);
        }
      } catch (e: any) {
        console.warn("Searches migration notice:", e.message);
      }

      // Migrate Candidates
      try {
        const cands = sqlite.prepare("SELECT * FROM candidates").all() as any[];
        console.log(`Found ${cands.length} candidates to migrate.`);
        for (const c of cands) {
          await client.query(`
            INSERT INTO lead_engine.candidates (
              id, search_id, business_name, contact_person, industry, category, city, state, address, phone, email, website,
              rating, review_count, source_type, source_url, lead_source, campaign_name, adset_name, ad_name, utm_source, utm_medium, utm_campaign,
              project_type, workstation_count, project_timeline, has_floor_plan, estimated_budget, qualification_stage, operator_notes,
              first_contacted_at, last_contacted_at, total_score, lead_tier, fit_score, scale_score, activity_score, accessibility_score, synergy_score,
              reasoning, decision_makers, portfolio_tags, has_commercial_focus, whatsapp_available, raw_audit, status, synced_to_erp_at,
              erp_enquiry_code, erp_client_code, notes, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
              $24, $25, $26, $27, $28, $29, $30,
              $31, $32, $33, $34, $35, $36, $37, $38, $39,
              $40, $41, $42, $43, $44, $45, $46, $47,
              $48, $49, $50, $51, $52
            ) ON CONFLICT (id) DO NOTHING
          `, [
            c.id, c.search_id, c.business_name, c.contact_person, c.industry, c.category, c.city, c.state, c.address, c.phone || '', c.email, c.website,
            c.rating, c.review_count, c.source_type, c.source_url, c.lead_source, c.campaign_name, c.adset_name, c.ad_name, c.utm_source, c.utm_medium, c.utm_campaign,
            c.project_type, c.workstation_count, c.project_timeline, Boolean(c.has_floor_plan), c.estimated_budget, c.qualification_stage || 'NEW', c.operator_notes,
            c.first_contacted_at ? new Date(c.first_contacted_at) : null, c.last_contacted_at ? new Date(c.last_contacted_at) : null,
            c.total_score, c.lead_tier, c.fit_score, c.scale_score, c.activity_score, c.accessibility_score, c.synergy_score,
            c.reasoning, c.decision_makers, c.portfolio_tags, Boolean(c.has_commercial_focus), Boolean(c.whatsapp_available), c.raw_audit,
            c.status, c.synced_to_erp_at ? new Date(c.synced_to_erp_at) : null, c.erp_enquiry_code, c.erp_client_code, c.notes,
            new Date(c.created_at || Date.now()), new Date(c.updated_at || Date.now())
          ]);
        }
      } catch (e: any) {
        console.warn("Candidates migration notice:", e.message);
      }

      // Migrate Outreach Messages
      try {
        const msgs = sqlite.prepare("SELECT * FROM outreach_messages").all() as any[];
        console.log(`Found ${msgs.length} outreach messages to migrate.`);
        for (const m of msgs) {
          await client.query(`
            INSERT INTO lead_engine.outreach_messages (
              id, candidate_id, channel, step_number, subject, body_content, evidence_anchors, approval_status, approved_at, sent_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
          `, [
            m.id, m.candidate_id, m.channel, m.step_number, m.subject, m.body_content, m.evidence_anchors, m.approval_status,
            m.approved_at ? new Date(m.approved_at) : null, m.sent_at ? new Date(m.sent_at) : null, new Date(m.created_at || Date.now())
          ]);
        }
      } catch (e: any) {
        console.warn("Outreach messages migration notice:", e.message);
      }

      // Migrate ERP Sync Logs
      try {
        const logs = sqlite.prepare("SELECT * FROM erp_sync_logs").all() as any[];
        console.log(`Found ${logs.length} sync logs to migrate.`);
        for (const l of logs) {
          let payloadJson = {};
          let responseJson = {};
          try { payloadJson = JSON.parse(l.payload); } catch {}
          try { responseJson = JSON.parse(l.response); } catch {}
          await client.query(`
            INSERT INTO lead_engine.erp_sync_logs (
              id, candidate_id, erp_enquiry_code, erp_client_code, payload, response, status, error_message, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [
            l.id, l.candidate_id, l.erp_enquiry_code, l.erp_client_code, payloadJson, responseJson,
            l.status, l.error_message, new Date(l.synced_at || Date.now())
          ]);
        }
      } catch (e: any) {
        console.warn("Sync logs migration notice:", e.message);
      }
    }

    console.log("✓ Migration to PostgreSQL completed successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
