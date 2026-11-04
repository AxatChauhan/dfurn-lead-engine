import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rejectedLeads } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const list = await db
      .select()
      .from(rejectedLeads)
      .orderBy(desc(rejectedLeads.rejectedAt));

    return NextResponse.json({
      rejectedLeads: list,
      count: list.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch rejected leads" }, { status: 500 });
  }
}
