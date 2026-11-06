import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ingestCandidateLead } from "../src/lib/intake-pipeline";
import { runAutomatedHygieneSweep } from "../src/lib/hygiene-daemon";
import { db } from "../src/db";
import { candidates, rejectedLeads, candidateEvents } from "../src/db/schema";
import { eq } from "drizzle-orm";

test("Autonomous Production Business Logic & Lead Hygiene Invariant Suite", async (t) => {
  const testPhone = "+91 98980 12345";
  let createdCandidateId: string | null = null;

  // Cleanup test artifacts after suite
  t.after(async () => {
    if (createdCandidateId) {
      await db.delete(candidateEvents).where(eq(candidateEvents.candidateId, createdCandidateId));
      await db.delete(candidates).where(eq(candidates.id, createdCandidateId));
    }
  });

  await t.test("RULE-01: Zero Em Dashes across all pipeline & daemon source files", () => {
    const files = [
      path.join(__dirname, "..", "src", "lib", "intake-pipeline.ts"),
      path.join(__dirname, "..", "src", "lib", "hygiene-daemon.ts"),
      path.join(__dirname, "..", "src", "lib", "qualification-shield.ts"),
      path.join(__dirname, "..", "src", "lib", "dedup.ts"),
      path.join(__dirname, "..", "src", "app", "api", "health", "lead-hygiene", "route.ts"),
    ];

    for (const f of files) {
      assert.ok(fs.existsSync(f), `File must exist: ${f}`);
      const content = fs.readFileSync(f, "utf8");
      assert.ok(
        !content.includes("\u2014"),
        `Forbidden em dash found in ${path.basename(f)}`
      );
    }
  });

  await t.test("INVARIANT-01: Rejection of leads without callable phone numbers", async () => {
    // Attempt to ingest lead with phone = "-"
    const res = await ingestCandidateLead(
      {
        businessName: "Titanium Tech Complex",
        phone: "-",
        city: "Ahmedabad",
        category: "Corporate Headquarters",
      },
      { channel: "discovery_sweep" }
    );

    assert.equal(res.success, false, "Lead with phone '-' must be rejected");
    if (!res.success) {
      assert.equal(res.action, "REJECTED");
      assert.ok(
        ["NO_PHONE_NUMBER", "PHONE_TOO_SHORT", "INVALID_PHONE"].includes(res.rejectionReason),
        `Unexpected rejection reason: ${res.rejectionReason}`
      );
    }

    // Verify it was NOT inserted into candidates table
    const cand = await db.select().from(candidates).where(eq(candidates.businessName, "Titanium Tech Complex"));
    assert.equal(cand.length, 0, "Uncallable lead must NEVER be inserted into candidates");
  });

  await t.test("INVARIANT-02: Rejection of toll-free numbers (1800/1860)", async () => {
    const res = await ingestCandidateLead(
      {
        businessName: "National Furniture Helpdesk",
        phone: "1800 200 4567",
        city: "Ahmedabad",
      },
      { channel: "ad_webhook" }
    );

    assert.equal(res.success, false, "Toll-free 1800 number must be rejected");
    if (!res.success) {
      assert.equal(res.rejectionReason, "TOLL_FREE_NUMBER");
    }
  });

  await t.test("INVARIANT-03: Rejection of dummy test numbers (9999999999)", async () => {
    const res = await ingestCandidateLead(
      {
        businessName: "Dummy Tester Firm",
        phone: "9999999999",
        city: "Ahmedabad",
      },
      { channel: "ad_webhook" }
    );

    assert.equal(res.success, false, "Repeated dummy digit phone must be rejected");
    if (!res.success) {
      assert.ok(
        ["REPETITIVE_DUMMY_PHONE", "DUMMY_PHONE_NUMBER"].includes(res.rejectionReason),
        `Unexpected rejection reason: ${res.rejectionReason}`
      );
    }
  });

  await t.test("INVARIANT-04: Rejection of residential inquiries", async () => {
    const res = await ingestCandidateLead(
      {
        businessName: "Sharma Family Residence",
        phone: "+91 98250 11223",
        notes: "Need modular kitchen and wardrobe for 3BHK bungalow",
      },
      { channel: "ad_webhook" }
    );

    assert.equal(res.success, false, "Residential consumer inquiry must be rejected");
    if (!res.success) {
      assert.equal(res.rejectionReason, "RESIDENTIAL_MISMATCH");
    }
  });

  await t.test("INVARIANT-05: Clean lead ingestion with canonical category normalization", async () => {
    const res = await ingestCandidateLead(
      {
        businessName: " Apex Workspace Systems - Prahlad Nagar",
        phone: testPhone,
        category: "furniture company in akshar sqaure", // Raw scraper query with typo
        industry: "furniture company in akshar sqaure",
        city: "Prahlad Nagar, Ahmedabad",
        projectType: "Modular Workstations",
      },
      { channel: "discovery_sweep", actor: "Automated Suite" }
    );

    assert.equal(res.success, true, "Clean commercial lead must be accepted");
    if (res.success && res.action === "CREATED") {
      createdCandidateId = res.candidateId;
      assert.equal(res.businessName, "Apex Workspace Systems", "Unicode artifacts and corridor suffix must be stripped");
      assert.equal(res.phone, testPhone, "Phone must be normalized E.164");
      assert.ok(
        ["Corporate Headquarters", "Office Furniture Partner"].includes(res.category),
        `Category must be normalized to canonical B2B, got: ${res.category}`
      );

      // Verify directly from DB
      const [saved] = await db.select().from(candidates).where(eq(candidates.id, res.candidateId));
      assert.ok(saved, "Saved candidate must exist in database");
      assert.ok(!saved.category?.includes("sqaure"), "Category must not contain scraper typos");
      assert.ok(!saved.industry?.includes("sqaure"), "Industry must not contain scraper typos");
    }
  });

  await t.test("INVARIANT-06: Atomic multi-touch deduplication without creating new rows", async () => {
    const beforeCount = (await db.select().from(candidates)).length;

    // Ingest second touchpoint for the exact same phone number
    const res = await ingestCandidateLead(
      {
        businessName: "Apex Workspace Systems Second Touch",
        phone: testPhone,
        notes: "Requested quotation for 80 acoustic workstations via Meta Ads",
        projectType: "Full Floor Fitout",
      },
      { channel: "ad_webhook", actor: "Meta Ads Webhook" }
    );

    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.action, "MERGED", "Duplicate phone must be atomically merged");
      assert.equal(res.candidateId, createdCandidateId, "Must merge into the existing candidate ID");
    }

    const afterCount = (await db.select().from(candidates)).length;
    assert.equal(afterCount, beforeCount, "Duplicate touch MUST NOT increment candidate row count in database");

    // Verify notes were appended to existing record
    if (createdCandidateId) {
      const [updated] = await db.select().from(candidates).where(eq(candidates.id, createdCandidateId));
      assert.ok(updated.operatorNotes?.includes("80 acoustic workstations"), "Touchpoint details must be appended to notes");
    }
  });

  await t.test("INVARIANT-07: Autonomous Hygiene Daemon sweep detects zero anomalies on clean DB", async () => {
    const summary = await runAutomatedHygieneSweep();
    assert.ok(summary.totalExamined >= 78, "Daemon must examine all candidates in DB");
    assert.equal(summary.uncallableArchived, 0, "No uncallable leads should exist to archive");
    assert.equal(summary.duplicatesMerged, 0, "No duplicate phones should exist to merge");
  });
});
