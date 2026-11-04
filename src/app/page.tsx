"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Phone,
  Clock,
  RefreshCw,
  Building2,
  Check,
  Download,
  Plus,
  MessageSquare,
  ExternalLink,
  Send,
  X,
  LayoutGrid,
  Columns,
  History,
  Mail,
  Copy,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  Square,
  Terminal,
  Activity,
  AlertTriangle,
  XCircle,
  Upload,
  FileText,
  MapPin,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { OUTREACH_TEMPLATES, renderTemplate } from "@/lib/templates";
import { parseLeadCsv, ParsedCsvLead } from "@/lib/csv-parser";
import {
  PARENT_CHANNELS,
  resolveSubChannel,
  ParentChannelId,
} from "@/lib/channels";

interface Lead {
  id: string;
  businessName: string;
  contactPerson?: string;
  category: string;
  city: string;
  state?: string;
  phone?: string;
  isDummyPhone?: boolean;
  enrichmentStatus?: "NONE" | "PENDING" | "ENRICHED" | "FAILED";
  email?: string;
  website?: string;
  sourceUrl?: string;
  rating?: number;
  reviewCount?: number;
  sourceType?: string;
  leadSource?: string;
  campaignName?: string;
  adsetName?: string;
  adName?: string;
  projectType?: string;
  workstationCount?: number;
  projectTimeline?: string;
  estimatedBudget?: string;
  leadTier?: string;
  totalScore?: number;
  hasCommercialFocus?: boolean;
  qualificationStage?: string;
  operatorNotes?: string;
  portfolioTags?: string;
  firstContactedAt?: string;
  lastContactedAt?: string;
  status: string;
  whatsappAvailable?: boolean;
  syncedToErpAt?: string;
  erpEnquiryCode?: string;
  erpClientCode?: string;
  swatchBoxStatus?: string;
  swatchBoxCourier?: string;
  swatchBoxAwb?: string;
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
  dummy?: number;
}

interface RejectedLead {
  id: string;
  businessName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city: string;
  leadSource: string;
  category: string;
  rejectionReason: string;
  notes?: string;
  rawPayload?: any;
  rejectedAt: string;
}

interface CandidateEvent {
  id: string;
  candidateId: string;
  eventType: string;
  title: string;
  description?: string;
  channel: string;
  metadata?: any;
  actor: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [stageCounts, setStageCounts] = useState<StageCounts>({
    total: 0,
    new: 0,
    contacted: 0,
    followUp: 0,
    qualified: 0,
    converted: 0,
    lost: 0,
  });

  // Views & Filters
  const [viewMode, setViewMode] = useState<"COCKPIT" | "TABLE">("COCKPIT");
  const [mobilePane, setMobilePane] = useState<"STREAM" | "DETAIL">("STREAM");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<ParentChannelId>("ALL");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("ALL");
  const [multiTouchOnly, setMultiTouchOnly] = useState<boolean>(false);
  const [channelCounts, setChannelCounts] = useState<Record<string, number>>({});
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Outreach & Templates State
  const [activeTemplateId, setActiveTemplateId] = useState<string>("SPEED_TO_LEAD");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  // Candidate Events Timeline State
  const [events, setEvents] = useState<CandidateEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [newQuickNote, setNewQuickNote] = useState<string>("");

