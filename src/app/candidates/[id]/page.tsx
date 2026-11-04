"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Send,
  MessageSquare,
  Sparkles,
  Check,
  Building2,
  Copy,
  UserCheck
} from "lucide-react";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [candidate, setCandidate] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [crawling, setCrawling] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"WHATSAPP" | "EMAIL" | "CALL_SCRIPT">("WHATSAPP");

  const loadCandidate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/candidates/${id}`);
      const data = await res.json();
      if (data.candidate) {
        setCandidate(data.candidate);
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error loading candidate:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadCandidate();
  }, [id]);

  const handleCrawl = async () => {
    try {
      setCrawling(true);
      const res = await fetch(`/api/candidates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "crawl" }),
      });
      const data = await res.json();
      if (data.success) {
        loadCandidate();
      } else {
        alert(data.error || "Crawl failed");
      }
    } catch (err: any) {
      alert("Crawl error: " + err.message);
    } finally {
      setCrawling(false);
    }
  };

  const handlePushToErp = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/sync-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: id }),
      });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        loadCandidate();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopy = (channel: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(channel);
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#6B7280]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#FF7700]" />
        Loading candidate intelligence...
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-xl font-bold">Candidate not found</h2>
        <Link href="/" className="btn-secondary mt-4 text-xs">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const decisionMakers = candidate.decisionMakers ? JSON.parse(candidate.decisionMakers) : [];
  const portfolioTags = candidate.portfolioTags ? JSON.parse(candidate.portfolioTags) : [];

  const whatsAppMsg = messages.find((m) => m.channel === "WHATSAPP")?.bodyContent || "";
  const emailMsg = messages.find((m) => m.channel === "EMAIL");

  const phoneDigits = (candidate.phone || "").replace(/\D/g, "");
  let cleanPhone = phoneDigits;
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
  const waUrl = cleanPhone.length >= 10
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMsg)}`
    : "";

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B5563] hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Link>

        <div className="flex items-center gap-2">
          {candidate.website ? (
            <button
              onClick={handleCrawl}
              disabled={crawling}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${crawling ? "animate-spin" : ""}`} />
              <span>{crawling ? "Auditing Website..." : "Re-crawl Portfolio"}</span>
            </button>
          ) : null}

          {candidate.status === "SYNCED_TO_ERP" ? (
            <span className="text-xs font-semibold text-[#059669] bg-[#ECFDF5] px-3 py-1.5 rounded border border-[#A7F3D0] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Synced as {candidate.erpEnquiryCode}</span>
            </span>
          ) : (
            <button
              onClick={handlePushToErp}
              disabled={syncing}
              className="btn-primary text-xs px-3.5 py-1.5"
            >
              {syncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Push to ERP</span>
            </button>
          )}
        </div>
      </div>

      {syncResult ? (
        <div
          className={`p-4 rounded-lg text-xs font-medium border ${
            syncResult.success
              ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
          }`}
        >
          {syncResult.message}
        </div>
      ) : null}

      {/* Main Profile Header */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                {candidate.businessName}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">
                {candidate.category}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  candidate.leadTier === "A+"
                    ? "badge-tier-aplus"
                    : candidate.leadTier === "A"
                    ? "badge-tier-a"
                    : candidate.leadTier === "B"
                    ? "badge-tier-b"
                    : "badge-tier-c"
                }`}
              >
                Tier {candidate.leadTier}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] mt-2">
              <span>{candidate.city}, India</span>
              {candidate.rating ? (
                <>
                  <span>·</span>
                  <span>★ {candidate.rating} ({candidate.reviewCount} reviews)</span>
                </>
              ) : null}
              {candidate.phone ? (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-[#111827] font-medium">
                    <Phone className="w-3 h-3 text-[#6B7280]" />
                    {candidate.phone}
                  </span>
                </>
              ) : null}
              {candidate.email ? (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-[#111827]">
                    <Mail className="w-3 h-3 text-[#6B7280]" />
                    {candidate.email}
                  </span>
                </>
              ) : null}
              {candidate.website ? (
                <>
                  <span>·</span>
                  <a
                    href={candidate.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#2563EB] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Website ↗</span>
                  </a>
                </>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#6B7280] uppercase font-semibold">Total 5D Score</span>
            <div className="text-3xl font-extrabold text-[#111827] mt-0.5">
              {candidate.totalScore}<span className="text-sm font-normal text-[#9CA3AF]">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5D Score Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB]">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase">Fit (30%)</span>
          <div className="text-lg font-bold text-[#111827] mt-1">{candidate.fitScore}/100</div>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">Category alignment</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB]">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase">Commercial Scale (25%)</span>
          <div className="text-lg font-bold text-[#111827] mt-1">{candidate.scaleScore}/100</div>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">Office & Turnkey focus</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB]">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase">Activity (20%)</span>
          <div className="text-lg font-bold text-[#111827] mt-1">{candidate.activityScore}/100</div>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">Reviews & Web presence</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB]">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase">Accessibility (15%)</span>
          <div className="text-lg font-bold text-[#111827] mt-1">{candidate.accessibilityScore}/100</div>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">Phone, WA & Email</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB]">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase">OEM Synergy (10%)</span>
          <div className="text-lg font-bold text-[#111827] mt-1">{candidate.synergyScore}/100</div>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">Modular factory value</p>
        </div>
      </div>

      {/* Crawled Evidence & Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider">
            Decision Makers & Contacts
          </h3>
          {decisionMakers.length > 0 ? (
            <div className="space-y-2">
              {decisionMakers.map((dm: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                  <UserCheck className="w-4 h-4 text-[#FF7700]" />
                  <div>
                    <div className="font-bold text-[#111827]">{dm.name}</div>
                    <div className="text-[#6B7280] text-[11px]">{dm.title}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#6B7280]">
              No individual principals identified yet. Click "Re-crawl Portfolio" above to parse studio about page.
            </div>
          )}

          <div className="pt-2 border-t border-[#E5E7EB]">
            <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-2">Portfolio Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {portfolioTags.length > 0 ? (
                portfolioTags.map((tag: string, i: number) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#1E40AF] font-medium border border-[#DBEAFE]">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#9CA3AF]">No portfolio tags recorded</span>
              )}
            </div>
          </div>
        </div>

        {/* Evaluation Summary */}
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider">
            Commercial Qualification
          </h3>
          <p className="text-xs text-[#4B5563] leading-relaxed">
            {candidate.reasoning || "Standard prospect awaiting full web crawl."}
          </p>

          <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Commercial Focus:</span>
              <span className="font-semibold text-[#111827]">
                {candidate.hasCommercialFocus ? "Confirmed Office/Turnkey" : "General/Residential"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">WhatsApp Channel:</span>
              <span className="font-semibold text-[#111827]">
                {candidate.whatsappAvailable ? "Available" : "Unverified"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Discovery Origin:</span>
              <span className="font-semibold text-[#111827]">{candidate.sourceType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Outreach Tabs */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Tabs Bar (Active State is BLACK) */}
        <div className="flex items-center gap-2 p-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <button
            onClick={() => setActiveTab("WHATSAPP")}
            className={`tab-pill flex items-center gap-1.5 ${activeTab === "WHATSAPP" ? "active" : ""}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Pitch</span>
          </button>
          <button
            onClick={() => setActiveTab("EMAIL")}
            className={`tab-pill flex items-center gap-1.5 ${activeTab === "EMAIL" ? "active" : ""}`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Cold Email</span>
          </button>
          <button
            onClick={() => setActiveTab("CALL_SCRIPT")}
            className={`tab-pill flex items-center gap-1.5 ${activeTab === "CALL_SCRIPT" ? "active" : ""}`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Script & Objections</span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === "WHATSAPP" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4B5563] uppercase">
                  Personalized WhatsApp Message (Direct Specifier Pitch)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy("WA", whatsAppMsg)}
                    className="btn-secondary text-xs px-2.5 py-1"
                  >
                    {copiedChannel === "WA" ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedChannel === "WA" ? "Copied" : "Copy"}</span>
                  </button>
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Launch WhatsApp Web ↗</span>
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-sm text-[#111827] whitespace-pre-line leading-relaxed">
                {whatsAppMsg}
              </div>
            </div>
          ) : activeTab === "EMAIL" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4B5563] uppercase">
                  Subject: <span className="text-[#111827]">{emailMsg?.subject || "D'furn Modular OEM"}</span>
                </span>
                <button
                  onClick={() => handleCopy("EMAIL", `${emailMsg?.subject}\n\n${emailMsg?.bodyContent}`)}
                  className="btn-secondary text-xs px-2.5 py-1"
                >
                  {copiedChannel === "EMAIL" ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedChannel === "EMAIL" ? "Copied" : "Copy Email"}</span>
                </button>
              </div>
              <div className="p-4 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-sm text-[#111827] whitespace-pre-line leading-relaxed">
                {emailMsg?.bodyContent}
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] space-y-3">
                <div>
                  <span className="font-bold text-[#111827] uppercase">Opener:</span>
                  <p className="text-[#374151] mt-0.5">
                    "Good morning, am I speaking with {decisionMakers[0]?.name || "the Principal Architect"} at {candidate.businessName}? Hi, my name is Rahul from D'furn Modular Systems."
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[#111827] uppercase">Observation Hook:</span>
                  <p className="text-[#374151] mt-0.5">
                    "We manufacture precision factory modular workstations and prelam panels for commercial architects in {candidate.city}. We maintain a free AutoCAD/Revit BIM workstation library and 24-hour factory BOQ service for commercial layouts and wanted to share direct access with your drafting team."
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[#111827] uppercase">Objection: "We already have on-site carpenters"</span>
                  <p className="text-[#374151] mt-0.5">
                    "Understood. Most studios keep carpenters for civil gypsum and site framing, but use our factory for workstations and cabinetry because our German beam saws produce 100 desks in 3 days with zero manual edge trimming."
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[#111827] uppercase">Close:</span>
                  <p className="text-[#374151] mt-0.5">
                    "Can I confirm the best WhatsApp number to send over our digital workstation catalog for your next floor plan?"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
