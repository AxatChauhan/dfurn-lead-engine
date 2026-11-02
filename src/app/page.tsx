"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Send,
  Phone,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  Check,
  Download,
  Plus,
  MessageSquare,
  ExternalLink,
  X
} from "lucide-react";

interface Lead {
  id: string;
  businessName: string;
  contactPerson?: string;
  category: string;
  city: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  leadSource?: string;
  campaignName?: string;
  projectType?: string;
  workstationCount?: number;
  projectTimeline?: string;
  hasFloorPlan?: boolean;
  estimatedBudget?: string;
  qualificationStage?: string;
  operatorNotes?: string;
  lastContactedAt?: string;
  status: string;
  whatsappAvailable?: boolean;
  syncedToErpAt?: string;
  erpEnquiryCode?: string;
  createdAt: string;
  reasoning?: string;
}

interface StageCounts {
  total: number;
  new: number;
  contacted: number;
  followUp: number;
  qualified: number;
  converted: number;
  lost: number;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stageCounts, setStageCounts] = useState<StageCounts>({
    total: 0,
    new: 0,
    contacted: 0,
    followUp: 0,
    qualified: 0,
    converted: 0,
    lost: 0,
  });

  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Screen-blocking mutation loader state
  const [blockingLoader, setBlockingLoader] = useState<{ active: boolean; message: string }>({
    active: false,
    message: "",
  });

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [activeNotesLead, setActiveNotesLead] = useState<Lead | null>(null);
  const [editedNotes, setEditedNotes] = useState<string>("");
  const [editedWorkstations, setEditedWorkstations] = useState<number | string>("");
  const [editedFloorPlan, setEditedFloorPlan] = useState<boolean>(false);

  // Add Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    city: "Ahmedabad",
    category: "Commercial Office",
    projectType: "Modular Workstations",
    workstationCount: "30",
    projectTimeline: "1-2 months",
    hasFloorPlan: true,
    campaignName: "Meta_Ahd_Commercial_Q4",
    leadSource: "paid_ads_meta",
    notes: "",
  });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/candidates", window.location.origin);
      if (selectedStage !== "ALL") url.searchParams.set("stage", selectedStage);
      if (selectedSource !== "ALL") url.searchParams.set("source", selectedSource);
      if (selectedCity !== "ALL") url.searchParams.set("city", selectedCity);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.candidates) {
        setLeads(data.candidates);
        if (data.stageCounts) {
          setStageCounts(data.stageCounts);
        }
      }
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedStage, selectedSource, selectedCity]);

  // Stage update handler
  const handleUpdateStage = async (leadId: string, newStage: string) => {
    try {
      // Optimistic UI update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, qualificationStage: newStage } : l))
      );

      const res = await fetch(`/api/candidates/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualificationStage: newStage }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      fetchLeads();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
      fetchLeads();
    }
  };

  // 1-Click WhatsApp Launch
  const handleLaunchWhatsApp = (lead: Lead) => {
    const digitsOnly = (lead.phone || "").replace(/\D/g, "");
    let cleanPhone = digitsOnly;
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    const clientName = lead.contactPerson || lead.businessName || "there";
    const city = lead.city || "your city";
    const project = lead.projectType || "modular furniture";

    const msg = `Hi ${clientName}, thank you for your interest in D'furn Modular Systems regarding ${project} in ${city}. Sharing our 2026 Commercial Lookbook and finish options. Do you have an active floor plan or layout to share for a quick 48-hour CAD costing?`;

    // Optimistically update stage to CONTACTED if it was NEW
    if ((lead.qualificationStage || "NEW") === "NEW") {
      handleUpdateStage(lead.id, "CONTACTED");
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  // 1-Click Push to D'furn ERP
  const handlePushToErp = async (leadId: string) => {
    setBlockingLoader({
      active: true,
      message: "Syncing lead into D'furn ERP Intake Webhook (localhost:3000)...",
    });

    try {
      const res = await fetch("/api/sync-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: leadId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchLeads();
      } else {
        alert("ERP Sync Notice: " + (data.error || data.message || "Failed to sync with ERP"));
      }
    } catch (err: any) {
      alert("Network Error connecting to D'furn ERP: " + err.message);
    } finally {
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // CSV Export Download
  const handleExportCsv = () => {
    setBlockingLoader({
      active: true,
      message: "Generating RFC 4180 CSV export for D'furn ERP Enquiry module...",
    });

    try {
      const url = new URL("/api/leads/export", window.location.origin);
      if (selectedStage !== "ALL") url.searchParams.set("stage", selectedStage);
      if (selectedSource !== "ALL") url.searchParams.set("source", selectedSource);
      if (selectedCity !== "ALL") url.searchParams.set("city", selectedCity);

      // Trigger browser download via invisible anchor
      const a = document.createElement("a");
      a.href = url.toString();
      a.download = `dfurn_leads_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setTimeout(() => {
        setBlockingLoader({ active: false, message: "" });
      }, 700);
    }
  };

  // Manual Add Lead Submit
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockingLoader({
      active: true,
      message: "Capturing and normalizing new ad lead...",
    });

    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeadForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lead");

      setShowAddLeadModal(false);
      setNewLeadForm({
        businessName: "",
        contactPerson: "",
        phone: "",
        email: "",
        city: "Ahmedabad",
        category: "Commercial Office",
        projectType: "Modular Workstations",
        workstationCount: "30",
        projectTimeline: "1-2 months",
        hasFloorPlan: true,
        campaignName: "Meta_Ahd_Commercial_Q4",
        leadSource: "paid_ads_meta",
        notes: "",
      });
      await fetchLeads();
    } catch (err: any) {
      alert("Error adding lead: " + err.message);
    } finally {
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // Notes Modal Save
  const handleSaveNotes = async () => {
    if (!activeNotesLead) return;
    setBlockingLoader({
      active: true,
      message: "Saving project notes and requirement details...",
    });

    try {
      const res = await fetch(`/api/candidates/${activeNotesLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorNotes: editedNotes,
          workstationCount: editedWorkstations,
          hasFloorPlan: editedFloorPlan,
        }),
      });

      if (!res.ok) throw new Error("Failed to save notes");
      setActiveNotesLead(null);
      await fetchLeads();
    } catch (err: any) {
      alert("Error saving notes: " + err.message);
    } finally {
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // Lead Freshness Latency calculation
  const getFreshnessLabel = (createdAt: string) => {
    if (!createdAt) return { text: "–", badgeClass: "text-[#6B7280] bg-[#F3F4F6]" };
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return {
        text: `${diffMinutes}m ago`,
        badgeClass: "text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] font-semibold",
      };
    }
    if (diffHours < 24) {
      return {
        text: `${diffHours}h ago`,
        badgeClass: "text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A]",
      };
    }
    return {
      text: `${diffDays}d ago`,
      badgeClass: "text-[#4B5563] bg-[#F3F4F6] border border-[#E5E7EB]",
    };
  };

  // Filtered Leads by search query
  const displayedLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.businessName.toLowerCase().includes(q) ||
      (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.projectType && l.projectType.toLowerCase().includes(q)) ||
      (l.campaignName && l.campaignName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Screen Blocking Mutation Loader */}
      {blockingLoader.active && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <RefreshCw className="w-8 h-8 text-[#FF7700] animate-spin" />
            <div>
              <h4 className="font-bold text-[#111827]">Processing Action</h4>
              <p className="text-xs text-[#6B7280] mt-1">{blockingLoader.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header & Conversion Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="bg-[#FF7700] text-white font-extrabold text-xs tracking-wider px-2 py-0.5 rounded">
              D'FURN
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">
              Lead Management & Conversion Cockpit
            </h1>
          </div>
          <p className="text-xs text-[#4B5563] mt-1.5">
            Speed-to-lead response, operator-controlled qualification, and frictionless ERP enquiry conversion for Paid Ads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="btn-secondary text-xs px-3.5 py-2 font-semibold text-[#111827] border-[#D1D5DB] hover:bg-[#F3F4F6] transition shadow-xs flex items-center gap-2"
            title="Download CSV formatted for D'furn ERP Enquiry Module"
          >
            <Download className="w-4 h-4 text-[#4B5563]" />
            <span>Export to CSV</span>
          </button>

          <button
            onClick={() => setShowAddLeadModal(true)}
            className="btn-primary text-xs px-4 py-2 font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Capture Ad Lead</span>
          </button>
        </div>
      </div>

      {/* Operational Stage Navigation (Selected State is Strictly BLACK) */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            Qualification Pipeline:
          </span>
          <span className="text-xs text-[#9CA3AF]">
            Operator controls all stages · Zero automatic gatekeeping
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "All Leads", count: stageCounts.total },
            { id: "NEW", label: "New Leads", count: stageCounts.new },
            { id: "CONTACTED", label: "Contacted", count: stageCounts.contacted },
            { id: "FOLLOW_UP", label: "Follow-up Required", count: stageCounts.followUp },
            { id: "QUALIFIED", label: "Qualified (Ready for ERP)", count: stageCounts.qualified },
            { id: "CONVERTED", label: "Converted to ERP", count: stageCounts.converted },
            { id: "LOST", label: "Lost / Retail", count: stageCounts.lost },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStage(st.id)}
              className={`tab-pill flex items-center gap-1.5 text-xs ${
                selectedStage === st.id ? "active" : ""
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedStage === st.id
                    ? "bg-[#333333] text-white"
                    : "bg-[#F3F4F6] text-[#4B5563]"
                }`}
              >
                {st.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Filter Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mr-1">
              Source:
            </span>
            {[
              { id: "ALL", label: "All Sources" },
              { id: "paid_ads_meta", label: "Meta Ads" },
              { id: "paid_ads_google", label: "Google Ads" },
              { id: "website_form", label: "Web Forms" },
              { id: "google_maps", label: "Outbound Scraped" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSource(s.id)}
                className={`tab-pill text-xs py-1 px-2.5 ${
                  selectedSource === s.id ? "active" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* City Filter Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mr-1">
              City:
            </span>
            {["ALL", "Ahmedabad", "Pune", "Surat"].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCity(c)}
                className={`tab-pill text-xs py-1 px-2.5 ${
                  selectedCity === c ? "active" : ""
                }`}
              >
                {c === "ALL" ? "All Cities" : c}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, contact, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#D1D5DB] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF7700]"
          />
        </div>
      </div>

      {/* Leads Cockpit Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-[#6B7280]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF7700]" />
            Loading lead pipeline...
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280]">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF]" />
            <h3 className="text-base font-semibold text-[#111827]">No Leads Found in this View</h3>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              Change your active filter stage or click "+ Capture Ad Lead" to record an incoming inquiry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Prospect & Campaign</th>
                  <th className="py-3.5 px-4">Requirement & Scale</th>
                  <th className="py-3.5 px-4">Rapid Reply (Speed SLA)</th>
                  <th className="py-3.5 px-4">Qualification Stage</th>
                  <th className="py-3.5 px-4">Project Brief & Notes</th>
                  <th className="py-3.5 px-4 text-right">ERP Handoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {displayedLeads.map((lead) => {
                  const freshness = getFreshnessLabel(lead.createdAt);
                  const isSynced = lead.status === "SYNCED_TO_ERP" || Boolean(lead.erpEnquiryCode);
                  const currentStage = lead.qualificationStage || "NEW";

                  return (
                    <tr key={lead.id} className="hover:bg-[#F9FAFB]/75 transition">
                      {/* Prospect & Campaign */}
                      <td className="py-4 px-4 min-w-[200px]">
                        <div className="font-bold text-sm text-[#111827] flex items-center gap-1.5">
                          <span>{lead.businessName}</span>
                          <Link
                            href={`/candidates/${lead.id}`}
                            className="text-[#9CA3AF] hover:text-[#FF7700]"
                            title="Open Deep Dive Details"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>

                        {lead.contactPerson ? (
                          <div className="text-xs text-[#4B5563] font-medium mt-0.5">
                            Contact: {lead.contactPerson}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-[#4B5563] font-medium bg-[#F3F4F6] px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                            {lead.city}
                          </span>

                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${freshness.badgeClass}`}>
                            {freshness.text}
                          </span>

                          {lead.leadSource?.startsWith("paid_ads") ? (
                            <span className="text-[10px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-1.5 py-0.5 rounded">
                              {lead.leadSource === "paid_ads_meta" ? "Meta Ad" : "Google Ad"}
                            </span>
                          ) : lead.leadSource === "website_form" ? (
                            <span className="text-[10px] font-semibold bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] px-1.5 py-0.5 rounded">
                              Web Form
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                              Scraped
                            </span>
                          )}
                        </div>

                        {lead.campaignName ? (
                          <div className="text-[10px] text-[#6B7280] mt-1 truncate max-w-[220px]" title={lead.campaignName}>
                            Campaign: {lead.campaignName}
                          </div>
                        ) : null}
                      </td>

                      {/* Requirement & Scale */}
                      <td className="py-4 px-4 min-w-[170px]">
                        <div className="font-semibold text-[#111827] text-xs">
                          {lead.projectType || "Modular Furniture"}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {lead.workstationCount && lead.workstationCount > 0 ? (
                            <span className="text-[11px] font-bold text-[#166534] bg-[#DCFCE7] border border-[#86EFAC] px-2 py-0.5 rounded">
                              {lead.workstationCount} Workstations
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                              Scope TBD
                            </span>
                          )}

                          {lead.hasFloorPlan ? (
                            <span className="text-[10px] font-medium text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-1.5 py-0.5 rounded">
                              ✓ Layout Ready
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB] px-1.5 py-0.5 rounded">
                              No Layout
                            </span>
                          )}
                        </div>

                        {lead.projectTimeline ? (
                          <div className="text-[10px] text-[#6B7280] mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Timeline: {lead.projectTimeline}</span>
                          </div>
                        ) : null}
                      </td>

                      {/* Rapid Reply (Speed SLA Actions) */}
                      <td className="py-4 px-4 min-w-[160px]">
                        <div className="space-y-1.5">
                          {lead.phone ? (
                            <button
                              onClick={() => handleLaunchWhatsApp(lead)}
                              className="w-full text-xs font-semibold bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] border border-[#25D366]/30 px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition"
                              title="Launch WhatsApp Web with pre-filled modular pitch"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                              <span>1-Click WhatsApp</span>
                            </button>
                          ) : null}

                          <div className="flex items-center justify-between text-[11px] text-[#4B5563]">
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-[#111827] hover:text-[#FF7700] font-medium flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-[#6B7280]" />
                                <span>{lead.phone}</span>
                              </a>
                            ) : (
                              <span className="text-[#9CA3AF]">No Phone</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Qualification Stage Selector (Pill Segmented Control) */}
                      <td className="py-4 px-4 min-w-[230px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {[
                            { id: "NEW", label: "New" },
                            { id: "CONTACTED", label: "Contacted" },
                            { id: "FOLLOW_UP", label: "Follow-up" },
                            { id: "QUALIFIED", label: "Qualified" },
                            { id: "LOST", label: "Lost" },
                          ].map((st) => (
                            <button
                              key={st.id}
                              onClick={() => handleUpdateStage(lead.id, st.id)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition ${
                                currentStage === st.id
                                  ? "bg-[#000000] text-white border-[#000000]"
                                  : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]"
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Project Brief & Notes */}
                      <td className="py-4 px-4 max-w-[220px]">
                        <div
                          onClick={() => {
                            setActiveNotesLead(lead);
                            setEditedNotes(lead.operatorNotes || lead.reasoning || "");
                            setEditedWorkstations(lead.workstationCount || "");
                            setEditedFloorPlan(Boolean(lead.hasFloorPlan));
                          }}
                          className="cursor-pointer group p-1.5 rounded hover:bg-white border border-transparent hover:border-[#D1D5DB] transition"
                          title="Click to edit project notes & scope"
                        >
                          <p className="text-[11px] text-[#4B5563] line-clamp-2">
                            {lead.operatorNotes || lead.reasoning || "Click to add project notes..."}
                          </p>
                          <span className="text-[10px] text-[#FF7700] font-medium opacity-0 group-hover:opacity-100 transition mt-0.5 inline-block">
                            ✎ Edit Notes & Scope
                          </span>
                        </div>
                      </td>

                      {/* ERP Handoff Actions */}
                      <td className="py-4 px-4 text-right min-w-[140px]">
                        {isSynced ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 rounded-md flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>{lead.erpEnquiryCode || "Synced to ERP"}</span>
                            </span>
                            <span className="text-[9px] text-[#059669]">In ERP Enquiry Master</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePushToErp(lead.id)}
                            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition inline-flex items-center gap-1.5 ${
                              currentStage === "QUALIFIED"
                                ? "bg-[#FF7700] hover:bg-[#E06900] text-white shadow-xs"
                                : "bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB]"
                            }`}
                            title="Push qualified lead into D'furn ERP Intake Webhook (localhost:3000)"
                          >
                            <Send className="w-3 h-3" />
                            <span>Push to ERP</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Add/Capture Ad Lead Manually */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FF7700]" />
                <h3 className="font-bold text-base text-[#111827]">
                  Capture New Ad Lead
                </h3>
              </div>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Company / Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech Park"
                    value={newLeadForm.businessName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Shah"
                    value={newLeadForm.contactPerson}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98250 12345"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.in"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">City</label>
                  <input
                    type="text"
                    value={newLeadForm.city}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Workstation Count</label>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={newLeadForm.workstationCount}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, workstationCount: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Ad Source</label>
                  <div className="flex gap-2">
                    {["paid_ads_meta", "paid_ads_google", "website_form"].map((src) => (
                      <button
                        type="button"
                        key={src}
                        onClick={() => setNewLeadForm({ ...newLeadForm, leadSource: src })}
                        className={`text-[10px] py-1 px-2 rounded-full border ${
                          newLeadForm.leadSource === src
                            ? "bg-black text-white border-black font-semibold"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        {src === "paid_ads_meta" ? "Meta" : src === "paid_ads_google" ? "Google" : "Web"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Floor Plan Available?</label>
                  <div className="flex gap-2">
                    {[true, false].map((val) => (
                      <button
                        type="button"
                        key={String(val)}
                        onClick={() => setNewLeadForm({ ...newLeadForm, hasFloorPlan: val })}
                        className={`text-[10px] py-1 px-3 rounded-full border ${
                          newLeadForm.hasFloorPlan === val
                            ? "bg-black text-white border-black font-semibold"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        {val ? "Yes (CAD Ready)" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1">Ad Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Meta_Ahd_Commercial_Q4"
                  value={newLeadForm.campaignName}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, campaignName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1">Project Notes & Inquiry Brief</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Looking for 40 linear workstations with pin-up acoustic screens..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-5 py-2"
                >
                  Capture Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Notes & Project Scope */}
      {activeNotesLead && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div>
                <h3 className="font-bold text-sm text-[#111827]">
                  Project Notes: {activeNotesLead.businessName}
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  Update customer requirement details, workstation scope, and layout status.
                </p>
              </div>
              <button
                onClick={() => setActiveNotesLead(null)}
                className="text-[#9CA3AF] hover:text-[#111827]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Workstation Count</label>
                  <input
                    type="number"
                    value={editedWorkstations}
                    onChange={(e) => setEditedWorkstations(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Floor Plan Available</label>
                  <div className="flex gap-2">
                    {[true, false].map((val) => (
                      <button
                        type="button"
                        key={String(val)}
                        onClick={() => setEditedFloorPlan(val)}
                        className={`text-[10px] py-1.5 px-3 rounded-full border ${
                          editedFloorPlan === val
                            ? "bg-black text-white border-black font-semibold"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        {val ? "Yes (Available)" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1">Operator Conversation Notes</label>
                <textarea
                  rows={4}
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Record customer discussion points, site address, delivery deadlines..."
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#FF7700]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setActiveNotesLead(null)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  className="btn-primary text-xs px-5 py-2"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
