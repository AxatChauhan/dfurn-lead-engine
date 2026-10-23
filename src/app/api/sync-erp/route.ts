import { NextRequest, NextResponse } from "next/server";
import { pushCandidateToErp } from "@/lib/erp-sync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateId = body.candidateId;

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const result = await pushCandidateToErp(candidateId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      enquiryCode: result.enquiryCode,
      clientCode: result.clientCode,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to sync to ERP" }, { status: 500 });
  }
}
