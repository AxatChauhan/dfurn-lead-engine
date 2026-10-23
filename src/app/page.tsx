"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Layers,
  Send,
  ExternalLink,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Building2,
  Check,
  AlertCircle
} from "lucide-react";

interface Candidate {
  id: string;
  businessName: string;
  category: string;
  city: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  totalScore: number;
  leadTier: string;
  fitScore: number;
  scaleScore: number;
  activityScore: number;
  accessibilityScore: number;
  synergyScore: number;
  reasoning?: string;
  status: string;
  whatsappAvailable?: boolean;
  syncedToErpAt?: string;
  erpEnquiryCode?: string;
  createdAt: string;
}

interface Counts {
  total: number;
  tierAPlus: number;
  tierA: number;
  tierB: number;
  tierC: number;
  syncedToErp: number;
}

export default function DashboardPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    tierAPlus: 0,
    tierA: 0,
    tierB: 0,
    tierC: 0,
    syncedToErp: 0,
  });
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);

  // Discovery Modal & Run States
  const [showDiscoveryModal, setShowDiscoveryModal] = useState<boolean>(false);
  const [industry, setIndustry] = useState<string>("Architects");
  const [city, setCity] = useState<string>("Ahmedabad");
  const [targetCount, setTargetCount] = useState<number>(20);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveryStep, setDiscoveryStep] = useState<string>("");

  // Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/candidates", window.location.origin);
      if (selectedTier !== "ALL") url.searchParams.set("tier", selectedTier);
      if (selectedCategory !== "ALL") url.searchParams.set("category", selectedCategory);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.candidates) {
        setCandidates(data.candidates);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error("Error loading candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [selectedTier, selectedCategory]);

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDiscovering(true);
    setDiscoveryStep("Launching Playwright Chromium & Google Maps Scraper...");

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, location: city, targetCount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Discovery failed");

      setShowDiscoveryModal(false);
      fetchCandidates();
    } catch (err: any) {
      alert("Discovery Error: " + err.message);
    } finally {
      setIsDiscovering(false);
      setDiscoveryStep("");
    }
  };

  const handlePushToErp = async (candidateId: string) => {
    try {
      setSyncingId(candidateId);
      const res = await fetch("/api/sync-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage({ id: candidateId, text: `Synced · ${data.enquiryCode}`, success: true });
        fetchCandidates();
      } else {
        setSyncMessage({ id: candidateId, text: data.error || "Failed", success: false });
      }
    } catch (err: any) {
      setSyncMessage({ id: candidateId, text: err.message || "Error", success: false });
    } finally {
      setSyncingId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            D'furn Lead Engine
          </h1>
          <p className="text-sm text-[#4B5563] mt-1">
            Zero-cost B2B discovery & 5D qualification for Architects, Interior Designers, and Commercial Fitout Contractors.
          </p>
        </div>
        <button
          onClick={() => setShowDiscoveryModal(true)}
          className="btn-primary"
        >
          <Sparkles className="w-4 h-4" />
          <span>+ Run Lead Discovery</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB]">
          <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">Total Discovered</span>
          <p className="text-2xl font-bold text-[#111827] mt-1">{counts.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4]/30">
          <span className="text-xs font-semibold text-[#166534] uppercase tracking-wider">Tier A+ (Swatch Kit)</span>
          <p className="text-2xl font-bold text-[#166534] mt-1">{counts.tierAPlus}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#A7F3D0]">
          <span className="text-xs font-semibold text-[#047857] uppercase tracking-wider">Tier A (Sequence)</span>
          <p className="text-2xl font-bold text-[#047857] mt-1">{counts.tierA}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#FDE68A]">
          <span className="text-xs font-medium text-[#B45309] uppercase tracking-wider">Tier B (Catalog)</span>
          <p className="text-2xl font-bold text-[#B45309] mt-1">{counts.tierB}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB]">
          <span className="text-xs font-medium text-[#2563EB] uppercase tracking-wider">Synced to ERP</span>
          <p className="text-2xl font-bold text-[#2563EB] mt-1">{counts.syncedToErp}</p>
        </div>
      </div>

      {/* Filter Chips Bar (Owner Mandate: Selected State is Strictly BLACK) */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
        {/* Tier Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#6B7280] mr-1 uppercase tracking-wider">Tier:</span>
          {["ALL", "A+", "A", "B", "C"].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`tab-pill ${selectedTier === tier ? "active" : ""}`}
            >
              {tier === "ALL" ? "All Leads" : `Tier ${tier}`}
            </button>
          ))}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#6B7280] mr-1 uppercase tracking-wider">Category:</span>
          {["ALL", "Architect", "Interior Designer", "Fitout Contractor"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`tab-pill ${selectedCategory === cat ? "active" : ""}`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Candidates List / Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#6B7280]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF7700]" />
            Loading prospects...
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280]">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF]" />
            <h3 className="text-base font-semibold text-[#111827]">No Leads Found</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              Click "+ Run Lead Discovery" to launch the zero-cost scraper for your target city.
            </p>
            <button
              onClick={() => setShowDiscoveryModal(true)}
              className="btn-primary mt-4 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Discover Leads Now</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-semibold text-[#4B5563] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Firm & Location</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">5D Score</th>
                  <th className="py-3.5 px-4">Direct Contact</th>
                  <th className="py-3.5 px-4">Commercial Signals</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {candidates.map((cand) => (
                  <tr key={cand.id} className="hover:bg-[#F9FAFB] transition">
                    {/* Firm Name */}
                    <td className="py-4 px-4">
                      <Link
                        href={`/candidates/${cand.id}`}
                        className="font-bold text-[#111827] hover:text-[#FF7700] flex items-center gap-1.5"
                      >
                        {cand.businessName}
                        <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      </Link>
                      <div className="text-xs text-[#6B7280] mt-0.5 flex items-center gap-1">
                        <span>{cand.city}</span>
                        {cand.rating ? (
                          <>
                            <span>·</span>
                            <span>★ {cand.rating} ({cand.reviewCount} reviews)</span>
                          </>
                        ) : null}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4">
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
                        {cand.category || "Architect"}
                      </span>
                    </td>

                    {/* 5D Score */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            cand.leadTier === "A+"
                              ? "badge-tier-aplus"
                              : cand.leadTier === "A"
                              ? "badge-tier-a"
                              : cand.leadTier === "B"
                              ? "badge-tier-b"
                              : "badge-tier-c"
                          }`}
                        >
                          Tier {cand.leadTier}
                        </span>
                        <span className="font-semibold text-xs text-[#111827]">
                          {cand.totalScore}/100
                        </span>
                      </div>
                    </td>

                    {/* Contact Channels */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {cand.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-[#111827]">
                            <Phone className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>{cand.phone}</span>
                            {cand.whatsappAvailable ? (
                              <span className="text-[10px] bg-[#DCFCE7] text-[#15803D] px-1 py-0.2 rounded font-medium">
                                WA
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">–</span>
                        )}
                        {cand.website ? (
                          <div className="flex items-center gap-1 text-xs text-[#2563EB]">
                            <ExternalLink className="w-3 h-3" />
                            <a
                              href={cand.website}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline truncate max-w-[140px]"
                            >
                              {cand.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Commercial Signals & Reasoning */}
                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-xs text-[#4B5563] line-clamp-2">
                        {cand.reasoning || "Standard candidate"}
                      </p>
                    </td>

                    {/* Quick Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cand.status === "SYNCED_TO_ERP" ? (
                          <span className="text-xs font-semibold text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded border border-[#A7F3D0] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            {cand.erpEnquiryCode || "Synced"}
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePushToErp(cand.id)}
                            disabled={syncingId === cand.id}
                            className="btn-secondary text-xs px-2.5 py-1 border-[#D1D5DB]"
                            title="Send to D'furn ERP Intake Webhook (localhost:3000)"
                          >
                            {syncingId === cand.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-[#FF7700]" />
                            )}
                            <span>Push to ERP</span>
                          </button>
                        )}

                        <Link
                          href={`/candidates/${cand.id}`}
                          className="btn-primary text-xs px-2.5 py-1"
                        >
                          Review
                        </Link>
                      </div>

                      {syncMessage && syncMessage.id === cand.id ? (
                        <div
                          className={`text-[11px] mt-1 ${
                            syncMessage.success ? "text-[#059669]" : "text-[#DC2626]"
                          }`}
                        >
                          {syncMessage.text}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discovery Modal (Stepped Milestone Wizard) */}
      {showDiscoveryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-[#E5E7EB] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-lg font-bold text-[#111827]">
                Run Zero-Cost Lead Discovery
              </h3>
              <button
                onClick={() => setShowDiscoveryModal(false)}
                className="text-[#6B7280] hover:text-[#111827] text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunDiscovery} className="space-y-4">
              {/* Target Segment Choice Pills */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] uppercase mb-1.5">
                  Target Segment
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Architects",
                    "Interior Designers",
                    "Turnkey Contractors",
                    "Coworking Spaces",
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setIndustry(cat)}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition ${
                        industry === cat
                          ? "bg-[#000000] text-white border-[#000000]"
                          : "bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F3F4F6]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target City */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] uppercase mb-1.5">
                  Target City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ahmedabad, Surat, Pune, Mumbai"
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#FF7700]"
                  required
                />
                <div className="flex gap-1.5 mt-2">
                  {["Ahmedabad", "Surat", "Pune", "Mumbai", "Bangalore"].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setCity(preset)}
                      className="text-xs bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563] px-2 py-1 rounded"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Slider / Pill */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] uppercase mb-1.5">
                  Prospect Batch Size
                </label>
                <div className="flex gap-2">
                  {[10, 20, 30].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setTargetCount(num)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                        targetCount === num
                          ? "bg-[#000000] text-white border-[#000000]"
                          : "bg-white text-[#374151] border-[#D1D5DB]"
                      }`}
                    >
                      {num} Leads
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowDiscoveryModal(false)}
                  className="btn-secondary text-sm"
                  disabled={isDiscovering}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={isDiscovering}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Discovery</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Screen Blocking Progress Overlay during discovery */}
      {isDiscovering ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-center mx-auto text-[#FF7700]">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">
                Discovering Modular Prospects
              </h3>
              <p className="text-xs text-[#4B5563] mt-1 font-mono">
                {discoveryStep || "Querying Google Maps & Bing search..."}
              </p>
            </div>
            <div className="text-xs text-[#6B7280]">
              Scraping live listings for <span className="font-semibold text-[#111827]">{industry}</span> in <span className="font-semibold text-[#111827]">{city}</span>.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