  // Rejected Leads Modal & List State
  const [rejectedLeads, setRejectedLeads] = useState<RejectedLead[]>([]);
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  const [showRejectedModal, setShowRejectedModal] = useState<boolean>(false);
  const [loadingRejected, setLoadingRejected] = useState<boolean>(false);
  const [restoringRejectedId, setRestoringRejectedId] = useState<string | null>(null);
  const [rejectedReasonFilter, setRejectedReasonFilter] = useState<string>("ALL");

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importChannel, setImportChannel] = useState<string>("paid_ads_meta");
  const [importing, setImporting] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<ParsedCsvLead[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  // Screen-blocking mutation loader state
  const [blockingLoader, setBlockingLoader] = useState<{ active: boolean; message: string }>({
    active: false,
    message: "",
  });

  // Lead Contact Enrichment State
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);
  const [bulkEnriching, setBulkEnriching] = useState<boolean>(false);

  // Reject Lead Action State
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState<boolean>(false);
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("RESIDENTIAL_MISMATCH");
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [submittingReject, setSubmittingReject] = useState<boolean>(false);

  // Modals & Verbose Discovery Stream Controller
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState<boolean>(false);
  const [discoveryForm, setDiscoveryForm] = useState({
    industry: "Commercial Interior Designers & Architects",
    location: "Sindhu Bhavan Road, Ahmedabad",
    targetCount: 30,
    runAudit: true,
  });
  const [discoveryRunning, setDiscoveryRunning] = useState<boolean>(false);
  const [discoveryPaused, setDiscoveryPaused] = useState<boolean>(false);
  const [discoverySessionId, setDiscoverySessionId] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [discoveryLogs, setDiscoveryLogs] = useState<Array<{ id: string; time: string; text: string; type: string }>>([]);
  const [currentActivity, setCurrentActivity] = useState<string>("Ready to launch discovery");
  const [currentStudioPreview, setCurrentStudioPreview] = useState<{
    name: string;
    url?: string;
    website?: string;
    phone?: string;
    email?: string;
    tags?: string[];
    tier?: string;
    score?: number;
    rating?: number;
    status: string;
  } | null>(null);

  const [streamMetrics, setStreamMetrics] = useState({
    totalSaved: 0,
    qualifiedCount: 0,
    targetCount: 30,
    corridorIndex: 0,
    totalCorridors: 1,
    currentCorridorName: "",
    stage: "IDLE", // "IDLE" | "SCRAPING" | "AUDITING" | "SAVING" | "PAUSED" | "COMPLETE" | "CANCELLED"
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // Time Elapsed Timer with Wall-Clock Delta (guards against browser tab background throttling)
  useEffect(() => {
    let timer: any = null;
    if (discoveryRunning && !discoveryPaused) {
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
      }
      timer = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [discoveryRunning, discoveryPaused]);

  // Sync elapsed timer immediately when tab regains visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && discoveryRunning && !discoveryPaused && startTimeRef.current > 0) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [discoveryRunning, discoveryPaused]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [discoveryLogs]);

  const addLog = (text: string, type: "INFO" | "SCRAPE" | "AUDIT" | "EXTRACT" | "SAVED" | "CORRIDOR" | "SUCCESS" | "WARN" | "ERROR" = "INFO") => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setDiscoveryLogs((prev) => [...prev.slice(-150), { id: Math.random().toString(), time, text, type }]);
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const resetDiscoveryState = () => {
    setStreamMetrics({
      totalSaved: 0,
      qualifiedCount: 0,
      targetCount: discoveryForm.targetCount || 30,
      corridorIndex: 0,
      totalCorridors: 1,
      currentCorridorName: "",
      stage: "IDLE",
    });
    setDiscoveryLogs([]);
    setCurrentStudioPreview(null);
    setCurrentActivity("Ready to launch discovery");
    setElapsedSeconds(0);
    startTimeRef.current = 0;
    setDiscoveryRunning(false);
    setDiscoveryPaused(false);
  };

  // Launch Streaming Discovery
  const handleRunDiscovery = async () => {
    if (!discoveryForm.industry.trim() || !discoveryForm.location.trim()) {
      alert("Please specify both Specifier Profession and Location query.");
      return;
    }

    const newSessionId = `dsc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setDiscoverySessionId(newSessionId);
    setDiscoveryRunning(true);
    setDiscoveryPaused(false);
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setDiscoveryLogs([]);
    setCurrentStudioPreview(null);

    const industryToUse = discoveryForm.industry.trim();
    const locationToUse = discoveryForm.location.trim();

    setStreamMetrics({
      totalSaved: 0,
      qualifiedCount: 0,
      targetCount: discoveryForm.targetCount,
      corridorIndex: 0,
      totalCorridors: 1,
      currentCorridorName: locationToUse,
      stage: "SCRAPING",
    });

    addLog(`Initiating discovery session: ${newSessionId}`, "INFO");
    addLog(`Target: ${discoveryForm.targetCount} leads | Location: ${locationToUse} | Persona: ${industryToUse}`, "INFO");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/discovery/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: newSessionId,
          industry: industryToUse,
          location: locationToUse,
          targetCount: discoveryForm.targetCount,
          runAudit: discoveryForm.runAudit,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evText of events) {
          const trimmed = evText.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              handleStreamEvent(event);
            } catch (_) {}
          }
        }
      }

      await fetchLeads();
    } catch (err: any) {
      if (err.name === "AbortError") {
        addLog("Discovery stream aborted by operator.", "WARN");
      } else {
        addLog(`Stream error: ${err.message}`, "ERROR");
      }
    } finally {
      setDiscoveryRunning(false);
      setDiscoveryPaused(false);
      abortControllerRef.current = null;
    }
  };

  const handleStreamEvent = (event: any) => {
    switch (event.type) {
      case "session_init":
        setStreamMetrics((prev) => ({
          ...prev,
          totalCorridors: event.totalCorridors,
          targetCount: event.targetCount,
        }));
        addLog(event.message, "INFO");
        break;

      case "corridor_start":
        setStreamMetrics((prev) => ({
          ...prev,
          corridorIndex: event.corridorIndex,
          totalCorridors: event.totalCorridors,
          currentCorridorName: event.corridorName,
          stage: "SCRAPING",
        }));
        setCurrentActivity(`Scanning corridor ${event.corridorIndex}/${event.totalCorridors}: ${event.corridorName}`);
        addLog(`[Corridor ${event.corridorIndex}/${event.totalCorridors}] ${event.corridorName}`, "CORRIDOR");
        break;

      case "map_search_start":
        setCurrentActivity(event.message);
        addLog(event.message, "SCRAPE");
        break;

      case "map_scroll":
        setCurrentActivity(`Scrolling Google Maps: ${event.data.count} places listed...`);
        addLog(`Maps scroll #${event.data.scroll}: ${event.data.count} places listed`, "SCRAPE");
        break;

      case "map_results_parsed":
      case "corridor_extracted":
        setCurrentActivity(event.message);
        addLog(event.message, "INFO");
        break;

      case "bing_fallback_start":
        setCurrentActivity(event.message);
        addLog(event.message, "WARN");
        break;

      case "audit_start":
        setStreamMetrics((prev) => ({ ...prev, stage: "AUDITING" }));
        setCurrentActivity(`Auditing live portfolio: ${event.data.studio}`);
        setCurrentStudioPreview({
          name: event.data.studio,
          url: event.data.url,
          status: "Auditing Live Portfolio...",
        });
        addLog(`[Audit ${event.data.current}/${event.data.total}] Visiting: ${event.data.studio}`, "AUDIT");
        break;

      case "audit_complete":
        setCurrentStudioPreview((prev) => ({
          ...prev,
          name: event.data.studio,
          email: event.data.email,
          tags: event.data.tags,
          status: event.data.isCommercial ? "Commercial Fit Confirmed" : "General/Residential",
        }));
        addLog(`Audited ${event.data.studio}: ${event.data.email || "No direct email"} · ${(event.data.tags || []).length} commercial tags`, "EXTRACT");
        break;

      case "lead_saved":
        setStreamMetrics((prev) => ({
          ...prev,
          totalSaved: event.totalSaved,
          qualifiedCount: event.qualifiedCount,
          stage: "SAVING",
        }));
        setCurrentActivity(`Saved lead: ${event.businessName} (Tier ${event.leadTier} · ${event.totalScore} pts)`);
        setCurrentStudioPreview({
          name: event.businessName,
          phone: event.phone,
          email: event.email,
          website: event.website,
          tier: event.leadTier,
          score: event.totalScore,
          tags: event.tags,
          status: "Saved into Database",
        });
        addLog(`Saved [Tier ${event.leadTier} · ${event.totalScore} pts] ${event.businessName}`, "SAVED");
        fetchLeads(true);
        break;

      case "enrichment_start":
        setStreamMetrics((prev) => ({
          ...prev,
          stage: "ENRICHING",
        }));
        setCurrentActivity(event.message || `Stage 2: Enriching ${event.count} missing phone numbers via Google Maps knowledge panels...`);
        addLog(`[Stage 2] Starting automatic Google Maps Knowledge Panel lookup for ${event.count} studios...`, "INFO");
        break;

      case "enrichment_item_start":
        setCurrentActivity(`[Stage 2: ${event.current}/${event.total}] Querying Knowledge Panel: ${event.businessName}`);
        setCurrentStudioPreview((prev) => ({
          name: event.businessName,
          url: prev?.url,
          status: `Stage 2: Knowledge Panel Lookup (${event.current}/${event.total})...`,
        }));
        addLog(event.message, "SCRAPE");
        break;

      case "lead_enriched":
        setCurrentStudioPreview((prev) => ({
          name: event.businessName,
          phone: event.phone,
          website: event.website || prev?.website,
          status: `Phone Enriched: ${event.phone}`,
        }));
        addLog(`[ENRICHED] Verified phone ${event.phone} found for ${event.businessName}`, "SAVED");
        fetchLeads(true);
        break;

      case "lead_incomplete":
        setCurrentStudioPreview((prev) => ({
          name: event.businessName,
          status: "No verified phone found (Moved to Lost Leads)",
        }));
        addLog(`[INCOMPLETE] No phone found for ${event.businessName} (Moved to Lost Leads)`, "WARN");
        fetchLeads(true);
        break;

      case "complete":
        setStreamMetrics((prev) => ({
          ...prev,
          totalSaved: event.totalSaved,
          qualifiedCount: event.qualifiedCount,
          stage: "COMPLETE",
        }));
        setCurrentActivity("Discovery pipeline completed successfully.");
        addLog(`Completed! Discovered ${event.totalSaved} studios (${event.qualifiedCount} Tier A+/A Specifiers).`, "SUCCESS");
        break;

      case "cancelled":
        setStreamMetrics((prev) => ({ ...prev, stage: "CANCELLED" }));
        setCurrentActivity("Discovery cancelled. All saved leads retained.");
        addLog(event.message, "WARN");
        break;

      case "error":
        addLog(`Error: ${event.error}`, "ERROR");
        break;

      default:
        if (event.message) addLog(event.message, "INFO");
        break;
    }
  };

  // Pause Discovery
  const handlePauseDiscovery = async () => {
    if (!discoverySessionId || !discoveryRunning) return;
    try {
      const res = await fetch("/api/discovery/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: discoverySessionId, action: "pause" }),
      });
      if (res.ok) {
        setDiscoveryPaused(true);
        setStreamMetrics((prev) => ({ ...prev, stage: "PAUSED" }));
        setCurrentActivity("Discovery paused by operator.");
        addLog("[PAUSED] Discovery paused. Browser waiting...", "WARN");
      }
    } catch (err: any) {
      console.error("Pause error:", err);
    }
  };

  // Resume Discovery
  const handleResumeDiscovery = async () => {
    if (!discoverySessionId) return;
    try {
      const res = await fetch("/api/discovery/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: discoverySessionId, action: "resume" }),
      });
      if (res.ok) {
        setDiscoveryPaused(false);
        setStreamMetrics((prev) => ({ ...prev, stage: "SCRAPING" }));
        setCurrentActivity("Resuming discovery pipeline...");
        addLog("[RESUMED] Discovery resumed. Continuing loop...", "INFO");
      }
    } catch (err: any) {
      console.error("Resume error:", err);
    }
  };

  // Cancel / Stop Discovery
  const handleCancelDiscovery = async () => {
    if (discoverySessionId) {
      try {
        await fetch("/api/discovery/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: discoverySessionId, action: "cancel" }),
        });
      } catch (_) {}
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setDiscoveryRunning(false);
    setDiscoveryPaused(false);
    resetDiscoveryState();
    await fetchLeads();
  };

  // Add Lead Form State (Clean defaults, zero dummy hardcoded text)
  const [newLeadForm, setNewLeadForm] = useState({
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    city: "Ahmedabad",
    category: "Commercial Office",
    projectType: "Modular Workstations",
    workstationCount: "",
    projectTimeline: "1-2 months",
    campaignName: "",
    leadSource: "paid_ads_meta",
    notes: "",
  });

  const fetchLeads = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const url = new URL("/api/candidates", window.location.origin);
      if (selectedStage === "DUMMY") {
        url.searchParams.set("dummy", "true");
      } else {
        if (selectedStage !== "ALL") url.searchParams.set("stage", selectedStage);
        url.searchParams.set("dummy", "false");
      }
      if (selectedChannel !== "ALL") url.searchParams.set("source", selectedChannel);
      if (selectedCity !== "ALL") url.searchParams.set("city", selectedCity);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.candidates) {
        setLeads(data.candidates);
        if (data.stageCounts) {
          setStageCounts(data.stageCounts);
        }
        if (data.channelCounts) {
          setChannelCounts(data.channelCounts);
        }
        // Auto-select first lead in Cockpit view if none selected
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

  const fetchRejectedLeads = async () => {
    try {
      setLoadingRejected(true);
      const res = await fetch("/api/leads/rejected");
      const data = await res.json();
      if (data.rejectedLeads) {
        setRejectedLeads(data.rejectedLeads);
        setRejectedCount(data.count ?? data.rejectedLeads.length);
      }
    } catch (err) {
      console.error("Error fetching rejected leads:", err);
    } finally {
      setLoadingRejected(false);
    }
  };

  const handleRestoreRejected = async (rejectedId: string) => {
    try {
      setRestoringRejectedId(rejectedId);
      const res = await fetch("/api/leads/rejected/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectedId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchRejectedLeads();
        await fetchLeads();
      } else {
        alert("Error restoring lead: " + (data.error || "Failed to restore"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setRestoringRejectedId(null);
    }
  };

  // CSV Import File Handler
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    try {
      const text = await file.text();
      const { leads: parsed, errors } = parseLeadCsv(text, importChannel);
      setImportPreview(parsed);
      setImportParseErrors(errors);
    } catch (err: any) {
      setImportParseErrors(["Failed to read file: " + err.message]);
    }
  };

  const handleExecuteCsvImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("source", importChannel);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult(data);
        await fetchLeads();
        await fetchRejectedLeads();
      } else {
        alert("Import Error: " + (data.error || "Failed to process CSV file"));
      }
    } catch (err: any) {
      alert("Network Error: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Reject Lead Action Handler
  const handleConfirmRejectLead = async () => {
    if (!rejectingLead) return;
    try {
      setSubmittingReject(true);
      const res = await fetch("/api/leads/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: rejectingLead.id,
          rejectionReason,
          notes: rejectionNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (selectedLeadId === rejectingLead.id) {
          setSelectedLeadId(null);
        }
        setShowRejectConfirmModal(false);
        setRejectingLead(null);
        setRejectionNotes("");
        await fetchLeads();
        await fetchRejectedLeads();
      } else {
        alert("Rejection Error: " + (data.error || "Failed to reject lead"));
      }
    } catch (err: any) {
      alert("Network Error: " + err.message);
    } finally {
      setSubmittingReject(false);
    }
  };

  // 1-Click Sample Inbound Ads Seeder
  const [seedingAds, setSeedingAds] = useState<boolean>(false);
  const handleSeedAdsChannel = async (channelToSeed: string) => {
    try {
      setSeedingAds(true);
      const res = await fetch("/api/leads/seed-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelToSeed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchLeads();
      } else {
        alert("Failed to seed sample leads: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error seeding leads: " + err.message);
    } finally {
      setSeedingAds(false);
    }
  };

  // Google Maps URL Resolver
  const getGoogleMapsUrl = (lead: Lead): string => {
    if (lead.sourceUrl && (lead.sourceUrl.includes("google.com/maps") || lead.sourceUrl.includes("maps.google.com") || lead.sourceUrl.includes("goo.gl/maps"))) {
      return lead.sourceUrl;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.businessName} ${lead.city || "Ahmedabad"}`)}`;
  };

  // Card Visual Styling by Pipeline State (Light Shades & State-Specific Contrast)
  const getStageCardStyle = (stage?: string, isDummy?: boolean, isSelected?: boolean) => {
    if (isDummy || stage === "DUMMY") {
      return {
        bg: "bg-[#FEFCE8]",
        hoverBg: "hover:bg-[#FEF08A]/70",
        selectedBg: "bg-[#FEFCE8]",
        borderLeft: "border-l-[#CA8A04]",
        badge: "bg-[#FEF08A] text-[#854D0E] border-[#FDE047]",
        dot: "#CA8A04",
        label: "Dummy Submissions",
      };
    }
    switch (stage) {
      case "QUALIFIED":
        return {
          bg: "bg-[#ECFDF5]", // light emerald-50
          hoverBg: "hover:bg-[#D1FAE5]/80",
          selectedBg: "bg-[#ECFDF5]",
          borderLeft: "border-l-[#059669]",
          badge: "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]",
          dot: "#059669",
          label: "Qualified",
        };
      case "FOLLOW_UP":
        return {
          bg: "bg-[#FFFBEB]", // light warm amber-50
          hoverBg: "hover:bg-[#FEF3C7]/80",
          selectedBg: "bg-[#FFFBEB]",
          borderLeft: "border-l-[#D97706]",
          badge: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
          dot: "#D97706",
          label: "Follow-up",
        };
      case "CONTACTED":
        return {
          bg: "bg-[#EEF2FF]", // light indigo-50
          hoverBg: "hover:bg-[#E0E7FF]/80",
          selectedBg: "bg-[#EEF2FF]",
          borderLeft: "border-l-[#4F46E5]",
          badge: "bg-[#E0E7FF] text-[#3730A3] border-[#C7D2FE]",
          dot: "#4F46E5",
          label: "Contacted",
        };
      case "LOST":
        return {
          bg: "bg-[#FEF2F2]", // light rose-50
          hoverBg: "hover:bg-[#FEE2E2]/80",
          selectedBg: "bg-[#FEF2F2]",
          borderLeft: "border-l-[#DC2626]",
          badge: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
          dot: "#DC2626",
          label: "Lost",
        };
      case "NEW":
      default:
        return {
          bg: "bg-white", // clean stark white as requested
          hoverBg: "hover:bg-[#F9FAFB]",
          selectedBg: "bg-white",
          borderLeft: "border-l-[#D1D5DB]",
          badge: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
          dot: "#9CA3AF",
          label: "New",
        };
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchRejectedLeads();

    // Auto-refresh candidate stream every 15 seconds so sales reps see incoming leads pushed by Desktop Generator
    const interval = setInterval(() => {
      fetchLeads(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedStage, selectedChannel, selectedCity]);

  // Selected Lead object
  const activeLead = leads.find((l) => l.id === selectedLeadId) || leads[0] || null;

  // Load candidate events whenever activeLead changes
  useEffect(() => {
    if (activeLead?.id) {
      loadEvents(activeLead.id);
      // Re-render template message for the new active lead
      const rendered = renderTemplate(activeTemplateId, activeLead);
      setCustomMessage(rendered.message);
    }
  }, [activeLead?.id, activeTemplateId]);

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

  // Stage Update Handler (Unified 7-Stage Pipeline with Zero-Flicker In-Place Optimistic Updates)
  const handleUpdateStage = async (leadId: string, newStage: string) => {
    const currentLead = leads.find((l) => l.id === leadId);
    const oldStage = currentLead?.qualificationStage || "NEW";
    if (oldStage === newStage) return;

    // 1. Instant local in-place update of lead state (smooth transition, zero list reload)
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, qualificationStage: newStage } : l))
    );

    // 2. Instant local in-place update of stage counts
    setStageCounts((prev) => {
      const counts = { ...prev };
      const getStageKey = (s: string): keyof StageCounts | null => {
        if (s === "NEW") return "new";
        if (s === "CONTACTED") return "contacted";
        if (s === "FOLLOW_UP") return "followUp";
        if (s === "QUALIFIED") return "qualified";
        if (s === "LOST") return "lost";
        return null;
      };
      const oldKey = getStageKey(oldStage);
      const newKey = getStageKey(newStage);
      if (oldKey && typeof counts[oldKey] === "number") {
        counts[oldKey] = Math.max(0, (counts[oldKey] as number) - 1);
      }
      if (newKey && typeof counts[newKey] === "number") {
        counts[newKey] = (counts[newKey] as number) + 1;
      }
      return counts;
    });

    try {
      const res = await fetch(`/api/candidates/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualificationStage: newStage }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      // Silently refresh timeline events without touching the leads list
      loadEvents(leadId);
    } catch (err: any) {
      // Gracefully revert optimistic update on network failure
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, qualificationStage: oldStage } : l))
      );
      setStageCounts((prev) => {
        const counts = { ...prev };
        const getStageKey = (s: string): keyof StageCounts | null => {
          if (s === "NEW") return "new";
          if (s === "CONTACTED") return "contacted";
          if (s === "FOLLOW_UP") return "followUp";
          if (s === "QUALIFIED") return "qualified";
          if (s === "LOST") return "lost";
          return null;
        };
        const oldKey = getStageKey(oldStage);
        const newKey = getStageKey(newStage);
        if (newKey && typeof counts[newKey] === "number") {
          counts[newKey] = Math.max(0, (counts[newKey] as number) - 1);
        }
        if (oldKey && typeof counts[oldKey] === "number") {
          counts[oldKey] = (counts[oldKey] as number) + 1;
        }
        return counts;
      });
      alert("Error updating status: " + err.message);
    }
  };

  // WhatsApp Launch & Activity Event Log
  const handleLaunchWhatsApp = async (lead: Lead, messageOverride?: string) => {
    const digitsOnly = (lead.phone || "").replace(/\D/g, "");
    let cleanPhone = digitsOnly;
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    const textToSend = messageOverride || customMessage;

    // Stop 15-minute SLA timer and advance to CONTACTED if NEW
    if ((lead.qualificationStage || "NEW") === "NEW") {
      handleUpdateStage(lead.id, "CONTACTED");
    }

    // Record lastContactedAt and outreach log
    await fetch(`/api/candidates/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markContacted: true }),
    });

    // Record custom event
    await fetch(`/api/candidates/${lead.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "OUTREACH_SENT",
        title: `WhatsApp: ${OUTREACH_TEMPLATES.find((t) => t.id === activeTemplateId)?.name || "Outreach"}`,
        description: textToSend.slice(0, 140) + "...",
        channel: "WHATSAPP",
      }),
    });

    loadEvents(lead.id);

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}`;
    window.open(waUrl, "_blank");
  };

  // Add Manual Event Note
  const handleAddQuickNote = async () => {
    if (!newQuickNote.trim() || !activeLead) return;
    try {
      await fetch(`/api/candidates/${activeLead.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "NOTE_UPDATED",
          title: "Operator Note",
          description: newQuickNote.trim(),
          channel: "PHONE",
        }),
      });
      setNewQuickNote("");
      loadEvents(activeLead.id);
    } catch (err) {
      console.error("Error adding note:", err);
    }
  };

  // Push to D'furn ERP
  const handlePushToErp = async (leadId: string) => {
    setBlockingLoader({
      active: true,
      message: "Syncing with ERP...",
    });

    try {
      const res = await fetch("/api/sync-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: leadId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically update synced status in-place (zero list flicker)
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, status: "SYNCED_TO_ERP", erpEnquiryCode: data.enquiryCode || "SYNCED" }
              : l
          )
        );
        loadEvents(leadId);
      } else {
        alert("ERP Sync Notice: " + (data.error || data.message || "Failed to sync with ERP"));
      }
    } catch (err: any) {
      alert("Network Error connecting to D'furn ERP: " + err.message);
    } finally {
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // Enrich Single Lead Contact & Phone
  const handleEnrichLead = async (leadId: string) => {
    setEnrichingLeadId(leadId);
    try {
      const res = await fetch(`/api/candidates/${leadId}/enrich`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success && data.phone) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  ...data.candidate,
                  phone: data.phone,
                  qualificationStage: "NEW",
                  enrichmentStatus: "ENRICHED",
                }
              : l
          )
        );
        setStageCounts((prev) => ({
          ...prev,
          new: prev.new + 1,
          lost: Math.max(0, prev.lost - 1),
        }));
        loadEvents(leadId);
        alert(`Success: Verified phone found: ${data.phone}! Lead restored to New.`);
      } else {
        alert(data.message || "No verified phone number found across Google Maps and web directories.");
      }
    } catch (err: any) {
      alert("Enrichment error: " + err.message);
    } finally {
      setEnrichingLeadId(null);
    }
  };

  // Bulk Enrich All Lost Leads
  const handleBulkEnrichLostLeads = async () => {
    setBulkEnriching(true);
    setBlockingLoader({
      active: true,
      message: "Enriching lost leads via Google Maps & web search...",
    });
    try {
      const res = await fetch("/api/candidates/bulk-enrich", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchLeads(false);
        alert(`Bulk Enrichment Complete: ${data.message}`);
      } else {
        alert(data.message || "Failed to complete bulk enrichment.");
      }
    } catch (err: any) {
      alert("Bulk enrichment error: " + err.message);
    } finally {
      setBulkEnriching(false);
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // CSV Export Download
  const handleExportCsv = () => {
    setBlockingLoader({
      active: true,
      message: "Exporting CSV...",
    });

    try {
      const url = new URL("/api/leads/export", window.location.origin);
      if (selectedStage !== "ALL") url.searchParams.set("stage", selectedStage);
      if (selectedChannel !== "ALL") url.searchParams.set("source", selectedChannel);
      if (selectedCity !== "ALL") url.searchParams.set("city", selectedCity);

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
      }, 600);
    }
  };

  // Manual Add Lead Submit
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockingLoader({
      active: true,
      message: "Saving Lead...",
    });

    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeadForm),
      });

      const data = await res.json();
      if (res.ok) {
        setShowAddLeadModal(false);
        setNewLeadForm({
          businessName: "",
          contactPerson: "",
          phone: "",
          email: "",
          city: "Ahmedabad",
          category: "Commercial Office",
          projectType: "Modular Workstations",
          workstationCount: "",
          projectTimeline: "1-2 months",
          campaignName: "",
          leadSource: "paid_ads_meta",
          notes: "",
        });
        await fetchLeads();
      } else {
        alert(data.error || "Failed to add lead");
      }
    } catch (err: any) {
      alert("Error adding lead: " + err.message);
    } finally {
      setBlockingLoader({ active: false, message: "" });
    }
  };

  // Received Time & Outreach Status Indicator
  const renderLeadTiming = (lead: Lead) => {
    if (lead.firstContactedAt) {
      return (
        <span className="text-[10px] text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded font-medium flex items-center gap-1">
          <Check className="w-3 h-3 text-[#059669]" />
          <span>Contacted</span>
        </span>
      );
    }

    if (!lead.createdAt) return null;

    const createdTime = new Date(lead.createdAt).getTime();
    const elapsedMinutes = Math.floor((Date.now() - createdTime) / 60000);

    let timeText = "";
    if (isNaN(elapsedMinutes) || elapsedMinutes < 1) {
      timeText = "Just now";
    } else if (elapsedMinutes < 60) {
      timeText = `${elapsedMinutes}m ago`;
    } else {
      const elapsedHours = Math.floor(elapsedMinutes / 60);
      if (elapsedHours < 24) {
        timeText = `${elapsedHours}h ago`;
      } else {
        const elapsedDays = Math.floor(elapsedHours / 24);
        timeText = `${elapsedDays}d ago`;
      }
    }

    return (
      <span className="text-[10px] text-[#4B5563] bg-[#F3F4F6] px-2 py-0.5 rounded font-medium flex items-center gap-1">
        <Clock className="w-3 h-3 text-[#6B7280]" />
        <span>{timeText}</span>
      </span>
    );
  };

  // Filtered Leads (with Multi-Channel & Sub-Channel Resolution)
  const displayedLeads = leads.filter((l) => {
    const { subChannel, multiTouchSources } = resolveSubChannel(l);

    if (multiTouchOnly && multiTouchSources.length === 0) return false;
    if (selectedSubCategory !== "ALL" && subChannel.category !== selectedSubCategory) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.businessName.toLowerCase().includes(q) ||
      (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.projectType && l.projectType.toLowerCase().includes(q)) ||
      (l.campaignName && l.campaignName.toLowerCase().includes(q)) ||
      subChannel.label.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Screen Blocking Mutation Loader */}
      {blockingLoader.active && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <RefreshCw className="w-8 h-8 text-[#FF7700] animate-spin" />
            <div>
              <h4 className="font-bold text-[#111827]">Processing</h4>
              <p className="text-xs text-[#6B7280] mt-1">{blockingLoader.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Command Bar (Search, Actions & View Mode Toggle) */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Leads</h1>
          <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full font-medium">
            {stageCounts.total} Total
          </span>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, contact, phone, city, or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] focus:bg-white transition"
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

        {/* View Mode Toggle & Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Cockpit vs Table View Toggle */}
          <div className="flex items-center rounded-lg border border-[#E5E7EB] p-0.5 bg-[#F9FAFB]">
            <button
              onClick={() => setViewMode("COCKPIT")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === "COCKPIT"
                  ? "bg-[#000000] text-white shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
              title="Split Cockpit View (Select a lead to view 360° Conversion Box)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cockpit</span>
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === "TABLE"
                  ? "bg-[#000000] text-white shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
              title="Spreadsheet Table View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => fetchLeads(false)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151] transition"
            title="Refresh Leads Stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#FF7700]" : ""}`} />
          </button>

          <button
            onClick={() => {
              if (!discoveryRunning) {
                resetDiscoveryState();
              }
              setShowDiscoveryModal(true);
            }}
            className="btn-primary text-xs px-3.5 py-1.5 font-semibold shadow-xs flex items-center gap-1.5 bg-[#000000] hover:bg-[#1F2937] text-white rounded-lg transition"
            title="Launch Automated Google Maps & Website Scraper"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Discover Specifiers</span>
          </button>

          <button
            onClick={() => {
              fetchRejectedLeads();
              setShowRejectedModal(true);
            }}
            className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2] transition shadow-xs flex items-center gap-1.5"
            title="View Disqualified / Rejected Leads Repository"
          >
            <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>Rejected ({rejectedCount})</span>
          </button>

          <button
            onClick={() => {
              setImportResult(null);
              setImportPreview([]);
              setImportParseErrors([]);
              setImportFile(null);
              setShowImportModal(true);
            }}
            className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#111827] border-[#D1D5DB] hover:bg-[#F3F4F6] transition shadow-xs flex items-center gap-1.5"
            title="Import leads from Meta Ads, Google Ads or custom CSV"
          >
            <Upload className="w-3.5 h-3.5 text-[#4B5563]" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#111827] border-[#D1D5DB] hover:bg-[#F3F4F6] transition shadow-xs flex items-center gap-1.5"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5 text-[#4B5563]" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => setShowAddLeadModal(true)}
            className="btn-primary text-xs px-3.5 py-1.5 font-semibold shadow-xs flex items-center gap-1.5 bg-[#FF7700] hover:bg-[#E06900] text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Lead</span>
          </button>
        </div>
      </div>

      {/* 1. Parent Channel Navigation Bar (Clean Neutral Tabs with Live Counts) */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#F3F4F6] pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
            {PARENT_CHANNELS.map((ch) => {
              const isActive = selectedChannel === ch.id;
              const count = channelCounts[ch.id] ?? (ch.id === "ALL" ? leads.length : 0);
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setSelectedChannel(ch.id);
                    setSelectedSubCategory("ALL");
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-2 transition shrink-0 ${
                    isActive
                      ? "bg-[#000000] text-white border-[#000000] shadow-xs"
                      : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#111827]"
                  }`}
                >
                  <span>{ch.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="text-xs border border-[#D1D5DB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] font-medium focus:ring-1 focus:ring-[#000000]"
            >
              <option value="ALL">All Cities</option>
              <option value="Ahmedabad">Ahmedabad</option>
              <option value="GIFT City">GIFT City</option>
              <option value="Surat">Surat</option>
              <option value="Vadodara">Vadodara</option>
              <option value="Changodar">Changodar</option>
              <option value="Pune">Pune</option>
            </select>
          </div>
        </div>

        {/* 2. Color-Coded Sub-Channel Quick Filter Strip */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
            <button
              onClick={() => setSelectedSubCategory("ALL")}
              className={`text-[11px] px-2.5 py-1 rounded-md border font-semibold transition ${
                selectedSubCategory === "ALL" && !multiTouchOnly
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB]"
              }`}
            >
              All Sub-Channels
            </button>

            {[
              { id: "WHATSAPP_CHAT", label: "Click-to-WhatsApp", style: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]", dot: "#22C55E" },
              { id: "AD_FORM", label: "Ad Lead Forms", style: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]", dot: "#3B82F6" },
              { id: "SEARCH_QUERY", label: "Search Queries", style: "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]", dot: "#0EA5E9" },
              { id: "ARCHITECT", label: "Architect Studios", style: "bg-[#FAF5FF] text-[#6D28D9] border-[#E9D5FF]", dot: "#8B5CF6" },
              { id: "CONTRACTOR", label: "Turnkey Contractors", style: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]", dot: "#F59E0B" },
              { id: "CANARY_HIRE", label: "Canary Hires", style: "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]", dot: "#F43F5E" },
              { id: "TRADE_REFERRAL", label: "Trade Referrals", style: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]", dot: "#14B8A6" },
              { id: "WEB_INBOUND", label: "Website Forms", style: "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]", dot: "#64748B" },
            ].map((sub) => {
              const isActive = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => {
                    setSelectedSubCategory(isActive ? "ALL" : sub.id);
                    setMultiTouchOnly(false);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-semibold transition flex items-center gap-1.5 ${sub.style} ${
                    isActive ? "ring-2 ring-[#000000] font-bold shadow-xs" : "hover:opacity-90"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sub.dot }} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* Multi-Touch Duplication Quick Toggle */}
          <button
            onClick={() => {
              setMultiTouchOnly(!multiTouchOnly);
              if (!multiTouchOnly) setSelectedSubCategory("ALL");
            }}
            className={`text-[11px] px-2.5 py-1 rounded-md border font-semibold transition flex items-center gap-1.5 ${
              multiTouchOnly
                ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] ring-2 ring-[#92400E]"
                : "bg-white text-[#92400E] border-[#FDE68A] hover:bg-[#FEF3C7]"
            }`}
            title="Filter leads that entered via multiple channels"
          >
            <span>⚠️ Multi-Touch ({leads.filter((l) => resolveSubChannel(l).multiTouchSources.length > 0).length})</span>
          </button>
        </div>
      </div>

      {/* Dedicated Inbound Ads Channel Overview & Controls Card */}
      {(selectedChannel === "paid_ads_meta" || selectedChannel === "paid_ads_google") && (
        <div className="bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7]/40 to-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-[#92400E]">
                  {selectedChannel === "paid_ads_meta"
                    ? "Meta Ads Channel (Facebook & Instagram Lead Generation)"
                    : "Google Ads Channel (Search OEM & Lead Form Extensions)"}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#92400E] border border-[#FDE68A]">
                  {selectedChannel === "paid_ads_meta" ? "Instant Forms + WhatsApp" : "Commercial Search Assets"}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                  Webhook Active
                </span>
              </div>
              <p className="text-xs text-[#78350F] leading-relaxed max-w-3xl">
                {selectedChannel === "paid_ads_meta"
                  ? "Captures commercial interior leads from Meta Instant Forms and Click-to-WhatsApp ad campaigns across Gujarat. Incoming submissions are automatically qualified by workstation count (20+ seats) and office project scope. Suspected dummy phones (such as repeated digits or 10-digit sequential patterns) are safely routed to the Dummy Submissions review list rather than discarded."
                  : "Captures high-intent commercial procurement queries ('modular workstations manufacturer', 'factory office fitouts'). Evaluated for corporate email validity, floor plan readiness, and line-item factory BOQ turnaround."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setImportChannel(selectedChannel);
                  setShowImportModal(true);
                }}
                className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#92400E] border-[#FDE68A] bg-white hover:bg-[#FEF3C7] shadow-2xs transition flex items-center gap-1.5"
                title="Import Ads CSV export"
              >
                <Upload className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Import {selectedChannel === "paid_ads_meta" ? "Meta" : "Google"} CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handleSeedAdsChannel(selectedChannel)}
                disabled={seedingAds}
                className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#111827] border-[#D1D5DB] bg-white hover:bg-[#F3F4F6] shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                title="Load realistic sample ad leads to test qualification and dummy phone handling"
              >
                {seedingAds ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Seeding Leads...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#FF7700]" />
                    <span>Load Sample Ad Leads</span>
                  </>
                )}
              </button>

              {(stageCounts.dummy ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStage(selectedStage === "DUMMY" ? "ALL" : "DUMMY")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition shadow-2xs flex items-center gap-1.5 ${
                    selectedStage === "DUMMY"
                      ? "bg-[#92400E] text-white border-[#92400E]"
                      : "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] hover:bg-[#FDE68A]"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{selectedStage === "DUMMY" ? "Viewing Dummy List" : `Inspect Dummy Phones (${stageCounts.dummy})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Pipeline Navigation (Stages up to Qualified with State-Matched Dots) */}
      <div className="bg-white p-2.5 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-wrap">
          {[
            { id: "ALL", label: "All Leads", count: Math.max(0, stageCounts.total - (stageCounts.dummy || 0)), dot: null },
            { id: "NEW", label: "New", count: stageCounts.new, dot: "#9CA3AF" },
            { id: "CONTACTED", label: "Contacted", count: stageCounts.contacted, dot: "#4F46E5" },
            { id: "FOLLOW_UP", label: "Follow-up", count: stageCounts.followUp, dot: "#D97706" },
            { id: "QUALIFIED", label: "Qualified", count: stageCounts.qualified, dot: "#059669" },
            { id: "LOST", label: "Lost / Incomplete", count: stageCounts.lost, dot: "#DC2626" },
            { id: "DUMMY", label: "⚠️ Dummy Submissions", count: stageCounts.dummy || 0, dot: "#CA8A04" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStage(st.id)}
              className={`tab-pill flex items-center gap-1.5 text-xs py-1 px-3 ${
                selectedStage === st.id ? "active" : ""
              }`}
            >
              {st.dot && (
                <span className="w-2 h-2 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: st.dot }} />
              )}
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

      {/* VIEW MODE 1: MASTER-DETAIL SPLIT COCKPIT (RECOMMENDED) */}
      {viewMode === "COCKPIT" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Master Lead List (40% width on Desktop, Full View on Mobile) */}
          <div
            className={`lg:col-span-5 bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden flex flex-col h-[calc(100dvh-230px)] min-h-[500px] lg:h-[750px] ${
              mobilePane === "DETAIL" ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280] font-semibold uppercase tracking-wider flex-wrap gap-2">
              <span>Candidate Stream ({displayedLeads.length})</span>
              <div className="flex items-center gap-2 text-[10px] font-normal normal-case">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white border border-[#9CA3AF]" />New (White)</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />Contacted</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />Follow-up</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />Qualified (Green)</span>
              </div>
            </div>

            {selectedStage === "LOST" && displayedLeads.length > 0 && (
              <div className="px-3.5 py-2.5 bg-[#FEF2F2] border-b border-[#FECACA] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#991B1B]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                  <span>{displayedLeads.length} Lost Lead(s) Missing Phone</span>
                </div>
                <button
                  type="button"
                  onClick={handleBulkEnrichLostLeads}
                  disabled={bulkEnriching}
                  className="text-xs px-2.5 py-1 rounded-md font-bold bg-[#DC2626] hover:bg-[#B91C1C] text-white transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                  title="Enrich all lost leads with Google Maps and web directory search"
                >
                  <Sparkles className={`w-3 h-3 ${bulkEnriching ? "animate-spin" : ""}`} />
                  <span>{bulkEnriching ? "Enriching All..." : "Enrich All Lost Leads"}</span>
                </button>
              </div>
            )}

            <div className="overflow-y-auto divide-y divide-[#E5E7EB] flex-1">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#6B7280] mx-auto" />
                  <p className="text-xs text-[#6B7280] mt-2">Loading leads...</p>
                </div>
              ) : displayedLeads.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280] space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto text-[#9CA3AF]">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#111827]">
                      {selectedChannel === "paid_ads_meta"
                        ? "No Meta Ads leads received yet"
                        : selectedChannel === "paid_ads_google"
                        ? "No Google Ads leads received yet"
                        : "No leads match active filters"}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-1 max-w-xs mx-auto">
                      {(selectedChannel === "paid_ads_meta" || selectedChannel === "paid_ads_google")
                        ? "Connect your Ads Manager webhook, upload a CSV export, or load sample test leads to inspect campaign qualification."
                        : "Try adjusting your stage, channel, or city filters to view other candidates."}
                    </p>
                  </div>
                  {(selectedChannel === "paid_ads_meta" || selectedChannel === "paid_ads_google") && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setImportChannel(selectedChannel);
                          setShowImportModal(true);
                        }}
                        className="btn-secondary text-xs px-3 py-1.5 font-semibold text-[#374151]"
                      >
                        <Upload className="w-3.5 h-3.5 inline mr-1 text-[#FF7700]" />
                        <span>Upload CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeedAdsChannel(selectedChannel)}
                        disabled={seedingAds}
                        className="btn-primary text-xs px-3 py-1.5 bg-[#FF7700] hover:bg-[#E06900] text-white font-semibold rounded-md shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                        <span>Load Sample Leads</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                displayedLeads.map((lead) => {
                  const isSelected = activeLead?.id === lead.id;
                  const currentStage = lead.qualificationStage || "NEW";
                  const isSynced = lead.status === "SYNCED_TO_ERP" || Boolean(lead.erpEnquiryCode);
                  const { parentLabel, subChannel, multiTouchSources } = resolveSubChannel(lead);
                  const stageStyle = getStageCardStyle(currentStage, lead.isDummyPhone, isSelected);

                  return (
                    <div
                      key={lead.id}
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setMobilePane("DETAIL");
                      }}
                      className={`p-3.5 cursor-pointer transition flex items-start justify-between gap-3 border-l-4 ${stageStyle.borderLeft} ${
                        isSelected
                          ? `${stageStyle.selectedBg} ring-2 ring-[#FF7700] ring-inset shadow-xs`
                          : `${stageStyle.bg} ${stageStyle.hoverBg}`
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-[#111827] truncate">
                            {lead.businessName}
                          </h4>
                          <a
                            href={getGoogleMapsUrl(lead)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open Google Maps Profile"
                            className="text-[#EA4335] hover:text-[#C5221F] p-0.5 rounded hover:bg-[#FEE2E2]/60 transition shrink-0"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </a>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white text-[#4B5563] border border-[#E5E7EB] shrink-0">
                            {lead.leadTier || "A"}
                          </span>
                        </div>

                        {/* Attribution: Neutral Parent Channel · Color-Coded Sub-Channel Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-[#4B5563]">{parentLabel}</span>
                          <span className="text-[#9CA3AF]">·</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${subChannel.badgeStyle}`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subChannel.dotColor }} />
                            <span>{subChannel.label}</span>
                          </span>
                          {multiTouchSources.length > 0 && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] flex items-center gap-0.5"
                              title="Multiple touchpoints detected across channels"
                            >
                              <span>⚠️ Multi-Touch</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#4B5563] flex items-center gap-1.5 flex-wrap">
                          <span>{lead.contactPerson || lead.city}</span>
                          <span>·</span>
                          <span className="text-[#6B7280]">
                            {lead.workstationCount ? `${lead.workstationCount} Seats` : lead.projectType}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${stageStyle.badge}`}
                          >
                            {lead.isDummyPhone ? "DUMMY PHONE" : currentStage}
                          </span>

                          {lead.isDummyPhone && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] flex items-center gap-0.5">
                              <span>⚠️ Dummy Phone</span>
                            </span>
                          )}

                          {lead.enrichmentStatus === "ENRICHED" && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                              ✓ Enriched
                            </span>
                          )}

                          {lead.enrichmentStatus === "FAILED" && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">
                              No Phone
                            </span>
                          )}

                          {(currentStage === "LOST" || !lead.phone || lead.phone === "-" || lead.phone === "–") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnrichLead(lead.id);
                              }}
                              disabled={enrichingLeadId === lead.id}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                              title="Search Google Maps & web search for phone number"
                            >
                              <Sparkles className={`w-3 h-3 text-[#2563EB] ${enrichingLeadId === lead.id ? "animate-spin" : ""}`} />
                              <span>{enrichingLeadId === lead.id ? "Finding..." : "Enrich Phone"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        {renderLeadTiming(lead)}
                        <span className="text-[10px] text-[#9CA3AF]">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: 360° Conversion Box (60% width on Desktop, Full View on Mobile) */}
          <div
            className={`lg:col-span-7 bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden flex flex-col h-[calc(100dvh-230px)] min-h-[500px] lg:h-[750px] relative ${
              mobilePane === "STREAM" ? "hidden lg:flex" : "flex"
            }`}
          >
            {activeLead ? (
              <>
                {/* Mobile Drill-In Back Navigation Header */}
                <div className="lg:hidden px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobilePane("STREAM")}
                    className="text-xs font-semibold text-[#111827] hover:text-[#FF7700] flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-md transition"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#FF7700]" />
                    <span>Back to Leads</span>
                  </button>
                  <span className="text-[11px] font-medium text-[#6B7280]">
                    {displayedLeads.findIndex((l) => l.id === activeLead.id) + 1} of {displayedLeads.length}
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-5 pb-20 lg:pb-5">
                {/* 1. Header Profile & Quick Actions */}
                {(() => {
                  const { parentLabel, subChannel, multiTouchSources } = resolveSubChannel(activeLead);
                  return (
                    <div className="space-y-3 border-b border-[#F3F4F6] pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-[#111827]">
                              {activeLead.businessName}
                            </h2>
                            <a
                              href={getGoogleMapsUrl(activeLead)}
                              target="_blank"
                              rel="noreferrer"
                              title="Open profile on Google Maps"
                              className="text-[#EA4335] hover:text-[#C5221F] px-2 py-0.5 rounded bg-[#FEF2F2] border border-[#FECACA] transition flex items-center gap-1 text-[11px] font-semibold"
                            >
                              <MapPin className="w-3.5 h-3.5 text-[#EA4335]" />
                              <span>Google Maps</span>
                            </a>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">
                              {activeLead.category}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white text-[#4B5563] border border-[#E5E7EB]">
                              Tier {activeLead.leadTier || "A"}
                            </span>
                          </div>

                          {/* Attribution: Neutral Parent Channel · Color-Coded Sub-Channel Badge */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-1.5">
                            <span className="font-semibold text-[#111827]">
                              Channel: {parentLabel}
                            </span>
                            <span>·</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-flex items-center gap-1.5 ${subChannel.badgeStyle}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subChannel.dotColor }} />
                              <span>{subChannel.label}</span>
                            </span>
                            {activeLead.campaignName && (
                              <>
                                <span>·</span>
                                <span className="text-[#6B7280]">{activeLead.campaignName}</span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B7280] mt-1.5">
                            {activeLead.contactPerson && activeLead.contactPerson.toLowerCase() !== "none" ? (
                              <>
                                <span className="font-medium text-[#111827]">
                                  Contact: {activeLead.contactPerson}
                                </span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span>City: {activeLead.city}</span>
                            {activeLead.phone ? (
                              <>
                                <span>·</span>
                                <span>Phone: {activeLead.phone}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Primary ERP Push & Status Indicator */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(activeLead.qualificationStage === "LOST" || !activeLead.phone || activeLead.phone === "-" || activeLead.phone === "–") && (
                            <button
                              type="button"
                              onClick={() => handleEnrichLead(activeLead.id)}
                              disabled={enrichingLeadId === activeLead.id}
                              className="text-xs px-3.5 py-1.5 rounded-md font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                              title="Search Google Maps and web directories for phone numbers"
                            >
                              <Sparkles className={`w-3.5 h-3.5 text-[#2563EB] ${enrichingLeadId === activeLead.id ? "animate-spin" : ""}`} />
                              <span>{enrichingLeadId === activeLead.id ? "Finding Phone..." : "Enrich Phone"}</span>
                            </button>
                          )}

                          {activeLead.status === "SYNCED_TO_ERP" || activeLead.erpEnquiryCode ? (
                            <span className="text-xs font-bold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1.5 rounded-md flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              <span>Synced: {activeLead.erpEnquiryCode}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePushToErp(activeLead.id)}
                              className={`text-xs px-3.5 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${
                                activeLead.qualificationStage === "QUALIFIED"
                                  ? "bg-[#FF7700] hover:bg-[#E06900] text-white shadow-xs"
                                  : "bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB]"
                              }`}
                              title="Push qualified lead into D'furn ERP"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Push to ERP</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setRejectingLead(activeLead);
                              setRejectionReason("RESIDENTIAL_MISMATCH");
                              setRejectionNotes("");
                              setShowRejectConfirmModal(true);
                            }}
                            className="text-xs px-3 py-1.5 rounded-md font-semibold text-[#DC2626] border border-[#FCA5A5] hover:bg-[#FEF2F2] transition flex items-center gap-1.5"
                            title="Disqualify and move lead to Rejected Leads repository"
                          >
                            <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span>Reject Lead</span>
                          </button>
                        </div>
                      </div>

                      {/* Multi-Touch Deduplication Card */}
                      {multiTouchSources.length > 0 && (
                        <div className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#92400E] flex items-center gap-1.5">
                              <span>⚠️ Multi-Touch Attribution Detected</span>
                            </span>
                            <span className="text-[10px] font-semibold bg-white text-[#92400E] px-2 py-0.5 rounded border border-[#FDE68A]">
                              Deduplicated Account
                            </span>
                          </div>
                          <p className="text-[11px] text-[#78350F]">
                            This prospect interacted across multiple acquisition channels. All contact history is unified under this master record.
                          </p>
                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${subChannel.badgeStyle}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subChannel.dotColor }} />
                              <span>Primary: {subChannel.label}</span>
                            </span>
                            {multiTouchSources.map((sec, i) => (
                              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-[#4B5563] border border-[#E5E7EB]">
                                Secondary: {sec.replace("_", " ").toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suspected Dummy Phone Number Banner */}
                      {activeLead.isDummyPhone && (
                        <div className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-3 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-[#92400E] text-xs">
                            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                            <span>Suspected Dummy Phone Number ({activeLead.phone})</span>
                          </div>
                          <p className="text-[11px] text-[#78350F] leading-relaxed">
                            This lead submitted a test or repeating sequence phone number. Kept in the portal for manual operator review instead of discarding. Verify alternate contact info (email: {activeLead.email || "none"}) before initiating WhatsApp outreach.
                          </p>
                        </div>
                      )}
                      {/* Lost / Incomplete Lead Recovery Banner */}
                      {(activeLead.qualificationStage === "LOST" || !activeLead.phone || activeLead.phone === "-" || activeLead.phone === "–") && (
                        <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-3.5 flex items-center justify-between gap-3 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#991B1B]">
                              <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                              <span>Lost / Incomplete Lead (Missing Phone Number)</span>
                            </div>
                            <p className="text-[11px] text-[#7F1D1D]">
                              This candidate was routed to Lost because telephone contact details were missing. Click below to search Google Maps & web directories.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEnrichLead(activeLead.id)}
                            disabled={enrichingLeadId === activeLead.id}
                            className="text-xs px-3.5 py-1.5 rounded-md font-bold bg-[#DC2626] hover:bg-[#B91C1C] text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${enrichingLeadId === activeLead.id ? "animate-spin" : ""}`} />
                            <span>{enrichingLeadId === activeLead.id ? "Finding Phone..." : "Find Phone & Restore"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. Pipeline Stage Selector (Strictly Black Active #000000) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                    Pipeline Stage:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: "NEW", label: "New" },
                      { id: "CONTACTED", label: "Contacted" },
                      { id: "FOLLOW_UP", label: "Follow-up" },
                      { id: "QUALIFIED", label: "Qualified" },
                      { id: "LOST", label: "Lost" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => handleUpdateStage(activeLead.id, st.id)}
                        className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${
                          (activeLead.qualificationStage || "NEW") === st.id
                            ? "bg-[#000000] text-white border-[#000000]"
                            : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Production Outreach Box (Dynamic Templates + Editable Message) */}
                <div className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#25D366]" />
                      <span>Production Outreach Engine</span>
                    </span>

                    {/* Template Quick Pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {OUTREACH_TEMPLATES.filter((t) => t.channel === "WHATSAPP").map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            setActiveTemplateId(tpl.id);
                            const rendered = renderTemplate(tpl.id, activeLead);
                            setCustomMessage(rendered.message);
                          }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                            activeTemplateId === tpl.id
                              ? "bg-[#000000] text-white border-[#000000]"
                              : "bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F3F4F6]"
                          }`}
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Editable Message Box */}
                  <textarea
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full text-xs p-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000] font-sans leading-relaxed text-[#1F2937]"
                    placeholder="Outreach copy..."
                  />

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(customMessage);
                          setCopiedMessage(true);
                          setTimeout(() => setCopiedMessage(false), 2000);
                        }}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        {copiedMessage ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>

                      {activeLead.phone && (
                        <a
                          href={`tel:${activeLead.phone}`}
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-[#374151]"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call {activeLead.phone}</span>
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => handleLaunchWhatsApp(activeLead, customMessage)}
                      disabled={!activeLead.phone}
                      className="bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-semibold px-4 py-1.5 rounded-md flex items-center gap-1.5 shadow-xs transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Launch WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* 4. Complete Event & Outreach Activity Log */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2">
                    <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <History className="w-4 h-4 text-[#4B5563]" />
                      <span>Activity Log & Outreach Ledger ({events.length})</span>
                    </span>

                    {loadingEvents && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#9CA3AF]" />}
                  </div>

                  {/* Add Quick Log Entry */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Log phone discussion, site visit note, or architect feedback..."
                      value={newQuickNote}
                      onChange={(e) => setNewQuickNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddQuickNote();
                      }}
                      className="flex-1 px-3 py-1.5 text-xs border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#000000]"
                    />
                    <button
                      onClick={handleAddQuickNote}
                      className="btn-secondary text-xs px-3 py-1.5 font-semibold"
                    >
                      Log Note
                    </button>
                  </div>

                  {/* Events Timeline Feed */}
                  <div className="space-y-2 pt-2 max-h-48 overflow-y-auto">
                    {events.length === 0 ? (
                      <p className="text-[11px] text-[#9CA3AF] italic text-center py-3">
                        Zero recorded outreach events for this lead yet.
                      </p>
                    ) : (
                      events.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] text-xs flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-[#111827] flex items-center gap-1.5">
                              {evt.channel === "WHATSAPP" ? (
                                <MessageSquare className="w-3 h-3 text-[#25D366]" />
                              ) : evt.channel === "ERP" ? (
                                <Send className="w-3 h-3 text-[#FF7700]" />
                              ) : (
                                <Clock className="w-3 h-3 text-[#6B7280]" />
                              )}
                              <span>{evt.title}</span>
                            </div>
                            {evt.description && (
                              <p className="text-[11px] text-[#4B5563] leading-relaxed">
                                {evt.description}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap">
                            {new Date(evt.createdAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Floating Thumb-Zone Action Bar */}
              <div className="lg:hidden p-3 bg-white/95 backdrop-blur-xs border-t border-[#E5E7EB] shadow-lg absolute bottom-0 inset-x-0 z-20 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleLaunchWhatsApp(activeLead)}
                  className="flex-1 py-2.5 px-3 bg-[#25D366] hover:bg-[#20BA5C] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                {activeLead.phone && activeLead.phone !== "-" && (
                  <a
                    href={`tel:${activeLead.phone.replace(/[^0-9+]/g, "")}`}
                    className="p-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-lg border border-[#D1D5DB] flex items-center justify-center shrink-0 transition"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-4 h-4 text-[#374151]" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handlePushToErp(activeLead.id)}
                  disabled={activeLead.status === "SYNCED_TO_ERP" || Boolean(activeLead.erpEnquiryCode)}
                  className="py-2.5 px-3 bg-[#000000] hover:bg-[#1F2937] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{activeLead.erpEnquiryCode ? "Synced" : "Push ERP"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRejectingLead(activeLead);
                    setRejectionReason("RESIDENTIAL_MISMATCH");
                    setRejectionNotes("");
                    setShowRejectConfirmModal(true);
                  }}
                  className="p-2.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] rounded-lg border border-[#FCA5A5] flex items-center justify-center shrink-0 transition"
                  title="Reject Lead"
                >
                  <XCircle className="w-4 h-4 text-[#DC2626]" />
                </button>
              </div>
            </>
            ) : (
              <div className="p-16 text-center text-xs text-[#6B7280]">
                Select a lead from the left stream to view conversion cockpit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SPREADSHEET TABLE VIEW */}
      {viewMode === "TABLE" && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-[#6B7280] mx-auto" />
              <p className="text-xs text-[#6B7280] mt-2">Loading leads from PostgreSQL cluster...</p>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <Building2 className="w-10 h-10 text-[#9CA3AF] mx-auto" />
              <h3 className="font-semibold text-sm text-[#111827]">No Leads Found</h3>
              <p className="text-xs text-[#6B7280]">
                No candidate leads match the active filters or search parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                    <th className="py-3 px-4">Lead & Contact</th>
                    <th className="py-3 px-4">Channel & Sub-Source</th>
                    <th className="py-3 px-4">Lead Tier</th>
                    <th className="py-3 px-4">Outreach & WhatsApp</th>
                    <th className="py-3 px-4">Pipeline Stage</th>
                    <th className="py-3 px-4 text-right">ERP Handoff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-xs">
                  {displayedLeads.map((lead, idx) => {
                    const currentStage = lead.qualificationStage || "NEW";
                    const isSynced = lead.status === "SYNCED_TO_ERP" || Boolean(lead.erpEnquiryCode);
                    const { parentLabel, subChannel, multiTouchSources } = resolveSubChannel(lead);
                    const isSelected = activeLead?.id === lead.id;
                    const stageStyle = getStageCardStyle(currentStage, lead.isDummyPhone, isSelected);

                    return (
                      <tr
                        key={lead.id}
                        className={`transition border-l-4 ${stageStyle.borderLeft} ${
                          isSelected
                            ? `${stageStyle.selectedBg} ring-2 ring-[#FF7700] ring-inset shadow-xs`
                            : `${stageStyle.bg} ${stageStyle.hoverBg}`
                        }`}
                      >
                        {/* Lead & Contact Details */}
                        <td className="py-3 px-4 min-w-[200px]">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setViewMode("COCKPIT");
                                }}
                                className="font-bold text-sm text-[#111827] hover:text-[#FF7700] cursor-pointer transition flex items-center gap-1"
                              >
                                <span>{lead.businessName}</span>
                                <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                              </span>
                              <a
                                href={getGoogleMapsUrl(lead)}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in Google Maps"
                                className="text-[#EA4335] hover:text-[#C5221F] p-0.5 rounded hover:bg-[#FEE2E2]/60 transition shrink-0"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <div className="text-[11px] text-[#6B7280] mt-0.5">
                              {lead.contactPerson ? `${lead.contactPerson} · ` : ""}
                              {lead.city} · {lead.category || "Commercial Specifier"}
                            </div>
                          </div>
                        </td>

                        {/* Channel & Sub-Source */}
                        <td className="py-3 px-4 min-w-[210px]">
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-[#4B5563] block">
                              {parentLabel}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${subChannel.badgeStyle}`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subChannel.dotColor }} />
                                <span>{subChannel.label}</span>
                              </span>
                              {multiTouchSources.length > 0 && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                                  title="Multiple touchpoints detected"
                                >
                                  ⚠️ Multi-Touch
                                </span>
                              )}
                            </div>
                            {lead.campaignName && (
                              <span className="text-[10px] text-[#9CA3AF] block truncate max-w-[190px]">
                                {lead.campaignName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Lead Tier */}
                        <td className="py-3 px-4 min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                                  (lead.leadTier || "A") === "A+"
                                    ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                                    : (lead.leadTier || "A") === "A"
                                    ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]"
                                    : (lead.leadTier || "A") === "B"
                                    ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                                    : "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                                }`}
                              >
                                <span>Tier {lead.leadTier || "A"}</span>
                              </span>
                              {lead.totalScore !== undefined && lead.totalScore !== null && (
                                <span className="text-[11px] font-semibold text-[#4B5563]">
                                  {lead.totalScore} pts
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#6B7280] leading-tight">
                              {lead.hasCommercialFocus ? "Commercial Focus" : "General Specifier"}
                              {lead.workstationCount ? ` · ${lead.workstationCount} Seats` : ""}
                            </div>
                          </div>
                        </td>

                        {/* Outreach & WhatsApp Action */}
                        <td className="py-3 px-4 min-w-[170px]">
                          <div className="space-y-1.5">
                            {renderLeadTiming(lead)}

                            {lead.isDummyPhone && (
                              <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded border border-[#FDE68A] inline-flex items-center gap-1">
                                <span>⚠️ Dummy Phone</span>
                              </span>
                            )}

                            {lead.enrichmentStatus === "ENRICHED" && (
                              <span className="text-[10px] font-semibold text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0] inline-flex items-center gap-1">
                                <span>✓ Enriched</span>
                              </span>
                            )}

                            {lead.phone && lead.phone !== "-" && lead.phone !== "–" ? (
                              <button
                                onClick={() => handleLaunchWhatsApp(lead)}
                                className="text-xs font-semibold bg-[#25D366] hover:bg-[#20BA5A] text-white px-2.5 py-1 rounded flex items-center gap-1.5 shadow-xs transition"
                                title="Launch WhatsApp chat"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEnrichLead(lead.id)}
                                disabled={enrichingLeadId === lead.id}
                                className="text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] hover:bg-[#DBEAFE] px-2.5 py-1 rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                                title="Enrich phone number via Google Maps & web search"
                              >
                                <Sparkles className={`w-3.5 h-3.5 text-[#2563EB] ${enrichingLeadId === lead.id ? "animate-spin" : ""}`} />
                                <span>{enrichingLeadId === lead.id ? "Finding..." : "Enrich Phone"}</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Pipeline Row Pills (Selected State is Strictly BLACK #000000) */}
                        <td className="py-3 px-4 min-w-[240px]">
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
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
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

                        {/* ERP Handoff Actions */}
                        <td className="py-3 px-4 text-right min-w-[170px]">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {isSynced ? (
                              <span className="text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>{lead.erpEnquiryCode || "Synced"}</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePushToErp(lead.id)}
                                className={`text-xs px-2.5 py-1 rounded font-semibold transition inline-flex items-center gap-1.5 ${
                                  currentStage === "QUALIFIED"
                                    ? "bg-[#FF7700] hover:bg-[#E06900] text-white shadow-xs"
                                    : "bg-white hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB]"
                                }`}
                                title="Push qualified lead into D'furn ERP"
                              >
                                <Send className="w-3 h-3" />
                                <span>Push</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setRejectingLead(lead);
                                setRejectionReason("RESIDENTIAL_MISMATCH");
                                setRejectionNotes("");
                                setShowRejectConfirmModal(true);
                              }}
                              className="text-xs px-2 py-1 rounded font-semibold text-[#DC2626] border border-[#FCA5A5] hover:bg-[#FEF2F2] transition inline-flex items-center gap-1"
                              title="Reject Lead"
                            >
                              <XCircle className="w-3 h-3 text-[#DC2626]" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: + Add Lead (Clean Blank Defaults) */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FF7700]" />
                <h3 className="font-bold text-base text-[#111827]">Add Lead</h3>
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
                  <label className="block font-semibold text-[#374151] mb-1">Company / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Synergy Tech Spaces LLP"
                    value={newLeadForm.businessName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Karan Singhal"
                    value={newLeadForm.contactPerson}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98250 88990"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="karan@synergytechspaces.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
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
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Workstation Count</label>
                  <input
                    type="number"
                    placeholder="e.g. 60"
                    value={newLeadForm.workstationCount}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, workstationCount: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Lead Source</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {["paid_ads_meta", "paid_ads_google", "website_form", "direct"].map((src) => (
                      <button
                        type="button"
                        key={src}
                        onClick={() => setNewLeadForm({ ...newLeadForm, leadSource: src })}
                        className={`text-[10px] py-1 px-2.5 rounded-full border transition ${
                          newLeadForm.leadSource === src
                            ? "bg-[#000000] text-white border-[#000000] font-semibold"
                            : "bg-white text-[#4B5563] border-[#D1D5DB]"
                        }`}
                      >
                        {src === "paid_ads_meta"
                          ? "Meta"
                          : src === "paid_ads_google"
                          ? "Google"
                          : src === "website_form"
                          ? "Web"
                          : "Direct"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#374151] mb-1">Campaign / Sub-Source</label>
                  <input
                    type="text"
                    placeholder="e.g. Meta_Ahd_OfficeFitout_Q4"
                    value={newLeadForm.campaignName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, campaignName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1">Operator Notes</label>
                <textarea
                  rows={2}
                  placeholder="Inquiry requirements, acoustic partitions, timeline..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="btn-secondary px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-1.5 bg-[#FF7700] hover:bg-[#E06900] text-white font-semibold rounded-md"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Autonomous Specifier Discovery with Verbose Telemetry, Pause/Resume & Cancel */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-0 sm:my-6 max-h-[92dvh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAFAFA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF7700] flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-[#111827]">Specifier Discovery & Lead Scraper</h3>
                    {discoveryRunning && !discoveryPaused && (
                      <span className="flex items-center gap-1 text-[10px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] px-2 py-0.5 rounded-full font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
                        LIVE
                      </span>
                    )}
                    {discoveryPaused && (
                      <span className="text-[10px] bg-[#FFFBEB] text-[#B45309] border border-[#FCD34D] px-2 py-0.5 rounded-full font-semibold">
                        PAUSED
                      </span>
                    )}
                    {!discoveryRunning && streamMetrics.stage === "COMPLETE" && (
                      <span className="text-[10px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] px-2 py-0.5 rounded-full font-semibold">
                        COMPLETED
                      </span>
                    )}
                    {!discoveryRunning && streamMetrics.stage === "CANCELLED" && (
                      <span className="text-[10px] bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] px-2 py-0.5 rounded-full font-semibold">
                        STOPPED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280]">Google Maps headless scraper, portfolio auditor & 5D qualification engine</p>
                </div>
              </div>

              {/* Time Elapsed Counter & Close */}
              <div className="flex items-center gap-2">
                {(discoveryRunning || elapsedSeconds > 0) && (
                  <div className="flex items-center gap-1.5 bg-[#F3F4F6] px-2.5 py-1 rounded-md border border-[#E5E7EB] font-mono text-xs text-[#374151]" title="Time Elapsed">
                    <Clock className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span className="font-bold">{formatElapsed(elapsedSeconds)}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (discoveryRunning) {
                      if (confirm("Discovery is currently running. Stop scraper and close?")) {
                        handleCancelDiscovery();
                        resetDiscoveryState();
                        setShowDiscoveryModal(false);
                      }
                    } else {
                      resetDiscoveryState();
                      setShowDiscoveryModal(false);
                    }
                  }}
                  className="text-[#9CA3AF] hover:text-[#111827] p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">

              {/* Form Controls (Only shown before running or when idle/finished) */}
              {!discoveryRunning && streamMetrics.stage !== "SCRAPING" && streamMetrics.stage !== "AUDITING" && (
                <div className="space-y-4 pb-2 border-b border-[#F3F4F6]">
                  {/* Two-Tier Operator Notice */}
                  <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#DBEAFE] text-[#1E40AF] flex items-center justify-center shrink-0 font-bold text-xs">
                      PC
                    </div>
                    <div className="text-[11px] leading-relaxed text-[#1E3A8A] flex-1">
                      <div className="font-bold text-[#1E40AF] text-xs flex items-center gap-1.5 mb-0.5">
                        <span>High-Volume Scraping: Use Tier 1 Desktop Tool</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1E40AF] text-white font-medium">Recommended</span>
                      </div>
                      Google Maps restricts automated cloud servers (Vercel datacenter IPs) with bot checks. For 100% verified phone numbers on large corridor runs, double-click <code className="bg-[#DBEAFE] px-1 py-0.5 rounded font-mono font-bold text-[#1E40AF]">run-lead-generator.bat</code> on your office workstation. Discovered leads sync directly to this screen.
                    </div>
                  </div>

                  {/* Clean 2-Box Specifier Query Approach */}
                  <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-semibold text-[#374151] mb-1">
                          1. Specifier Field / Profession *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Commercial Architects or Fitout Contractors"
                          value={discoveryForm.industry}
                          onChange={(e) => setDiscoveryForm({ ...discoveryForm, industry: e.target.value })}
                          className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000] bg-white text-xs"
                        />
                        <span className="text-[10px] text-[#6B7280] mt-1 block">
                          Architectural discipline, contractor specialty, or trade profession.
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-[#374151] mb-1">
                          2. Location / Corridor / City *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sindhu Bhavan Road, Ahmedabad or GIFT City"
                          value={discoveryForm.location}
                          onChange={(e) => setDiscoveryForm({ ...discoveryForm, location: e.target.value })}
                          className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000] bg-white text-xs"
                        />
                        <span className="text-[10px] text-[#6B7280] mt-1 block">
                          Commercial area, road, or city submarket.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Common Options: Target Volume & Audit Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Target Volume (Leads)</label>
                      <select
                        value={discoveryForm.targetCount}
                        onChange={(e) => setDiscoveryForm({ ...discoveryForm, targetCount: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D1D5DB] rounded-md focus:ring-1 focus:ring-[#000000] bg-white font-medium text-xs"
                      >
                        <option value={15}>15 Leads (Quick Corridor · ~25 sec)</option>
                        <option value={30}>30 Leads (Standard Corridor · ~45 sec)</option>
                        <option value={50}>50 Leads (Deep Corridor · ~75 sec)</option>
                        <option value={100}>100 Leads (Multi-Corridor Sweep · ~2.5 min)</option>
                        <option value={200}>200 Leads (Full Gujarat Sweep · ~4.5 min)</option>
                        <option value={500}>500 Leads (Maximum Archive Sweep)</option>
                      </select>
                    </div>

                    <div className="bg-[#F9FAFB] p-2.5 rounded-lg border border-[#E5E7EB] flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="runAuditToggle"
                        checked={discoveryForm.runAudit}
                        onChange={(e) => setDiscoveryForm({ ...discoveryForm, runAudit: e.target.checked })}
                        className="mt-0.5 rounded text-[#FF7700] focus:ring-[#FF7700]"
                      />
                      <label htmlFor="runAuditToggle" className="cursor-pointer">
                        <span className="font-semibold text-[#111827] block text-xs">Run Cognitive Portfolio Audit</span>
                        <span className="text-[#6B7280] text-[10px] block mt-0.5 leading-tight">
                          Discovers verified emails & filters out residential decorators.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE TELEMETRY DASHBOARD (Shown during execution or after completion) */}
              {(discoveryRunning || (streamMetrics.stage !== "IDLE" && (streamMetrics.totalSaved > 0 || discoveryLogs.length > 0))) && (
                <div className="space-y-3 pt-1">
                  
                  {/* Active Status & Pause/Cancel Command Bar */}
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-3 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {discoveryRunning && !discoveryPaused ? (
                        <RefreshCw className="w-4 h-4 text-[#FF7700] animate-spin shrink-0" />
                      ) : discoveryPaused ? (
                        <Pause className="w-4 h-4 text-[#D97706] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-[#111827] block truncate text-xs">{currentActivity}</span>
                        {streamMetrics.currentCorridorName && (
                          <span className="text-[#6B7280] text-[10px] block truncate">
                            Corridor: {streamMetrics.currentCorridorName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Live Operator Controls: PAUSE, RESUME, STOP */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {discoveryRunning && !discoveryPaused && (
                        <button
                          type="button"
                          onClick={handlePauseDiscovery}
                          className="px-2.5 py-1.5 bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D] rounded-md font-semibold flex items-center gap-1 text-[11px] shadow-2xs transition"
                          title="Temporarily halt scraping & auditing"
                        >
                          <Pause className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>Pause</span>
                        </button>
                      )}

                      {discoveryRunning && discoveryPaused && (
                        <button
                          type="button"
                          onClick={handleResumeDiscovery}
                          className="px-2.5 py-1.5 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] rounded-md font-semibold flex items-center gap-1 text-[11px] shadow-2xs transition animate-pulse"
                          title="Resume scraping pipeline"
                        >
                          <Play className="w-3.5 h-3.5 text-[#059669]" />
                          <span>Resume</span>
                        </button>
                      )}

                      {discoveryRunning && (
                        <button
                          type="button"
                          onClick={handleCancelDiscovery}
                          className="px-2.5 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] rounded-md font-semibold flex items-center gap-1 text-[11px] shadow-2xs transition"
                          title="Immediately abort discovery and keep scraped leads"
                        >
                          <Square className="w-3 h-3 text-[#DC2626] fill-current" />
                          <span>Stop</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dual Live Progress Bars */}
                  <div className="space-y-2 bg-[#FAFAFA] p-3 rounded-lg border border-[#E5E7EB]">
                    {/* 1. Overall Leads Progress */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-[#374151] mb-1">
                        <span>Lead Extraction Progress</span>
                        <span>
                          {streamMetrics.totalSaved} of {streamMetrics.targetCount} Leads ({Math.min(100, Math.round((streamMetrics.totalSaved / Math.max(1, streamMetrics.targetCount)) * 100))}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF7700] to-[#FFA040] rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.round((streamMetrics.totalSaved / Math.max(1, streamMetrics.targetCount)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 2. Corridor Sweep Progress */}
                    {streamMetrics.totalCorridors > 1 && (
                      <div className="pt-1">
                        <div className="flex justify-between items-center text-[10px] text-[#6B7280] mb-0.5">
                          <span>Corridor Hopping</span>
                          <span>
                            {streamMetrics.corridorIndex} / {streamMetrics.totalCorridors} Corridors
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#000000] rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round((streamMetrics.corridorIndex / Math.max(1, streamMetrics.totalCorridors)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KPI Metric Strip */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-2 rounded-lg">
                      <span className="text-[10px] text-[#6B7280] block font-medium">Saved</span>
                      <span className="text-base font-bold text-[#111827]">{streamMetrics.totalSaved}</span>
                    </div>
                    <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-2 rounded-lg">
                      <span className="text-[10px] text-[#065F46] block font-medium">Tier A+/A</span>
                      <span className="text-base font-bold text-[#059669]">{streamMetrics.qualifiedCount}</span>
                    </div>
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-2 rounded-lg">
                      <span className="text-[10px] text-[#6B7280] block font-medium">Corridors</span>
                      <span className="text-base font-bold text-[#111827]">{streamMetrics.corridorIndex}/{streamMetrics.totalCorridors}</span>
                    </div>
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-2 rounded-lg">
                      <span className="text-[10px] text-[#6B7280] block font-medium">Elapsed</span>
                      <span className="text-base font-bold font-mono text-[#111827]">{formatElapsed(elapsedSeconds)}</span>
                    </div>
                  </div>

                  {/* Active Studio Live Inspector Preview */}
                  {currentStudioPreview && (
                    <div className="bg-[#FFFDF9] border border-[#FED7AA] p-3 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-[#FF7700] animate-pulse" />
                          <span className="text-[10px] uppercase font-bold text-[#9A3412] tracking-wider">Active Studio Inspection</span>
                        </div>
                        {currentStudioPreview.tier && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#000000] text-white">
                            Tier {currentStudioPreview.tier} · {currentStudioPreview.score} pts
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-[#111827]">{currentStudioPreview.name}</h4>
                          <div className="flex items-center gap-3 text-[11px] text-[#4B5563] mt-0.5">
                            {currentStudioPreview.phone && <span>📞 {currentStudioPreview.phone}</span>}
                            {currentStudioPreview.email && <span className="text-[#059669] font-medium">✉ {currentStudioPreview.email}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5] font-semibold shrink-0">
                          {currentStudioPreview.status}
                        </span>
                      </div>

                      {currentStudioPreview.tags && currentStudioPreview.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {currentStudioPreview.tags.map((tag) => (
                            <span key={tag} className="text-[9px] bg-[#F3F4F6] text-[#4B5563] px-1.5 py-0.2 rounded font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real-Time Telemetry Terminal Log */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                      <div className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                        <Terminal className="w-3 h-3 text-[#6B7280]" />
                        <span>Live Execution Console</span>
                      </div>
                      <span>{discoveryLogs.length} events logged</span>
                    </div>

                    <div
                      ref={logsContainerRef}
                      className="bg-[#0F172A] border border-[#1E293B] text-[#E2E8F0] font-mono text-[10px] p-2.5 rounded-lg h-32 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700"
                    >
                      {discoveryLogs.length === 0 ? (
                        <span className="text-slate-500 italic">Awaiting pipeline trigger...</span>
                      ) : (
                        discoveryLogs.map((log) => {
                          let badgeColor = "text-sky-400";
                          if (log.type === "SAVED") badgeColor = "text-emerald-400 font-bold";
                          if (log.type === "AUDIT") badgeColor = "text-amber-400";
                          if (log.type === "EXTRACT") badgeColor = "text-cyan-300";
                          if (log.type === "CORRIDOR") badgeColor = "text-purple-400 font-bold";
                          if (log.type === "SUCCESS") badgeColor = "text-emerald-300 font-bold";
                          if (log.type === "WARN") badgeColor = "text-yellow-400";
                          if (log.type === "ERROR") badgeColor = "text-rose-400 font-bold";

                          return (
                            <div key={log.id} className="leading-tight flex items-start gap-1.5">
                              <span className="text-slate-500 shrink-0">[{log.time}]</span>
                              <span className={`${badgeColor} shrink-0`}>[{log.type}]</span>
                              <span className="text-slate-200 break-all">{log.text}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    if (discoveryRunning) {
                      if (confirm("Discovery is currently running. Stop scraper and close?")) {
                        handleCancelDiscovery();
                        resetDiscoveryState();
                        setShowDiscoveryModal(false);
                      }
                    } else {
                      resetDiscoveryState();
                      setShowDiscoveryModal(false);
                    }
                  }}
                  className="btn-secondary px-4 py-2 border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6] rounded-md font-semibold text-xs"
                >
                  {discoveryRunning ? "Cancel & Close" : "Close"}
                </button>

                <div className="flex items-center gap-2">
                  {!discoveryRunning && (
                    <button
                      type="button"
                      onClick={handleRunDiscovery}
                      className="btn-primary px-5 py-2 bg-[#FF7700] hover:bg-[#E06900] text-white rounded-md font-semibold flex items-center gap-2 shadow-xs text-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Scraping Pipeline</span>
                    </button>
                  )}

                  {discoveryRunning && !discoveryPaused && (
                    <button
                      type="button"
                      onClick={handlePauseDiscovery}
                      className="px-4 py-2 bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D] rounded-md font-semibold flex items-center gap-1.5 text-xs shadow-xs"
                    >
                      <Pause className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Pause Scraper</span>
                    </button>
                  )}

                  {discoveryRunning && discoveryPaused && (
                    <button
                      type="button"
                      onClick={handleResumeDiscovery}
                      className="px-4 py-2 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] rounded-md font-semibold flex items-center gap-1.5 text-xs shadow-xs animate-pulse"
                    >
                      <Play className="w-3.5 h-3.5 text-[#059669]" />
                      <span>Resume Scraper</span>
                    </button>
                  )}

                  {discoveryRunning && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleCancelDiscovery();
                        resetDiscoveryState();
                        setShowDiscoveryModal(false);
                      }}
                      className="px-4 py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] rounded-md font-semibold flex items-center gap-1.5 text-xs shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5 text-[#DC2626] fill-current" />
                      <span>Stop & Save</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Rejected Leads Viewer & Restoration */}
      {showRejectedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-0 sm:my-6 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#FEF2F2]">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-5 h-5 text-[#DC2626]" />
                <div>
                  <h3 className="font-bold text-sm text-[#991B1B]">
                    Rejected Leads Repository ({rejectedLeads.length})
                  </h3>
                  <p className="text-[11px] text-[#7F1D1D]">
                    Disqualified inquiries (residential kitchens/wardrobes, competitors, or non-decision makers).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRejectedModal(false)}
                className="text-[#991B1B] hover:text-[#111827] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["ALL", "RESIDENTIAL_MISMATCH", "COMPETITOR", "NON_DECISION_MAKER", "SPAM"].map((rf) => (
                  <button
                    key={rf}
                    onClick={() => setRejectedReasonFilter(rf)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition ${
                      rejectedReasonFilter === rf
                        ? "bg-[#111827] text-white border-[#111827]"
                        : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    {rf.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#6B7280]">
                Showing {rejectedLeads.filter((r) => rejectedReasonFilter === "ALL" || r.rejectionReason === rejectedReasonFilter).length} leads
              </span>
            </div>

            {/* Table / List */}
            <div className="max-h-[480px] overflow-y-auto divide-y divide-[#E5E7EB]">
              {loadingRejected ? (
                <div className="p-12 text-center text-xs text-[#6B7280]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#6B7280]" />
                  <p className="mt-2">Loading rejected leads...</p>
                </div>
              ) : rejectedLeads.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#6B7280]">
                  Zero rejected leads found in database.
                </div>
              ) : (
                rejectedLeads
                  .filter((r) => rejectedReasonFilter === "ALL" || r.rejectionReason === rejectedReasonFilter)
                  .map((rej) => (
                    <div key={rej.id} className="p-4 hover:bg-[#F9FAFB] transition flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#111827] text-xs">
                            {rej.businessName}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                            {rej.rejectionReason.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-[#6B7280] border border-[#E5E7EB]">
                            {rej.leadSource}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#4B5563] flex items-center gap-2 flex-wrap">
                          {rej.contactPerson && <span>Contact: {rej.contactPerson}</span>}
                          {rej.phone && <span>· Phone: {rej.phone}</span>}
                          {rej.city && <span>· City: {rej.city}</span>}
                        </div>
                        {rej.notes && (
                          <p className="text-[11px] text-[#6B7280] bg-[#F3F4F6] p-2 rounded-md">
                            {rej.notes}
                          </p>
                        )}
                        <span className="text-[10px] text-[#9CA3AF] block">
                          Disqualified on {new Date(rej.rejectedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRestoreRejected(rej.id)}
                        disabled={restoringRejectedId === rej.id}
                        className="btn-secondary text-[11px] px-3 py-1.5 rounded-md font-semibold text-[#1D4ED8] border-[#BFDBFE] hover:bg-[#EFF6FF] transition shrink-0 flex items-center gap-1"
                        title="Restore this lead to active inbound pipeline"
                      >
                        {restoringRejectedId === rej.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Restore</span>
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end">
              <button
                onClick={() => setShowRejectedModal(false)}
                className="btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 1-Click CSV Lead Importer */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-0 sm:my-6 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-[#FF7700]" />
                <div>
                  <h3 className="font-bold text-sm text-[#111827]">Import Leads from CSV</h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Upload Meta Ads Manager exports, Google Ads Lead Form downloads, or custom spreadsheets.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Channel Attribution Selector */}
              <div>
                <label className="block font-semibold text-[#374151] mb-1.5">
                  Acquisition Channel Attribution *
                </label>
                <select
                  value={importChannel}
                  onChange={(e) => {
                    setImportChannel(e.target.value);
                    if (importPreview.length > 0) {
                      setImportPreview((prev) =>
                        prev.map((l) => ({ ...l, leadSource: e.target.value }))
                      );
                    }
                  }}
                  className="w-full text-xs border border-[#D1D5DB] rounded-lg px-3 py-2 bg-white text-[#111827] font-medium focus:ring-1 focus:ring-[#000000]"
                >
                  <option value="paid_ads_meta">Meta Ads (Facebook & Instagram Lead Forms)</option>
                  <option value="paid_ads_google">Google Ads (Lead Form Assets & Search)</option>
                  <option value="website_form">Company Website (Direct Inbound)</option>
                  <option value="google_maps">Outbound Scraper / Directory List</option>
                  <option value="linkedin_signal">LinkedIn Specifiers / Office Moves</option>
                  <option value="trade_referral">Trade Referral / OEM Channel</option>
                </select>
              </div>

              {/* File Upload Box */}
              <div>
                <label className="block font-semibold text-[#374151] mb-1.5">
                  Select CSV File *
                </label>
                <div className="border-2 border-dashed border-[#D1D5DB] hover:border-[#9CA3AF] rounded-xl p-5 text-center transition bg-[#F9FAFB]">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    id="csv-file-input"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                    <FileText className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                    <div>
                      {importFile ? (
                        <p className="font-bold text-[#111827]">
                          {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                        </p>
                      ) : (
                        <p className="font-semibold text-[#111827]">
                          Click to browse or drop your CSV export here
                        </p>
                      )}
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        Supports auto-mapping for Meta Lead Ads, Google Ads, and custom columns.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Parse Errors Notification */}
              {importParseErrors.length > 0 && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 text-[11px] text-[#991B1B] space-y-0.5">
                  <span className="font-bold">Notices:</span>
                  {importParseErrors.slice(0, 3).map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                  {importParseErrors.length > 3 && (
                    <p>• ...and {importParseErrors.length - 3} more rows</p>
                  )}
                </div>
              )}

              {/* Extracted Leads Preview Table */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#374151]">
                    <span>Extracted Preview ({importPreview.length} total leads detected)</span>
                    <span className="text-[#6B7280]">Showing first 4 rows</span>
                  </div>
                  <div className="border border-[#E5E7EB] rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#F9FAFB] text-[#4B5563] border-b border-[#E5E7EB] uppercase tracking-wider text-[9px] font-bold">
                        <tr>
                          <th className="p-2">Company / Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">City</th>
                          <th className="p-2">Scope / Seats</th>
                          <th className="p-2">Campaign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {importPreview.slice(0, 4).map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#F9FAFB]">
                            <td className="p-2 font-medium text-[#111827]">{row.businessName}</td>
                            <td className="p-2 font-mono text-[#374151]">{row.phone}</td>
                            <td className="p-2 text-[#6B7280]">{row.email || "None"}</td>
                            <td className="p-2 text-[#374151]">{row.city}</td>
                            <td className="p-2 text-[#4B5563]">
                              {row.workstationCount ? `${row.workstationCount} Seats` : row.projectType}
                            </td>
                            <td className="p-2 text-[#6B7280] truncate max-w-[120px]">
                              {row.campaignName || "Default"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Results Banner */}
              {importResult && (
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#065F46] text-xs">
                    <Check className="w-4 h-4 text-[#059669]" />
                    <span>Import Completed Successfully</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-[#A7F3D0]">
                      <span className="text-[#065F46] block font-bold text-sm">
                        {importResult.importedCount}
                      </span>
                      <span className="text-[#047857]">New Leads</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-[#A7F3D0]">
                      <span className="text-[#1D4ED8] block font-bold text-sm">
                        {importResult.duplicateCount}
                      </span>
                      <span className="text-[#1E40AF]">Deduplicated</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-[#A7F3D0]">
                      <span className="text-[#D97706] block font-bold text-sm">
                        {importResult.dummyCount}
                      </span>
                      <span className="text-[#B45309]">Dummy Phones</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-[#A7F3D0]">
                      <span className="text-[#DC2626] block font-bold text-sm">
                        {importResult.rejectedCount}
                      </span>
                      <span className="text-[#991B1B]">Rejected</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="btn-secondary px-4 py-1.5 text-xs"
              >
                {importResult ? "Done" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleExecuteCsvImport}
                disabled={!importFile || importing || importPreview.length === 0}
                className="btn-primary text-xs px-4 py-1.5 bg-[#FF7700] hover:bg-[#E06900] text-white font-semibold rounded-md flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing CSV...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import {importPreview.length > 0 ? `${importPreview.length} Leads` : ""}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Lead Confirmation Dialog */}
      {showRejectConfirmModal && rejectingLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#FEF2F2]">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-5 h-5 text-[#DC2626]" />
                <div>
                  <h3 className="font-bold text-sm text-[#991B1B]">Disqualify & Reject Lead</h3>
                  <p className="text-[11px] text-[#7F1D1D]">
                    Move to Rejected Leads repository and remove from active pipeline.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRejectConfirmModal(false);
                  setRejectingLead(null);
                }}
                className="text-[#991B1B] hover:text-[#111827] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider">Candidate</span>
                <p className="font-bold text-sm text-[#111827]">{rejectingLead.businessName}</p>
                <div className="text-[11px] text-[#4B5563] flex items-center gap-2 flex-wrap">
                  {rejectingLead.contactPerson && <span>Contact: {rejectingLead.contactPerson}</span>}
                  {rejectingLead.phone && <span>· Phone: {rejectingLead.phone}</span>}
                  {rejectingLead.city && <span>· City: {rejectingLead.city}</span>}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1.5">
                  Disqualification Reason *
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg bg-white text-[#111827] text-xs font-medium focus:ring-1 focus:ring-[#DC2626]"
                >
                  <option value="RESIDENTIAL_MISMATCH">Residential Only (Wardrobes, Kitchens, 3BHKs)</option>
                  <option value="COMPETITOR">OEM Competitor or Modular Factory</option>
                  <option value="NON_DECISION_MAKER">Non-Decision Maker (Student, Vendor, Job Seeker)</option>
                  <option value="SPAM">Spam, Invalid Number, or Telemarketer</option>
                  <option value="OTHER">Other Specification Mismatch</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#374151] mb-1.5">
                  Disqualification Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="e.g. Architect explicitly confirmed they only handle residential villas and bungalows; no commercial turnkey."
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-xs focus:ring-1 focus:ring-[#DC2626] resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowRejectConfirmModal(false);
                  setRejectingLead(null);
                }}
                className="btn-secondary px-4 py-1.5 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRejectLead}
                disabled={submittingReject}
                className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-md shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingReject ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disqualifying...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
