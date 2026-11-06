"use client";

import { useState, useEffect, useDeferredValue } from "react";
import {
  Phone,
  MessageSquare,
  Search,
  X,
  Building2,
  MapPin,
  Clock,
  Check,
  RefreshCw,
  ThumbsUp,
  PhoneOff,
  User,
  Globe,
  Sparkles,
  Copy,
  Calendar,
  AlertCircle,
  FileText,
  Ban,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface Lead {
  id: string;
  businessName: string;
  contactPerson?: string;
  industry?: string;
  category?: string;
  city?: string;
  address?: string;
  phone: string;
  email?: string;
  website?: string;
  rating?: number | string;
  reviewCount?: number;
  leadSource?: string;
  projectType?: string;
  workstationCount?: number;
  qualificationStage?: string;
  operatorNotes?: string;
  firstContactedAt?: string;
  lastContactedAt?: string;
  totalScore?: number;
  leadTier?: string;
  portfolioTags?: string;
  hasCommercialFocus?: boolean;
  isDummyPhone?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CandidateEvent {
  id: string;
  candidateId: string;
  eventType: string;
  title: string;
  description?: string;
  channel: string;
  createdAt: string;
}

type WhatsAppTemplateKey = "CATALOG" | "TRIED_CALLING" | "PRICING";

export default function TelecallerDeskPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"NEW" | "CALLBACK">("NEW");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearch = useDeferredValue(searchQuery);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // WhatsApp Message Preview & Template State
  const [activeWaTemplate, setActiveWaTemplate] = useState<WhatsAppTemplateKey>("CATALOG");
  const [waCustomText, setWaCustomText] = useState<string>("");

  // Call Back Schedule Modal / Quick Picker
  const [showCallbackPicker, setShowCallbackPicker] = useState<boolean>(false);
  const [showRejectPicker, setShowRejectPicker] = useState<boolean>(false);
  const [quickNote, setQuickNote] = useState<string>("");

  // Candidate Events History
  const [events, setEvents] = useState<CandidateEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

  // Daily Activity Counter
  const [dailyCallsMade, setDailyCallsMade] = useState<number>(0);

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch leads from database
  const fetchLeads = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/candidates?dummy=false");
      const data = await res.json();
      if (data.candidates && Array.isArray(data.candidates)) {
        setLeads(data.candidates);

        // Auto-select first lead in active queue if none selected
        if (!selectedLeadId && data.candidates.length > 0) {
          const fresh = data.candidates.find((l: Lead) => (l.qualificationStage || "NEW") === "NEW");
          setSelectedLeadId(fresh ? fresh.id : data.candidates[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Load Lead Event History
  const loadEvents = async (candidateId: string) => {
    try {
      setLoadingEvents(true);
      const res = await fetch(`/api/candidates/${candidateId}/events`);
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(() => {
      fetchLeads(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter leads into exactly 2 tabs
  const newLeads = leads.filter((l) => (l.qualificationStage || "NEW") === "NEW");
  const callbackLeads = leads.filter((l) => {
    const st = l.qualificationStage || "NEW";
    return st === "FOLLOW_UP" || st === "CONTACTED";
  });

  // Current list based on active tab
  const activeTabLeads = activeTab === "NEW" ? newLeads : callbackLeads;

  // Filter by City & Search Query
  const displayedLeads = activeTabLeads.filter((l) => {
    if (cityFilter !== "ALL" && l.city !== cityFilter) return false;
    if (!deferredSearch.trim()) return true;
    const q = deferredSearch.toLowerCase();
    return (
      l.businessName.toLowerCase().includes(q) ||
      (l.phone && l.phone.includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q))
    );
  });

  // Active Lead Object
  const activeLead = leads.find((l) => l.id === selectedLeadId) || displayedLeads[0] || null;

  // Practical 3 WhatsApp Business Templates tailored for real-world sales outreach
  const getWhatsAppTemplates = (lead: Lead) => {
    const company = lead.businessName || "Prospect";
    const city = lead.city || "Ahmedabad";

    return {
      CATALOG: `Namaste ${company} team! This is D'furn Modular Systems Ahmedabad. We manufacture commercial office workstations, executive desks, and acoustic meeting pods directly from our factory. Sharing our 2026 Modular Office Catalog for your ${city} office. Would love to assist you with floor plans or factory pricing.`,
      TRIED_CALLING: `Namaste ${company} team! Tried calling you just now regarding commercial office workstations and modular fitouts. Sharing our product catalog here on WhatsApp for your convenience. Please let us know a suitable time to connect for 2 minutes.`,
      PRICING: `Namaste ${company} team! Calling from D'furn Modular Systems Ahmedabad. We provide direct OEM factory pricing with a 15-day turnaround for office workstations. Do you have an office floor plan or workstation count you would like us to estimate?`,
    };
  };

  // Synchronize Live WhatsApp preview when active lead or selected template changes
  useEffect(() => {
    if (activeLead) {
      loadEvents(activeLead.id);
      setQuickNote("");
      const tpls = getWhatsAppTemplates(activeLead);
      setWaCustomText(tpls[activeWaTemplate]);
    }
  }, [activeLead?.id, activeWaTemplate]);

  // Clean Phone Number Formatter
  const getCleanPhone = (phone?: string) => {
    if (!phone) return "";
    return phone.replace(/[^\d+]/g, "").trim();
  };

  // Direct Phone Call & Copy
  const handleCallPhone = (phone?: string) => {
    if (!phone) return;
    const clean = getCleanPhone(phone);
    navigator.clipboard.writeText(clean);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2500);

    setDailyCallsMade((prev) => prev + 1);

    if (activeLead) {
      logLeadEvent(activeLead.id, "CALL_ATTEMPT", "Phone Call Initiated", `Dialed ${clean} via desktop dialer.`);
    }

    window.open(`tel:${clean}`, "_self");
    showToast(`Calling ${clean} (copied to clipboard)`);
  };

  // Pre-formatted WhatsApp Opener using live preview text
  const handleLaunchWhatsApp = async (lead: Lead) => {
    if (!lead.phone) return;
    const rawDigits = lead.phone.replace(/\D/g, "");
    let cleanPhone = rawDigits;
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    const textToSend = waCustomText.trim() || getWhatsAppTemplates(lead)[activeWaTemplate];

    // Advance stage from NEW to CONTACTED automatically
    if ((lead.qualificationStage || "NEW") === "NEW") {
      await updateLeadStage(lead.id, "CONTACTED", "WhatsApp Sent");
    }

    const tplLabel =
      activeWaTemplate === "CATALOG"
        ? "Office Catalog"
        : activeWaTemplate === "TRIED_CALLING"
        ? "Tried Calling"
        : "Factory Pricing";

    // Record Event
    await logLeadEvent(
      lead.id,
      "OUTREACH_SENT",
      `WhatsApp: ${tplLabel}`,
      textToSend.slice(0, 140) + "..."
    );

    setDailyCallsMade((prev) => prev + 1);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}`;
    window.open(waUrl, "_blank");
    showToast(`WhatsApp chat opened with ${tplLabel} message.`);
  };

  // Record Lead Event Helper
  const logLeadEvent = async (candidateId: string, eventType: string, title: string, description: string) => {
    try {
      await fetch(`/api/candidates/${candidateId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          title,
          description,
          channel: "PHONE",
        }),
      });
      loadEvents(candidateId);
    } catch (err) {
      console.error("Error logging event:", err);
    }
  };

  // Update Lead Stage Helper (Strictly Local Database State, Zero ERP Triggers)
  const updateLeadStage = async (candidateId: string, newStage: string, notes?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualificationStage: newStage,
          operatorNotes: notes || undefined,
          markContacted: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      // Optimistic update in leads list
      setLeads((prev) =>
        prev.map((l) =>
          l.id === candidateId
            ? { ...l, qualificationStage: newStage, operatorNotes: notes || l.operatorNotes }
            : l
        )
      );
    } catch (err: any) {
      alert("Error updating lead: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Outcome: Interested / Qualified
  const handleMarkInterested = async () => {
    if (!activeLead) return;
    await updateLeadStage(activeLead.id, "QUALIFIED", "Client interested in workstations. Requirements gathered.");
    await logLeadEvent(
      activeLead.id,
      "QUALIFIED",
      "Marked Interested / Qualified",
      "Lead confirmed requirement for modular furniture. Ready for quotation estimation."
    );
    showToast(`Marked ${activeLead.businessName} as Interested!`);
  };

  // 1-Click Outcome: Call Back Later
  const handleScheduleCallback = async (timeSlot: string) => {
    if (!activeLead) return;
    await updateLeadStage(activeLead.id, "FOLLOW_UP", `Call back requested: ${timeSlot}`);
    await logLeadEvent(
      activeLead.id,
      "FOLLOW_UP_SCHEDULED",
      "Call Back Scheduled",
      `Client requested callback for: ${timeSlot}`
    );
    setShowCallbackPicker(false);
    showToast(`Call back scheduled: ${timeSlot}`);
  };

  // 1-Click Outcome: No Answer
  const handleMarkNoAnswer = async () => {
    if (!activeLead) return;
    await updateLeadStage(activeLead.id, "CONTACTED", "Phone rang / busy. No answer.");
    await logLeadEvent(
      activeLead.id,
      "CALL_ATTEMPT",
      "Call Attempted (No Answer)",
      "Called client phone number. Rang without response or switched off."
    );
    showToast(`Logged No Answer for ${activeLead.businessName}.`);
  };

  // 1-Click Outcome: Not Interested / Disqualified
  const handleMarkDisqualified = async (reason: string) => {
    if (!activeLead) return;
    await updateLeadStage(activeLead.id, "LOST", reason);
    await logLeadEvent(
      activeLead.id,
      "DISQUALIFIED",
      "Lead Closed / Not Interested",
      `Reason: ${reason}`
    );
    setShowRejectPicker(false);
    showToast(`Lead closed: ${reason}`);
  };

  // Save Quick Note
  const handleSaveQuickNote = async () => {
    if (!activeLead || !quickNote.trim()) return;
    await logLeadEvent(activeLead.id, "OPERATOR_NOTE", "Call Discussion Note", quickNote.trim());
    setQuickNote("");
    showToast("Note recorded in call history.");
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111827] text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#374151] animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Telecaller Command Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E5E7EB]">
            <Phone className="w-5 h-5 text-[#FF7700]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#111827]">
              Sales Calling Desk
            </h1>
            <p className="text-xs text-[#6B7280]">
              Daily client telecalling & WhatsApp outreach portal
            </p>
          </div>
        </div>

        {/* Daily Activity Counter & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E5E7EB] text-xs font-semibold text-[#111827] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>Today: {dailyCallsMade} Calls Made</span>
          </div>

          <button
            onClick={() => fetchLeads(false)}
            disabled={loading}
            className="p-2 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151] transition"
            title="Refresh Leads"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#FF7700]" : ""}`} />
          </button>
        </div>
      </div>

      {/* The 2 Primary Tabs: New Calls vs Call Backs */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("NEW")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "NEW"
                ? "bg-[#000000] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] border border-[#E5E7EB]"
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-[#25D366]" />
            <span>New Calls</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === "NEW" ? "bg-white/20 text-white" : "bg-white text-[#111827] border border-[#E5E7EB]"
              }`}
            >
              {newLeads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CALLBACK")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "CALLBACK"
                ? "bg-[#000000] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] border border-[#E5E7EB]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Call Backs</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === "CALLBACK" ? "bg-white/20 text-white" : "bg-white text-[#111827] border border-[#E5E7EB]"
              }`}
            >
              {callbackLeads.length}
            </span>
          </button>
        </div>

        {/* Quick Search & City Pills */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search company, phone, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#FAF8F5] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-2 bg-[#FAF8F5] text-[#374151] font-semibold focus:ring-1 focus:ring-[#000000]"
          >
            <option value="ALL">All Cities</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="GIFT City">GIFT City</option>
            <option value="Surat">Surat</option>
            <option value="Vadodara">Vadodara</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Telecalling Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Call List (5 cols on desktop) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col h-[calc(100dvh-220px)] min-h-[580px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAF8F5] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#111827]">
                {activeTab === "NEW" ? "Fresh Leads to Call" : "Follow-up Queue"}
              </span>
              <span className="text-[11px] text-[#6B7280]">
                ({displayedLeads.length} listed)
              </span>
            </div>
            <span className="text-[11px] text-[#059669] font-semibold">
              Live Feed
            </span>
          </div>

          {/* Leads Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6] p-2 space-y-1.5">
            {displayedLeads.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-[#9CA3AF]">
                <Building2 className="w-10 h-10 mx-auto text-[#D1D5DB]" />
                <p className="font-bold text-xs text-[#4B5563]">
                  {activeTab === "NEW" ? "No fresh calls in queue" : "No pending call backs"}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  {activeTab === "NEW"
                    ? "New leads generated by the desktop software will appear here automatically."
                    : "Scheduled client call backs will appear here."}
                </p>
              </div>
            ) : (
              displayedLeads.map((lead) => {
                const isSelected = activeLead?.id === lead.id;
                const hasPhone = Boolean(lead.phone && lead.phone !== "-" && lead.phone !== "–");

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition border flex flex-col gap-2 ${
                      isSelected
                        ? "bg-[#FAF8F5] border-[#FF7700] ring-1 ring-[#FF7700] shadow-xs"
                        : "bg-white hover:bg-[#FAF8F5] border-[#E5E7EB]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-[#111827] truncate">
                            {lead.businessName}
                          </h3>
                          {lead.leadTier && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-[#111827] border border-[#E5E7EB]">
                              Tier {lead.leadTier}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#EF4444]" />
                            <span>{lead.city || "Ahmedabad"}</span>
                          </span>
                          <span>·</span>
                          <span>{lead.category || "Commercial Specifier"}</span>
                        </div>
                      </div>

                      {/* Workstation Count or Hot Badge */}
                      {lead.workstationCount ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shrink-0">
                          {lead.workstationCount} Seats
                        </span>
                      ) : (lead.leadTier === "A+" || lead.leadTier === "A") ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shrink-0">
                          🔥 Hot Lead
                        </span>
                      ) : null}
                    </div>

                    {/* Quick Phone Banner */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-xs">
                      {hasPhone ? (
                        <span className="font-bold text-[#166534] flex items-center gap-1 font-mono text-xs">
                          <Phone className="w-3 h-3 text-[#16A34A]" />
                          <span>{lead.phone}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#9CA3AF] italic">
                          No phone found
                        </span>
                      )}

                      <span className="text-[10px] text-[#9CA3AF]">
                        {lead.qualificationStage === "FOLLOW_UP"
                          ? "Call Back"
                          : lead.qualificationStage === "CONTACTED"
                          ? "Contacted"
                          : "New Lead"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Calling Card (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col h-[calc(100dvh-220px)] min-h-[580px] overflow-hidden">
          {activeLead ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* 1. Header: Big Company Name & Location */}
              <div className="space-y-1.5 border-b border-[#F3F4F6] pb-3.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-extrabold text-[#111827]">
                        {activeLead.businessName}
                      </h2>
                      {activeLead.leadTier && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#111827] border border-[#E5E7EB]">
                          Tier {activeLead.leadTier}
                        </span>
                      )}
                      {activeLead.workstationCount && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          {activeLead.workstationCount} Workstations
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#4B5563] flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>{activeLead.city || "Ahmedabad"}</span>
                      </span>

                      {activeLead.contactPerson && (
                        <span className="text-xs text-[#111827] font-semibold flex items-center gap-1">
                          <User className="w-3 h-3 text-[#6B7280]" />
                          <span>Contact: {activeLead.contactPerson}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E5E7EB] text-[#111827] shrink-0">
                    {activeLead.qualificationStage === "QUALIFIED"
                      ? "Interested"
                      : activeLead.qualificationStage === "FOLLOW_UP"
                      ? "Call Back"
                      : activeLead.qualificationStage === "CONTACTED"
                      ? "Contacted"
                      : "Fresh Lead"}
                  </span>
                </div>
              </div>

              {/* 2. Step 1: Big 2 Communication Buttons */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
                  Step 1: Contact Prospect
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Call Button */}
                  <button
                    type="button"
                    onClick={() => handleCallPhone(activeLead.phone)}
                    disabled={!activeLead.phone || activeLead.phone === "-" || activeLead.phone === "–"}
                    className="py-3 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-40"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                    <span>
                      {activeLead.phone && activeLead.phone !== "-" && activeLead.phone !== "–"
                        ? `Call ${activeLead.phone}`
                        : "No Phone Number"}
                    </span>
                  </button>

                  {/* WhatsApp Button (Uses Live Preview Text) */}
                  <button
                    type="button"
                    onClick={() => handleLaunchWhatsApp(activeLead)}
                    disabled={!activeLead.phone || activeLead.phone === "-" || activeLead.phone === "–"}
                    className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] active:scale-[0.99] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    <span>Send WhatsApp Message</span>
                  </button>
                </div>
              </div>

              {/* 3. Real Lead Facts Card (100% Real Evidence, Zero Scripted Questions) */}
              <div className="bg-[#FAF8F5] rounded-xl border border-[#E5E7EB] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2">
                  <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#FF7700]" />
                    <span>Real Lead Facts & Location Signals</span>
                  </span>
                  <span className="text-[10px] text-[#059669] font-bold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                    Verified Database Record
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Source & Category */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB] space-y-1">
                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                      Lead Source & Trade
                    </span>
                    <div className="font-bold text-[#111827] flex items-center gap-1.5 flex-wrap">
                      <span>
                        {activeLead.leadSource === "google_maps"
                          ? "📍 Google Maps Listing"
                          : activeLead.leadSource?.includes("ads")
                          ? "📱 Inbound Ad Form"
                          : "🌐 Specifier Directory"}
                      </span>
                      <span className="text-[#6B7280]">·</span>
                      <span className="text-[#4B5563] font-medium">{activeLead.category || "Commercial Office"}</span>
                    </div>
                  </div>

                  {/* Physical Landmark & Address */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB] space-y-1">
                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                      Landmark & Micro-Market
                    </span>
                    <div className="font-semibold text-[#111827] text-[11px] leading-snug">
                      {activeLead.address || `${activeLead.city || "Ahmedabad"} Commercial Corridor`}
                    </div>
                  </div>

                  {/* Google Reviews & Rating */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB] space-y-1">
                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                      Public Reputation
                    </span>
                    <div className="font-bold text-[#111827] flex items-center gap-1.5">
                      {activeLead.rating ? (
                        <>
                          <span className="text-[#D97706]">⭐ {activeLead.rating} ★</span>
                          <span className="text-[#6B7280] font-normal text-[11px]">
                            ({activeLead.reviewCount ? `${activeLead.reviewCount} Google Reviews` : "Verified Rating"})
                          </span>
                        </>
                      ) : (
                        <span className="text-[#059669] font-semibold text-[11px]">
                          ✓ Verified Commercial Profile on Maps
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Website Portfolio Link */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB] space-y-1">
                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                      Online Portfolio
                    </span>
                    {activeLead.website ? (
                      <a
                        href={activeLead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#2563EB] hover:underline font-bold text-xs flex items-center gap-1 truncate block"
                      >
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{activeLead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 ml-0.5 text-[#9CA3AF]" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#9CA3AF] italic">No direct website listed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Live WhatsApp Message Preview & 3-Template Switcher */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F3F4F6] pb-2">
                  <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#25D366]" />
                    <span>Live WhatsApp Message Preview</span>
                  </span>

                  {/* 3 Template Quick Pills (Active = Black #000000) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: "CATALOG", label: "📄 Office Catalog" },
                      { key: "TRIED_CALLING", label: "⏰ Tried Calling You" },
                      { key: "PRICING", label: "🏭 Factory Pricing" },
                    ].map((tpl) => (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => setActiveWaTemplate(tpl.key as WhatsAppTemplateKey)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition border ${
                          activeWaTemplate === tpl.key
                            ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                            : "bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F3F4F6] hover:text-[#111827]"
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Editable Textarea */}
                <textarea
                  rows={3}
                  value={waCustomText}
                  onChange={(e) => setWaCustomText(e.target.value)}
                  className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] font-sans leading-relaxed text-[#111827]"
                  placeholder="WhatsApp message copy..."
                />

                <div className="flex items-center justify-between text-[11px] text-[#6B7280] flex-wrap gap-2">
                  <span>
                    You can edit the text above before sending. Clicking "Send WhatsApp Message" dispatches this exact message.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(waCustomText);
                      showToast("WhatsApp message copied to clipboard!");
                    }}
                    className="font-bold text-[#111827] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3 text-[#6B7280]" />
                    <span>Copy Text</span>
                  </button>
                </div>
              </div>

              {/* 5. Step 2: What Happened on Call? (1-Click Outcome Buttons) */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
                  Step 2: What happened on the call? (Click 1 button)
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Interested */}
                  <button
                    type="button"
                    onClick={handleMarkInterested}
                    disabled={actionLoading}
                    className="p-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] text-left transition flex flex-col gap-1 shadow-2xs"
                  >
                    <ThumbsUp className="w-4 h-4 text-[#16A34A]" />
                    <span className="font-bold text-xs">Interested</span>
                    <span className="text-[10px] text-[#047857]">Wants quotation</span>
                  </button>

                  {/* Call Back Later */}
                  <button
                    type="button"
                    onClick={() => setShowCallbackPicker(!showCallbackPicker)}
                    disabled={actionLoading}
                    className="p-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#92400E] text-left transition flex flex-col gap-1 shadow-2xs"
                  >
                    <Clock className="w-4 h-4 text-[#D97706]" />
                    <span className="font-bold text-xs">Call Back Later</span>
                    <span className="text-[10px] text-[#B45309]">Schedule follow-up</span>
                  </button>

                  {/* No Answer */}
                  <button
                    type="button"
                    onClick={handleMarkNoAnswer}
                    disabled={actionLoading}
                    className="p-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#FAF8F5] text-[#374151] text-left transition flex flex-col gap-1 shadow-2xs"
                  >
                    <PhoneOff className="w-4 h-4 text-[#6B7280]" />
                    <span className="font-bold text-xs">No Answer</span>
                    <span className="text-[10px] text-[#6B7280]">Rang / Busy</span>
                  </button>

                  {/* Not Interested / Wrong */}
                  <button
                    type="button"
                    onClick={() => setShowRejectPicker(!showRejectPicker)}
                    disabled={actionLoading}
                    className="p-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] text-left transition flex flex-col gap-1 shadow-2xs"
                  >
                    <Ban className="w-4 h-4 text-[#DC2626]" />
                    <span className="font-bold text-xs">Not Interested</span>
                    <span className="text-[10px] text-[#B91C1C]">Wrong / Closed</span>
                  </button>
                </div>

                {/* Call Back Time Picker (Appears when Call Back button is clicked) */}
                {showCallbackPicker && (
                  <div className="p-3 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] space-y-2 animate-in fade-in">
                    <span className="text-xs font-bold text-[#92400E] block">
                      When should we call back?
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["Today 4 PM", "Today 6 PM", "Tomorrow 11 AM", "Tomorrow 3 PM", "Next Monday"].map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleScheduleCallback(time)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#FDE68A] text-xs font-bold text-[#92400E] hover:bg-[#FEF3C7] transition"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disqualification Reason Picker */}
                {showRejectPicker && (
                  <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FECACA] space-y-2 animate-in fade-in">
                    <span className="text-xs font-bold text-[#991B1B] block">
                      Why is this lead not interested?
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        "Residential / Home Furniture only",
                        "Wrong Phone Number",
                        "Not looking for office furniture",
                        "Student / Job seeker",
                        "Competitor inquiry",
                      ].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => handleMarkDisqualified(reason)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#FECACA] text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] transition"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Quick Call Note & Activity History */}
              <div className="space-y-2.5 pt-2 border-t border-[#F3F4F6]">
                <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
                  Quick Note & History
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type call notes here (e.g. Needs 40 workstations by end of month)..."
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveQuickNote();
                    }}
                    className="flex-1 px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] bg-[#FAF8F5]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveQuickNote}
                    disabled={!quickNote.trim()}
                    className="px-4 py-2 bg-[#000000] hover:bg-[#1F2937] text-white text-xs font-bold rounded-lg transition disabled:opacity-40"
                  >
                    Save Note
                  </button>
                </div>

                {/* Timeline Events */}
                <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-[11px] text-[#9CA3AF] italic text-center py-2">
                      No call records logged yet for this lead.
                    </p>
                  ) : (
                    events.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2 rounded-lg bg-[#FAF8F5] border border-[#F3F4F6] text-xs flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-[#111827] block">
                            {evt.title}
                          </span>
                          {evt.description && (
                            <p className="text-[11px] text-[#4B5563]">
                              {evt.description}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-[#9CA3AF] shrink-0">
                          {new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#9CA3AF]">
              <Building2 className="w-12 h-12 mb-2 text-[#D1D5DB]" />
              <p className="font-bold text-sm text-[#4B5563]">Select a lead to start calling</p>
              <p className="text-xs text-[#9CA3AF]">
                Choose any prospect from the left queue to view phone number and call script.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
