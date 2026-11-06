"use client";

import { useState, useEffect, useDeferredValue } from "react";
import {
  Phone,
  History,
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
  Star,
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
  actor?: string;
  createdAt: string;
}

type WhatsAppTemplateKey = "CATALOG" | "TRIED_CALLING" | "PRICING";
type TabKey = "ALL" | "NEW" | "QUALIFIED" | "FOLLOW_UP" | "CONTACTED" | "DISQUALIFIED";

export default function TelecallerDeskPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
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
  const [cockpitView, setCockpitView] = useState<"DOSSIER" | "LOGS" | "WHATSAPP">("DOSSIER");

  // Call Back Schedule Modal / Quick Picker
  const [showCallbackPicker, setShowCallbackPicker] = useState<boolean>(false);
  const [showRejectPicker, setShowRejectPicker] = useState<boolean>(false);
  const [quickNote, setQuickNote] = useState<string>("");

  // Candidate Events History
  const [events, setEvents] = useState<CandidateEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

  // Daily Activity Counter (Persisted in localStorage by date)
  const [dailyCallsMade, setDailyCallsMade] = useState<number>(0);
  const [phoneFilter, setPhoneFilter] = useState<"CALLABLE" | "ALL" | "NO_PHONE">("CALLABLE");
  const [inlinePhoneInput, setInlinePhoneInput] = useState<string>("");
  const [savingPhone, setSavingPhone] = useState<boolean>(false);

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveInlinePhone = async (leadId: string) => {
    if (!inlinePhoneInput.trim()) {
      showToast("Please enter a valid phone number");
      return;
    }
    try {
      setSavingPhone(true);
      const res = await fetch(`/api/candidates/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: inlinePhoneInput.trim() }),
      });
      if (res.ok) {
        showToast("Phone number updated successfully!");
        setInlinePhoneInput("");
        await fetchLeads(true);
        await loadEvents(leadId);
      } else {
        showToast("Failed to update phone number");
      }
    } catch {
      showToast("Network error updating phone number");
    } finally {
      setSavingPhone(false);
    }
  };

  // Initialize Daily Calls Counter from localStorage
  useEffect(() => {
    try {
      const todayKey = `dfurn_calls_${new Date().toISOString().split("T")[0]}`;
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        const count = parseInt(saved, 10);
        if (!isNaN(count)) setDailyCallsMade(count);
      }
    } catch (_) {}
  }, []);

  const incrementDailyCalls = () => {
    setDailyCallsMade((prev) => {
      const updated = prev + 1;
      try {
        const todayKey = `dfurn_calls_${new Date().toISOString().split("T")[0]}`;
        localStorage.setItem(todayKey, updated.toString());
      } catch (_) {}
      return updated;
    });
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
          setSelectedLeadId(data.candidates[0].id);
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

  // Category standardizer ensuring zero scraper query leaks into the UI
  const cleanLeadCategory = (rawCategory?: string | null): string => {
    if (!rawCategory) return "Commercial Specifier";
    const lower = rawCategory.toLowerCase();
    if (lower.includes("architect")) return "Commercial Architect";
    if (lower.includes("interior") || lower.includes("designer")) return "Commercial Interior Designer";
    if (lower.includes("fitout") || lower.includes("contractor") || lower.includes("turnkey")) return "Fitout Contractor";
    if (lower.includes("coworking") || lower.includes("co-working")) return "Coworking Space Operator";
    if (lower.includes("furniture company") || lower.includes("furniture manufacturer")) return "Office Furniture Partner";
    if (lower.includes("it office") || lower.includes("software") || lower.includes("tech")) return "Corporate IT Enterprise";
    if (lower.includes("corporate") || lower.includes("business park") || lower.includes("office") || lower.includes("akshar")) return "Corporate Headquarters";
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
  };

  // Callable check & Google Maps URL builder
  const isLeadCallable = (l: Lead) =>
    Boolean(l.phone && l.phone.trim() !== "-" && l.phone.trim() !== "" && l.phone.toLowerCase() !== "no phone");

  const callableCount = leads.filter(isLeadCallable).length;
  const noPhoneCount = leads.length - callableCount;

  const getGoogleMapsUrl = (lead: Lead) => {
    const parts = [lead.businessName, lead.address, lead.city || "Ahmedabad"].filter(Boolean);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(" "))}`;
  };

  // Segment counts across all leads
  const newCount = leads.filter((l) => (l.qualificationStage || "NEW") === "NEW").length;
  const interestedCount = leads.filter((l) => l.qualificationStage === "QUALIFIED").length;
  const callbackCount = leads.filter((l) => l.qualificationStage === "FOLLOW_UP").length;
  const noAnswerCount = leads.filter((l) => l.qualificationStage === "CONTACTED").length;
  const disqualifiedCount = leads.filter((l) => l.qualificationStage === "DISQUALIFIED").length;

  // Filter leads based on active filter tab (Default "ALL" keeps all leads in list)
  const activeTabLeads = leads.filter((l) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "NEW") return (l.qualificationStage || "NEW") === "NEW";
    if (activeTab === "QUALIFIED") return l.qualificationStage === "QUALIFIED";
    if (activeTab === "FOLLOW_UP") return l.qualificationStage === "FOLLOW_UP";
    if (activeTab === "CONTACTED") return l.qualificationStage === "CONTACTED";
    if (activeTab === "DISQUALIFIED") return l.qualificationStage === "DISQUALIFIED";
    return true;
  });

  // Filter by Phone Status, City & Search Query
  const displayedLeads = activeTabLeads.filter((l) => {
    if (phoneFilter === "CALLABLE" && !isLeadCallable(l)) return false;
    if (phoneFilter === "NO_PHONE" && isLeadCallable(l)) return false;
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

  // Active Lead Object: Guaranteed to belong to the displayed list
  const activeLead = displayedLeads.find((l) => l.id === selectedLeadId) || displayedLeads[0] || null;

  // Tab Change Handler: Keeps right panel synchronized with the selected filter
  const handleTabChange = (newTab: TabKey) => {
    setActiveTab(newTab);
    setShowCallbackPicker(false);
    setShowRejectPicker(false);

    const targetList = leads.filter((l) => {
      if (newTab === "ALL") return true;
      if (newTab === "NEW") return (l.qualificationStage || "NEW") === "NEW";
      if (newTab === "QUALIFIED") return l.qualificationStage === "QUALIFIED";
      if (newTab === "FOLLOW_UP") return l.qualificationStage === "FOLLOW_UP";
      if (newTab === "CONTACTED") return l.qualificationStage === "CONTACTED";
      if (newTab === "DISQUALIFIED") return l.qualificationStage === "DISQUALIFIED";
      return true;
    });

    const filtered = targetList.filter((l) => {
      if (phoneFilter === "CALLABLE" && !isLeadCallable(l)) return false;
      if (phoneFilter === "NO_PHONE" && isLeadCallable(l)) return false;
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

    if (selectedLeadId && filtered.some((l) => l.id === selectedLeadId)) {
      // keep current selection
    } else if (filtered.length > 0) {
      setSelectedLeadId(filtered[0].id);
    } else {
      setSelectedLeadId(null);
    }
  };

  // Practical 3 WhatsApp Business Templates
  const getWhatsAppTemplates = (lead: Lead) => {
    const company = lead.businessName || "Prospect";
    const city = lead.city || "Ahmedabad";

    return {
      CATALOG: `Namaste ${company} team! This is D'furn Modular Systems Ahmedabad. We manufacture commercial office workstations, executive desks, and acoustic meeting pods directly from our factory. Sharing our 2026 Modular Office Catalog for your ${city} office. Would love to assist you with floor plans or factory pricing.`,
      TRIED_CALLING: `Namaste ${company} team! Tried calling you just now regarding commercial office workstations and modular fitouts. Sharing our product catalog here on WhatsApp for your convenience. Please let us know a suitable time to connect for 2 minutes.`,
      PRICING: `Namaste ${company} team! Calling from D'furn Modular Systems Ahmedabad. We provide direct OEM factory pricing with a 15-day turnaround for office workstations. Do you have an office floor plan or workstation count you would like us to estimate?`,
    };
  };

  // Synchronize Live WhatsApp preview when active lead or selected template changes, and reset sub-pickers
  useEffect(() => {
    setShowCallbackPicker(false);
    setShowRejectPicker(false);
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

  // Check if phone number is a mobile line vs an Indian landline (079 / Ahmedabad)
  const isMobileNumber = (phone?: string): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, "");
    // Ahmedabad landlines usually start with 079 or 79 followed by 8 digits
    if (digits.startsWith("079") || (digits.length === 10 && digits.startsWith("79"))) {
      return false;
    }
    // Indian mobiles have 10 digits starting with 6, 7, 8, 9 (or 12 digits with country code 91)
    if (digits.length === 10 && /^[6-9]/.test(digits)) return true;
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return true;
    return digits.length >= 10;
  };

  // Direct Phone Call & Copy with Automated Telemetry Logging
  const handleCallPhone = async (phone?: string) => {
    if (!phone) return;
    const clean = getCleanPhone(phone);
    navigator.clipboard.writeText(clean);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2500);

    incrementDailyCalls();

    if (activeLead) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

      // 1. Stamp lastContactedAt in DB and advance NEW to CONTACTED
      await fetch(`/api/candidates/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markContacted: true,
          qualificationStage: activeLead.qualificationStage === "NEW" ? "CONTACTED" : undefined,
          operatorNotes: activeLead.operatorNotes || "Call initiated via desktop dialer",
        }),
      });

      if (activeLead.qualificationStage === "NEW") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === activeLead.id
              ? { ...l, qualificationStage: "CONTACTED", operatorNotes: "Call initiated via desktop dialer" }
              : l
          )
        );
      }

      // 2. Auto log call attempt event with exact timestamp as latest event
      await logLeadEvent(
        activeLead.id,
        "CALL_ATTEMPT",
        "Call Button Pressed",
        `Dialed ${clean} on ${dateStr} at ${timeStr}`
      );
    }

    window.open(`tel:${clean}`, "_self");
    showToast(`Calling ${clean} (copied to clipboard)`);
  };

  // Pre-formatted WhatsApp Opener using live preview text (Does NOT auto-advance stage prematurely)
  const handleLaunchWhatsApp = async (lead: Lead) => {
    if (!lead.phone) return;
    const rawDigits = lead.phone.replace(/\D/g, "");
    let cleanPhone = rawDigits;
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    const textToSend = waCustomText.trim() || getWhatsAppTemplates(lead)[activeWaTemplate];

    // Stamp last contacted time without ejecting the lead from New Calls
    await fetch(`/api/candidates/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markContacted: true }),
    });

    const tplLabel =
      activeWaTemplate === "CATALOG"
        ? "Office Catalog"
        : activeWaTemplate === "TRIED_CALLING"
        ? "Tried Calling"
        : "Factory Pricing";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // Record Event with exact timestamp & copy preview
    await logLeadEvent(
      lead.id,
      "OUTREACH_SENT",
      `WhatsApp Sent (${tplLabel})`,
      `Sent ${tplLabel} to +${cleanPhone} on ${dateStr} at ${timeStr}: "${textToSend.slice(0, 75)}..."`
    );

    incrementDailyCalls();
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

  // 1-Click Outcome: Interested / Qualified (Updates status in-place; lead remains in list)
  const handleMarkInterested = async () => {
    if (!activeLead) return;
    const targetLeadId = activeLead.id;
    const targetName = activeLead.businessName;

    await updateLeadStage(targetLeadId, "QUALIFIED", "Client interested in modular workstations. Quotation requested.");
    await logLeadEvent(
      targetLeadId,
      "QUALIFIED",
      "Marked Interested",
      "Lead confirmed requirement for modular workstations."
    );

    setSelectedLeadId(targetLeadId);
    showToast(`Marked ${targetName} as Interested!`);
  };

  // 1-Click Outcome: Call Back Later (Updates status in-place; lead remains in list)
  const handleScheduleCallback = async (timeSlot: string) => {
    if (!activeLead) return;
    const targetLeadId = activeLead.id;
    const targetName = activeLead.businessName;

    await updateLeadStage(targetLeadId, "FOLLOW_UP", `Call back requested: ${timeSlot}`);
    await logLeadEvent(
      targetLeadId,
      "FOLLOW_UP_SCHEDULED",
      "Call Back Scheduled",
      `Client requested callback for: ${timeSlot}`
    );

    setShowCallbackPicker(false);
    setSelectedLeadId(targetLeadId);
    showToast(`Call back scheduled for ${targetName}: ${timeSlot}`);
  };

  // 1-Click Outcome: No Answer (Updates status in-place; lead remains in list)
  const handleMarkNoAnswer = async () => {
    if (!activeLead) return;
    const targetLeadId = activeLead.id;
    const targetName = activeLead.businessName;

    await updateLeadStage(targetLeadId, "CONTACTED", "Phone rang / busy. No answer.");
    await logLeadEvent(
      targetLeadId,
      "CALL_ATTEMPT",
      "Call Attempted (No Answer)",
      "Called client phone number. Rang without response or switched off."
    );
    setSelectedLeadId(targetLeadId);
    showToast(`Logged No Answer for ${targetName}.`);
  };

  // 1-Click Outcome: Not Interested / Disqualified
  const handleMarkDisqualified = async (reason: string) => {
    if (!activeLead) return;
    const targetLeadId = activeLead.id;
    const targetName = activeLead.businessName;

    await updateLeadStage(targetLeadId, "DISQUALIFIED", reason);
    await logLeadEvent(
      targetLeadId,
      "DISQUALIFIED",
      "Marked Not Interested",
      `Reason: ${reason}`
    );

    setShowRejectPicker(false);
    setSelectedLeadId(targetLeadId);
    showToast(`Marked ${targetName} as Not Interested.`);
  };

  // Color coding helper for lead status: visibly saturated, high-contrast pastel cards & harmonized phone text
  const getLeadStateStyles = (stage?: string, isSelected?: boolean) => {
    switch (stage) {
      case "QUALIFIED":
        return {
          cardBg: "bg-[#DCFCE7]", // Clearly Green (green-100)
          border: isSelected ? "border-[#16A34A]" : "border-[#86EFAC]",
          hoverBg: "hover:bg-[#BBF7D0]",
          statusSubtext: "⭐ Interested",
          textAccent: "text-[#15803D]",
          phoneText: "text-[#15803D]",
          phoneIcon: "text-[#16A34A]",
        };
      case "FOLLOW_UP":
        return {
          cardBg: "bg-[#EDE9FE]", // Clearly Purple (purple-100)
          border: isSelected ? "border-[#7C3AED]" : "border-[#C4B5FD]",
          hoverBg: "hover:bg-[#DDD6FE]",
          statusSubtext: "⏰ Call Back",
          textAccent: "text-[#6D28D9]",
          phoneText: "text-[#6D28D9]",
          phoneIcon: "text-[#7C3AED]",
        };
      case "CONTACTED":
        return {
          cardBg: "bg-[#E0F2FE]", // Clearly Sky Blue (sky-100)
          border: isSelected ? "border-[#0284C7]" : "border-[#7DD3FC]",
          hoverBg: "hover:bg-[#BAE6FD]",
          statusSubtext: "📵 No Answer",
          textAccent: "text-[#0369A1]",
          phoneText: "text-[#0369A1]",
          phoneIcon: "text-[#0284C7]",
        };
      case "DISQUALIFIED":
        return {
          cardBg: "bg-[#FEE2E2]", // Clearly Rose Red (red-100)
          border: isSelected ? "border-[#DC2626]" : "border-[#FCA5A5]",
          hoverBg: "hover:bg-[#FECACA]",
          statusSubtext: "❌ Not Interested",
          textAccent: "text-[#B91C1C]",
          phoneText: "text-[#B91C1C]",
          phoneIcon: "text-[#DC2626]",
        };
      case "NEW":
      default:
        return {
          cardBg: "bg-white", // Crisp Clean White
          border: isSelected ? "border-[#000000]" : "border-[#D8D3CB]",
          hoverBg: "hover:bg-[#FAF8F5]",
          statusSubtext: "📞 New",
          textAccent: "text-[#4B5563]",
          phoneText: "text-[#111827]",
          phoneIcon: "text-[#6B7280]",
        };
    }
  };

  // Save Quick Note
  const handleSaveQuickNote = async () => {
    if (!activeLead || !quickNote.trim()) return;
    await logLeadEvent(activeLead.id, "OPERATOR_NOTE", "Call Discussion Note", quickNote.trim());
    setQuickNote("");
    showToast("Note recorded in call history.");
  };

  const hasPhone = Boolean(activeLead?.phone && activeLead.phone.trim() !== "-" && activeLead.phone.trim() !== "");
  const phoneIsMobile = hasPhone ? isMobileNumber(activeLead?.phone) : false;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#111827] text-white px-3.5 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#374151] animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact High-Density Toolbar (Single Row, ~42px) */}
      <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-xs flex items-center justify-between gap-3 shrink-0">
        {/* Left: Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* All Leads Chip */}
          <button
            type="button"
            onClick={() => handleTabChange("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 border ${
              activeTab === "ALL"
                ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                : "bg-white text-[#4B5563] border-[#E5DFD3] hover:bg-[#FAF8F5] hover:text-[#111827]"
            }`}
          >
            <span>All Leads</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "ALL" ? "bg-white/20 text-white" : "bg-[#FAF8F5] text-[#111827] border border-[#E5DFD3]"
              }`}
            >
              {leads.length}
            </span>
          </button>

          {/* New Chip */}
          <button
            type="button"
            onClick={() => handleTabChange("NEW")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 border ${
              activeTab === "NEW"
                ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                : "bg-white text-[#4B5563] border-[#E5DFD3] hover:bg-[#FAF8F5] hover:text-[#111827]"
            }`}
          >
            <span>New</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "NEW" ? "bg-white/20 text-white" : "bg-[#FAF8F5] text-[#111827] border border-[#E5DFD3]"
              }`}
            >
              {newCount}
            </span>
          </button>

          {/* Interested Chip */}
          <button
            type="button"
            onClick={() => handleTabChange("QUALIFIED")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 border ${
              activeTab === "QUALIFIED"
                ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                : "bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] hover:bg-[#BBF7D0]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#27AE60] inline-block" />
            <span>Interested</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "QUALIFIED" ? "bg-white/20 text-white" : "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]"
              }`}
            >
              {interestedCount}
            </span>
          </button>

          {/* Call Backs Chip (Vivid Purple) */}
          <button
            type="button"
            onClick={() => handleTabChange("FOLLOW_UP")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 border ${
              activeTab === "FOLLOW_UP"
                ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                : "bg-[#EDE9FE] text-[#6D28D9] border-[#C4B5FD] hover:bg-[#DDD6FE]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] inline-block" />
            <span>Call Backs</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "FOLLOW_UP" ? "bg-white/20 text-white" : "bg-white text-[#7C3AED] border border-[#DDD6FE]"
              }`}
            >
              {callbackCount}
            </span>
          </button>

          {/* No Answer Chip (Cool Sky Blue) */}
          <button
            type="button"
            onClick={() => handleTabChange("CONTACTED")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 border ${
              activeTab === "CONTACTED"
                ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                : "bg-[#E0F2FE] text-[#0369A1] border-[#7DD3FC] hover:bg-[#BAE6FD]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#0284C7] inline-block" />
            <span>No Answer</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "CONTACTED" ? "bg-white/20 text-white" : "bg-white text-[#0284C7] border border-[#BAE6FD]"
              }`}
            >
              {noAnswerCount}
            </span>
          </button>
        </div>

        {/* Center: Daily Activity Ticker (Hidden on small screens) */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3] text-[#374151]">
          <span className="flex items-center gap-1 text-[#111827]">
            <Phone className="w-3 h-3 text-[#16A34A]" />
            <span>Today: {dailyCallsMade} calls</span>
          </span>
          <span className="text-[#8B8778]">·</span>
          <span className="text-[#166534]">
            {interestedCount} Qualified Deals
          </span>
        </div>

        {/* Right: Quick Search, City Filter & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search company, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm bg-[#FAF8F5] border border-[#E5DFD3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="text-xs border border-[#E5DFD3] rounded-lg px-2 py-1 bg-[#FAF8F5] text-[#374151] font-semibold focus:ring-1 focus:ring-[#000000]"
          >
            <option value="ALL">All Cities</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="GIFT City">GIFT City</option>
            <option value="Surat">Surat</option>
            <option value="Vadodara">Vadodara</option>
          </select>

          <button
            type="button"
            onClick={() => fetchLeads(false)}
            title="Refresh Leads"
            className="p-1.5 rounded-lg border border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#EAE6DD] text-[#4B5563] hover:text-[#111827] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Telecalling Workspace (Zero Page Scroll) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        {/* Left Column: Call List (5 cols on desktop) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E5DFD3] shadow-xs flex flex-col h-full overflow-hidden">
          <div className="px-3 py-2 border-b border-[#E5DFD3] bg-[#FAF8F5] flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs text-[#111827] truncate">
                {activeTab === "ALL"
                  ? "All Commercial Leads"
                  : activeTab === "NEW"
                  ? "Fresh Leads to Call"
                  : activeTab === "QUALIFIED"
                  ? "Interested Commercial Deals"
                  : activeTab === "FOLLOW_UP"
                  ? "Scheduled Call Backs"
                  : activeTab === "CONTACTED"
                  ? "Leads with No Answer"
                  : "Disqualified Leads"}
              </span>
              <span className="text-[11px] text-[#6B7280] shrink-0">
                ({displayedLeads.length})
              </span>
            </div>

            {/* Segmented Phone Filter Control */}
            <div className="flex items-center gap-1 shrink-0 bg-white border border-[#E5DFD3] p-0.5 rounded-lg text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setPhoneFilter("CALLABLE")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  phoneFilter === "CALLABLE"
                    ? "bg-[#000000] text-white"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
                title="Only leads with valid phone numbers"
              >
                With Phone ({callableCount})
              </button>
              <button
                type="button"
                onClick={() => setPhoneFilter("ALL")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  phoneFilter === "ALL"
                    ? "bg-[#000000] text-white"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
                title="All leads"
              >
                All ({leads.length})
              </button>
              {noPhoneCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPhoneFilter("NO_PHONE")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    phoneFilter === "NO_PHONE"
                      ? "bg-[#DC2626] text-white"
                      : "text-[#DC2626] hover:bg-[#FEE2E2]"
                  }`}
                  title="Leads missing phone numbers needing research"
                >
                  Needs Phone ({noPhoneCount})
                </button>
              )}
            </div>
          </div>

          {/* Leads Scroll Area: Color-Coded by Lead State, Enhanced Readability & Spacious 2-Line Flow */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {displayedLeads.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-[#9CA3AF]">
                <Building2 className="w-10 h-10 mx-auto text-[#D1D5DB]" />
                <p className="font-medium text-xs text-[#4B5563]">
                  No leads found for this filter
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Try clearing search or switching to "All Leads".
                </p>
              </div>
            ) : (
              displayedLeads.map((lead) => {
                const isSelected = activeLead?.id === lead.id;
                const leadHasPhone = Boolean(lead.phone && lead.phone.trim() !== "-" && lead.phone.trim() !== "");
                const isLandline = leadHasPhone ? !isMobileNumber(lead.phone) : false;
                const styles = getLeadStateStyles(lead.qualificationStage, isSelected);

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border flex flex-col justify-between gap-1.5 min-h-[58px] ${
                      styles.cardBg
                    } ${
                      isSelected
                        ? "ring-2 ring-[#000000] border-[#000000] shadow-sm"
                        : `${styles.border} ${styles.hoverBg}`
                    }`}
                  >
                    {/* Line 1: Company Name + Phone Number */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-[#111827] truncate">
                          {lead.businessName}
                        </span>
                      </div>

                      {leadHasPhone ? (
                        <span className={`font-mono text-xs font-semibold flex items-center gap-1 shrink-0 ${styles.phoneText}`}>
                          <Phone className={`w-3.5 h-3.5 shrink-0 ${styles.phoneIcon}`} />
                          <span>{lead.phone}</span>
                          {isLandline && (
                            <span className="text-[9px] font-medium text-[#6B7280] bg-white/80 px-1 rounded border border-[#E5DFD3]">
                              LL
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-[#9CA3AF] italic shrink-0">No phone</span>
                      )}
                    </div>

                    {/* Line 2: Location/Category + Subtle State Indication (NO BADGE PILL) */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="text-xs text-[#6B7280] flex items-center gap-1.5 truncate">
                        <span className="flex items-center gap-1 text-[#374151] shrink-0 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[#EF4444]" />
                          <span>{lead.city || "Ahmedabad"}</span>
                        </span>
                        <span>·</span>
                        <span className="truncate">{cleanLeadCategory(lead.category || lead.industry)}</span>
                      </div>

                      {/* Subtle status subtext (color coded, no badge pill) */}
                      <span className={`text-xs font-bold shrink-0 flex items-center gap-1 ${styles.textAccent}`}>
                        {lead.qualificationStage === "FOLLOW_UP" && lead.operatorNotes
                          ? `⏰ ${lead.operatorNotes.replace("Call back requested: ", "")}`
                          : styles.statusSubtext}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Single-Sheet Contact Dossier (7 cols on desktop, Zero Nested Boxes) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E5DFD3] shadow-xs flex flex-col h-full overflow-hidden p-4 justify-between gap-3">
          {activeLead ? (
            <div className="h-full flex flex-col justify-between gap-3 min-h-0">
              {/* 1. Contact Header & Direct Call Action Hero */}
              <div className="space-y-3 pb-3 border-b border-[#E5DFD3]/80 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-[#111827] tracking-tight truncate">
                        {activeLead.businessName}
                      </h2>
                      {activeLead.leadTier && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#111827] border border-[#E5DFD3]">
                          Tier {activeLead.leadTier}
                        </span>
                      )}
                      {activeLead.workstationCount && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          {activeLead.workstationCount} Seats
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#6B7280] flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-[#111827]">
                        <MapPin className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>{activeLead.city || "Ahmedabad"}</span>
                      </span>
                      <span>·</span>
                      {activeLead.contactPerson ? (
                        <span className="flex items-center gap-1 text-[#374151]">
                          <User className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          <span>Contact: {activeLead.contactPerson}</span>
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF] italic">Commercial Specifier</span>
                      )}
                      {activeLead.rating && (
                        <>
                          <span>·</span>
                          <span className="text-[#D97706] font-bold flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#F59E0B] text-[#D97706]" />
                            <span>{activeLead.rating}</span>
                            <span className="text-[#9CA3AF] font-normal">({activeLead.reviewCount || 0} reviews)</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Google Maps External Action Button */}
                    <a
                      href={getGoogleMapsUrl(activeLead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E40AF] text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title="Open location, photos & reviews on Google Maps"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#EF4444]" />
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3 text-[#3B82F6]" />
                    </a>

                    {/* Current Status Pill */}
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${
                      activeLead.qualificationStage === "QUALIFIED"
                        ? "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]"
                        : activeLead.qualificationStage === "FOLLOW_UP"
                        ? "bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]"
                        : activeLead.qualificationStage === "CONTACTED"
                        ? "bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]"
                        : activeLead.qualificationStage === "DISQUALIFIED"
                        ? "bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]"
                        : "bg-[#FAF8F5] text-[#374151] border-[#E5DFD3]"
                    }`}>
                      {activeLead.qualificationStage === "QUALIFIED"
                        ? "⭐ Interested"
                        : activeLead.qualificationStage === "FOLLOW_UP"
                        ? "⏰ Call Back"
                        : activeLead.qualificationStage === "CONTACTED"
                        ? "📵 No Answer"
                        : activeLead.qualificationStage === "DISQUALIFIED"
                        ? "❌ Disqualified"
                        : "📞 Fresh Lead"}
                    </span>
                  </div>
                </div>

                {/* Direct Dial & WhatsApp Hero Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCallPhone(activeLead.phone)}
                    disabled={!hasPhone}
                    className="flex-1 py-3 px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2.5 transition disabled:opacity-40 cursor-pointer"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                    <span>{hasPhone ? `Call ${activeLead.phone}` : "No Phone Found"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCockpitView(cockpitView === "WHATSAPP" ? "DOSSIER" : "WHATSAPP")}
                    disabled={!hasPhone || !phoneIsMobile}
                    className={`py-3 px-5 rounded-xl font-semibold text-sm shadow-xs flex items-center gap-2 transition border cursor-pointer ${
                      cockpitView === "WHATSAPP"
                        ? "bg-[#000000] text-white border-[#000000]"
                        : phoneIsMobile
                        ? "bg-white text-[#15803D] border-[#86EFAC] hover:bg-[#F0FDF4] active:scale-[0.98]"
                        : "bg-[#F4F3ED] text-[#9CA3AF] border-[#E5DFD3] cursor-not-allowed"
                    }`}
                    title={
                      !hasPhone
                        ? "No phone number available"
                        : !phoneIsMobile
                        ? "Landline number (Call supported, WhatsApp requires mobile)"
                        : "Toggle WhatsApp intro composer"
                    }
                  >
                    <MessageSquare className="w-4 h-4 fill-current text-[#25D366]" />
                    <span>{phoneIsMobile ? (cockpitView === "WHATSAPP" ? "Close WhatsApp" : "WhatsApp Intro") : "Landline Only"}</span>
                  </button>
                </div>

                {/* Inline Phone Enrichment Helper when phone is missing */}
                {!hasPhone && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-[#FEF3C7]/50 border border-[#FDE68A] rounded-xl text-xs animate-in fade-in">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                      <span className="text-[#92400E] font-medium truncate">
                        No phone listed. Find on Google Maps & add:
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        placeholder="e.g. +91 98250 12345"
                        value={inlinePhoneInput}
                        onChange={(e) => setInlinePhoneInput(e.target.value)}
                        className="bg-white border border-[#E5DFD3] rounded-lg px-2.5 py-1 text-xs font-mono w-44 focus:outline-none focus:ring-1 focus:ring-[#000000]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveInlinePhone(activeLead.id)}
                        disabled={savingPhone || !inlinePhoneInput.trim()}
                        className="px-3 py-1 bg-[#000000] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#262626] transition disabled:opacity-40"
                      >
                        {savingPhone ? "Saving..." : "Save Phone"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* View Selector Tabs: Prospect Info vs Call & Activity Logs */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setCockpitView("DOSSIER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    cockpitView === "DOSSIER"
                      ? "bg-[#000000] text-white shadow-xs"
                      : "bg-[#FAF8F5] text-[#4B5563] border border-[#E5DFD3] hover:text-[#111827] hover:bg-white"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Prospect Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCockpitView("LOGS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    cockpitView === "LOGS"
                      ? "bg-[#000000] text-white shadow-xs"
                      : "bg-[#FAF8F5] text-[#4B5563] border border-[#E5DFD3] hover:text-[#111827] hover:bg-white"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Call & Activity Logs</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      cockpitView === "LOGS" ? "bg-white/20 text-white" : "bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]"
                    }`}
                  >
                    {events.length}
                  </span>
                </button>
              </div>

              {/* Middle Section: Prospect Info OR Complete Activity Logs OR WhatsApp */}
              {cockpitView === "LOGS" ? (
                /* Complete Activity & Call Logs Stream */
                <div className="flex-1 min-h-0 bg-[#FAF8F5] rounded-xl border border-[#E5DFD3] p-3 flex flex-col justify-between overflow-hidden animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD3] shrink-0">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#0284C7]" />
                      <span className="text-xs font-bold text-[#111827]">
                        Complete Interaction History ({events.length} Logs)
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B7280]">
                      Auto-logged with exact timestamps
                    </span>
                  </div>

                  {/* Scrollable Event Stream */}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-2 space-y-1.5">
                    {events.length === 0 ? (
                      <div className="py-8 text-center space-y-2 text-[#9CA3AF]">
                        <History className="w-8 h-8 mx-auto text-[#D1D5DB]" />
                        <p className="font-semibold text-xs text-[#374151]">No activity logs recorded yet</p>
                        <p className="text-[11px] text-[#6B7280]">
                          Calls made, WhatsApp messages sent, stage changes, and notes will appear here automatically.
                        </p>
                      </div>
                    ) : (
                      events.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-2.5 rounded-lg bg-white border border-[#E5DFD3] shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                evt.eventType === "CALL_ATTEMPT"
                                  ? "bg-[#16A34A]"
                                  : evt.eventType === "OUTREACH_SENT"
                                  ? "bg-[#25D366]"
                                  : evt.eventType === "FOLLOW_UP_SCHEDULED"
                                  ? "bg-[#7C3AED]"
                                  : evt.eventType === "QUALIFIED"
                                  ? "bg-[#16A34A]"
                                  : evt.eventType === "DISQUALIFIED"
                                  ? "bg-[#DC2626]"
                                  : "bg-[#0284C7]"
                              }`} />
                              <span className="font-semibold text-xs text-[#111827] truncate">
                                {evt.title}
                              </span>
                              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#6B7280] border border-[#E5DFD3] shrink-0">
                                {evt.channel || "PHONE"}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#8B8778] font-mono shrink-0">
                              {new Date(evt.createdAt).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-[#374151] leading-relaxed pl-3.5">
                            {evt.description}
                          </p>

                          <div className="text-[10px] text-[#8B8778] pl-3.5 flex items-center gap-2">
                            <span>Actor: {evt.actor || "Sales Rep"}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : cockpitView === "WHATSAPP" ? (
                /* On-Demand WhatsApp Drawer */
                <div className="flex-1 min-h-0 bg-[#FAF8F5] rounded-xl border border-[#E5DFD3] p-3 flex flex-col justify-between animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD3]">
                    <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>Choose WhatsApp Message</span>
                    </span>

                    {/* 3 Template Pills */}
                    <div className="flex items-center gap-1">
                      {[
                        { key: "CATALOG", label: "Office Catalog" },
                        { key: "TRIED_CALLING", label: "Tried Calling" },
                        { key: "PRICING", label: "Factory Pricing" },
                      ].map((tpl) => (
                        <button
                          key={tpl.key}
                          type="button"
                          onClick={() => setActiveWaTemplate(tpl.key as WhatsAppTemplateKey)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition border ${
                            activeWaTemplate === tpl.key
                              ? "bg-[#000000] text-white border-[#000000]"
                              : "bg-white text-[#4B5563] border-[#E5DFD3] hover:bg-[#F4F3ED] hover:text-[#111827]"
                          }`}
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={waCustomText}
                    onChange={(e) => setWaCustomText(e.target.value)}
                    className="w-full flex-1 my-2 text-xs p-2.5 bg-white border border-[#E5DFD3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] font-sans leading-relaxed text-[#111827] resize-none"
                    placeholder="WhatsApp message copy..."
                  />

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleLaunchWhatsApp(activeLead)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 fill-current" />
                      <span>Send on WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(waCustomText);
                        showToast("WhatsApp message copied to clipboard!");
                      }}
                      className="text-xs font-bold text-[#111827] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-[#6B7280]" />
                      <span>Copy Text</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Flat Prospect Context */
                <div className="flex-1 min-h-0 py-2 flex flex-col justify-around">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                    {/* Fact 1: Landmark & Micro-Market */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#8B8778] uppercase tracking-wider block">
                          Address & Landmark
                        </span>
                        <a
                          href={getGoogleMapsUrl(activeLead)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#2563EB] hover:underline flex items-center gap-0.5 cursor-pointer"
                          title="Open location on Google Maps"
                        >
                          <span>View on Maps</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <p className="font-semibold text-[#111827] text-sm leading-snug">
                        {activeLead.address || `${activeLead.city || "Ahmedabad"} Commercial Corridor`}
                      </p>
                    </div>

                    {/* Fact 2: Trade & Source */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-[#8B8778] uppercase tracking-wider block">
                        Trade Category & Source
                      </span>
                      <p className="font-semibold text-[#111827] text-sm truncate">
                        {activeLead.category || "Commercial Office"} ·{" "}
                        <span className="font-medium text-[#6B7280]">
                          {activeLead.leadSource === "google_maps"
                            ? "Google Maps"
                            : activeLead.leadSource?.includes("ads")
                            ? "Paid Ad Form"
                            : "Specifier Directory"}
                        </span>
                      </p>
                    </div>

                    {/* Fact 3: Online Portfolio */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-[#8B8778] uppercase tracking-wider block">
                        Online Portfolio
                      </span>
                      {activeLead.website ? (
                        <a
                          href={activeLead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#2563EB] hover:underline font-semibold text-sm flex items-center gap-1 truncate"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{activeLead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 text-[#9CA3AF]" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#9CA3AF] italic">No website listed</span>
                      )}
                    </div>

                    {/* Fact 4: Reputation & Database Status */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-[#8B8778] uppercase tracking-wider block">
                        Public Reputation
                      </span>
                      <div className="font-semibold text-sm text-[#111827] flex items-center gap-1.5">
                        {activeLead.rating ? (
                          <>
                            <span className="text-[#D97706]">⭐ {activeLead.rating} ★</span>
                            <span className="text-[#6B7280] font-normal text-[11px]">
                              ({activeLead.reviewCount ? `${activeLead.reviewCount} Reviews` : "Verified Rating"})
                            </span>
                          </>
                        ) : (
                          <span className="text-[#059669] font-semibold text-[11px]">
                            ✓ Verified Commercial Listing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. The 4 Outcome Push-Buttons (Unmistakable Button Affordance) */}
              <div className="pt-3 border-t border-[#E5DFD3]/80 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#8B8778] uppercase tracking-wider block">
                    Log Call Result (Click to Record):
                  </span>
                  {activeLead.qualificationStage === "FOLLOW_UP" && activeLead.operatorNotes && (
                    <span className="text-[10px] font-bold text-[#7C3AED] bg-[#F3E8FF] px-2 py-0.5 rounded border border-[#DDD6FE]">
                      {activeLead.operatorNotes}
                    </span>
                  )}
                </div>

                {/* 4 Tactile Push-Buttons (Radically Differentiated Chromatic Palette) */}
                <div className="grid grid-cols-4 gap-2.5">
                  {/* 1. Interested Button (Emerald Green) */}
                  <button
                    type="button"
                    onClick={handleMarkInterested}
                    disabled={actionLoading}
                    className={`h-12 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ${
                      activeLead.qualificationStage === "QUALIFIED"
                        ? "bg-[#16A34A] border-[#16A34A] text-white ring-2 ring-black"
                        : "bg-[#DCFCE7] border-[#86EFAC] text-[#15803D] hover:bg-[#BBF7D0]"
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${activeLead.qualificationStage === "QUALIFIED" ? "text-white" : "text-[#16A34A]"}`} />
                    <span>{activeLead.qualificationStage === "QUALIFIED" ? "✓ Interested" : "Interested"}</span>
                  </button>

                  {/* 2. Call Back Button (Vivid Purple, 100% distinct from Red Not Interested) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCallbackPicker(!showCallbackPicker);
                      setShowRejectPicker(false);
                    }}
                    disabled={actionLoading}
                    className={`h-12 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ${
                      activeLead.qualificationStage === "FOLLOW_UP"
                        ? "bg-[#7C3AED] border-[#7C3AED] text-white ring-2 ring-black"
                        : "bg-[#EDE9FE] border-[#C4B5FD] text-[#6D28D9] hover:bg-[#DDD6FE]"
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${activeLead.qualificationStage === "FOLLOW_UP" ? "text-white" : "text-[#7C3AED]"}`} />
                    <span>{activeLead.qualificationStage === "FOLLOW_UP" ? "✓ Call Back" : "Call Back"}</span>
                  </button>

                  {/* 3. No Answer Button (Cool Sky Blue, 100% distinct from Black and Grey) */}
                  <button
                    type="button"
                    onClick={handleMarkNoAnswer}
                    disabled={actionLoading}
                    className={`h-12 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ${
                      activeLead.qualificationStage === "CONTACTED"
                        ? "bg-[#0284C7] border-[#0284C7] text-white ring-2 ring-black"
                        : "bg-[#E0F2FE] border-[#7DD3FC] text-[#0369A1] hover:bg-[#BAE6FD]"
                    }`}
                  >
                    <PhoneOff className={`w-4 h-4 ${activeLead.qualificationStage === "CONTACTED" ? "text-white" : "text-[#0284C7]"}`} />
                    <span>{activeLead.qualificationStage === "CONTACTED" ? "✓ No Answer" : "No Answer"}</span>
                  </button>

                  {/* 4. Not Interested Button (Crimson Red) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectPicker(!showRejectPicker);
                      setShowCallbackPicker(false);
                    }}
                    disabled={actionLoading}
                    className={`h-12 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ${
                      activeLead.qualificationStage === "DISQUALIFIED"
                        ? "bg-[#DC2626] border-[#DC2626] text-white ring-2 ring-black"
                        : "bg-[#FEE2E2] border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FECACA]"
                    }`}
                  >
                    <Ban className={`w-4 h-4 ${activeLead.qualificationStage === "DISQUALIFIED" ? "text-white" : "text-[#DC2626]"}`} />
                    <span>{activeLead.qualificationStage === "DISQUALIFIED" ? "✓ Disqualified" : "Not Interested"}</span>
                  </button>
                </div>

                {/* Inline Callback Time Picker Popover (Purple Theme) */}
                {showCallbackPicker && (
                  <div className="p-2.5 bg-[#FAF5FF] rounded-xl border border-[#DDD6FE] space-y-1.5 animate-in fade-in">
                    <span className="text-[10px] font-bold text-[#7C3AED] block">
                      When should we call back?
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["Today 4 PM", "Today 6 PM", "Tomorrow 11 AM", "Tomorrow 3 PM", "Next Monday"].map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleScheduleCallback(time)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#DDD6FE] text-xs font-bold text-[#7C3AED] hover:bg-[#F3E8FF] shadow-2xs active:scale-95 transition cursor-pointer"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline Rejection Reason Picker Popover */}
                {showRejectPicker && (
                  <div className="p-2.5 bg-[#FEF2F2] rounded-xl border border-[#FECACA] space-y-1.5 animate-in fade-in">
                    <span className="text-[10px] font-bold text-[#991B1B] block">
                      Reason for disqualification:
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
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#FECACA] text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] shadow-2xs active:scale-95 transition cursor-pointer"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Row: Quick Note + Mini Activity Ticker */}
                <div className="grid grid-cols-12 gap-2 pt-1">
                  <div className="col-span-7 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Type call notes here (press Enter to save)..."
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveQuickNote();
                      }}
                      className="flex-1 px-3.5 py-2 text-xs sm:text-sm border border-[#E5DFD3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] bg-[#FAF8F5]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveQuickNote}
                      disabled={!quickNote.trim()}
                      className="px-4 py-2 bg-[#000000] hover:bg-[#1F2937] text-white text-xs font-semibold rounded-lg transition disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      Save Note
                    </button>
                  </div>

                  {/* Right: Automated Telemetry & Audit Trail (Clickable Log View Shortcut) */}
                  <div
                    onClick={() => setCockpitView("LOGS")}
                    title="Click to view all activity and call logs"
                    className="col-span-5 h-[34px] overflow-hidden bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg px-2.5 py-1 text-xs flex items-center justify-between cursor-pointer transition"
                  >
                    {events.length === 0 ? (
                      <span className="text-[#9CA3AF] italic text-xs">No call logs recorded</span>
                    ) : (
                      <div className="flex items-center justify-between w-full text-[#4B5563] gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0" />
                          <span className="font-semibold text-[#111827] truncate text-xs">
                            {events[0].title}
                          </span>
                        </div>
                        <span className="text-[#0284C7] font-semibold text-[10px] shrink-0 hover:underline flex items-center gap-0.5">
                          View All ({events.length}) →
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#9CA3AF]">
              <Building2 className="w-12 h-12 mb-2 text-[#D1D5DB]" />
              <p className="font-bold text-sm text-[#4B5563]">Select a lead to start calling</p>
              <p className="text-xs text-[#9CA3AF]">
                Choose any prospect from the left queue to view phone number and call details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
