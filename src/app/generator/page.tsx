"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Globe,
  Star,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  Building2,
  ExternalLink,
  ChevronRight,
  Database,
  ShieldCheck,
  Cpu,
  Layers,
  Sliders,
  Send,
  MessageSquare,
} from "lucide-react";

interface DiscoveredLead {
  id: string;
  businessName: string;
  category: string;
  city: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  totalScore?: number;
  leadTier?: string;
  tags?: string[];
  status?: string;
}

interface StreamEvent {
  type: string;
  message: string;
  timestamp: string;
  data?: any;
  leadTier?: string;
  totalScore?: number;
  businessName?: string;
  phone?: string;
}

export default function LeadGeneratorDesktopPage() {
  const [industryQuery, setIndustryQuery] = useState("Commercial Architects & Interior Designers");
  const [locationQuery, setLocationQuery] = useState("Sindhu Bhavan Road, Ahmedabad");
  const [targetCount, setTargetCount] = useState(15);
  const [runAudit, setRunAudit] = useState(true);
  const [headless, setHeadless] = useState(true);

  // Runtime State
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logs, setLogs] = useState<Array<{ id: string; time: string; text: string; type: string }>>([]);
  const [leads, setLeads] = useState<DiscoveredLead[]>([]);
  const [stats, setStats] = useState({
    totalFound: 0,
    withPhone: 0,
    withEmail: 0,
    qualifiedTierA: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Load existing database candidates on mount so the list reflects current database state
  const loadDatabaseLeads = async () => {
    try {
      const res = await fetch("/api/candidates?dummy=false");
      const data = await res.json();
      if (data.candidates && Array.isArray(data.candidates)) {
        const loaded: DiscoveredLead[] = data.candidates.map((c: any) => {
          let tags: string[] = [];
          if (c.portfolioTags) {
            if (Array.isArray(c.portfolioTags)) {
              tags = c.portfolioTags;
            } else if (typeof c.portfolioTags === "string") {
              try {
                const parsed = JSON.parse(c.portfolioTags);
                tags = Array.isArray(parsed) ? parsed : [c.portfolioTags];
              } catch {
                tags = [c.portfolioTags];
              }
            }
          }
          return {
            id: c.id,
            businessName: c.businessName,
            category: c.category || "Commercial Specifier",
            city: c.city || "Ahmedabad",
            phone: c.phone,
            email: c.email,
            website: c.website,
            rating: c.rating ? parseFloat(c.rating) : undefined,
            reviewCount: c.reviewCount,
            totalScore: c.totalScore,
            leadTier: c.leadTier || "A",
            tags,
            status: c.qualificationStage || c.status || "NEW",
          };
        });
        setLeads(loaded);
        setStats({
          totalFound: loaded.length,
          withPhone: loaded.filter((l) => l.phone && l.phone !== "-" && l.phone !== "–").length,
          withEmail: loaded.filter((l) => Boolean(l.email)).length,
          qualifiedTierA: loaded.filter((l) => l.leadTier === "A+" || l.leadTier === "A").length,
        });
      }
    } catch (err) {
      console.error("Error loading database leads in generator GUI:", err);
    }
  };

  useEffect(() => {
    loadDatabaseLeads();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (text: string, type: "INFO" | "MAPS" | "AUDIT" | "SAVED" | "WARN" | "SUCCESS" = "INFO") => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLogs((prev) => [...prev.slice(-150), { id: `${Date.now()}_${Math.random()}`, time, text, type }]);
  };

  const handleStart = async () => {
    setIsRunning(true);
    setElapsedSeconds(0);
    setLogs([]);

    const newSessionId = `dsc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setSessionId(newSessionId);

    const activeIndustry = industryQuery.trim() || "Commercial Architects & Interior Designers";
    const activeLocation = locationQuery.trim() || "Ahmedabad";

    addLog(`Initializing Tier 1 Native Lead Generator session: ${newSessionId}`, "INFO");
    addLog(`Specifier Query: ${activeIndustry}`, "INFO");
    addLog(`Location Target: ${activeLocation}`, "INFO");
    addLog(`Target Leads: ${targetCount} | Browser Headless: ${headless}`, "INFO");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/discovery/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: activeIndustry,
          location: activeLocation,
          targetCount,
          runAudit,
          headless,
          multiCorridor: false,
          sessionId: newSessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Engine stream returned HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream reader not available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: any = JSON.parse(line.replace("data: ", "").trim());

            switch (event.type) {
              case "session_init":
                addLog(`Native Playwright Chromium engine initialized on Windows`, "SUCCESS");
                break;

              case "corridor_start":
                addLog(`>>> Scanning corridor: ${event.corridorName || event.data?.corridorName || event.message}`, "MAPS");
                break;

              case "map_search_start":
                addLog(`Querying Google Maps live feed with human jitter...`, "MAPS");
                break;

              case "place_found":
                const pTitle = event.data?.title || event.title || "Specifier Studio";
                const pPhone = event.data?.phone || event.phone;
                addLog(`[Maps Place] ${pTitle} (${pPhone || "Phone lookup underway"})`, "MAPS");
                break;

              case "audit_start":
                addLog(`Auditing website portfolio: ${event.data?.studio || event.studio}`, "AUDIT");
                break;

              case "audit_complete":
                addLog(`Audit finished for ${event.data?.studio || event.studio} (${event.data?.email || event.email || "No direct email"})`, "AUDIT");
                break;

              case "lead_saved":
              case "saved_candidate": {
                const sName = event.businessName || event.data?.businessName || "Architect Studio";
                const sPhone = event.phone || event.data?.phone;
                const sEmail = event.email || event.data?.email;
                const sTier = event.leadTier || event.data?.leadTier || "A";
                const sScore = event.totalScore || event.data?.totalScore || 75;
                const sCategory = event.category || event.data?.category || "Commercial Specifier";
                const sCandidateId = event.candidateId || event.data?.candidateId || `cand_${Date.now()}`;
                const sWebsite = event.website || event.data?.website;
                const sTags = event.tags || event.data?.tags;

                addLog(`SAVED: ${sName} | Score: ${sScore} (${sTier}) | Phone: ${sPhone || "None"}`, "SAVED");

                const newLeadItem: DiscoveredLead = {
                  id: sCandidateId,
                  businessName: sName,
                  category: sCategory,
                  city: event.city || "Ahmedabad",
                  phone: sPhone,
                  email: sEmail,
                  website: sWebsite,
                  rating: event.rating,
                  reviewCount: event.reviewCount,
                  totalScore: sScore,
                  leadTier: sTier,
                  tags: sTags,
                  status: "NEW",
                };

                setLeads((prev) => {
                  const filtered = prev.filter((p) => p.businessName !== sName);
                  return [newLeadItem, ...filtered];
                });

                setStats((prev) => ({
                  totalFound: prev.totalFound + 1,
                  withPhone: prev.withPhone + (sPhone && sPhone !== "-" && sPhone !== "–" ? 1 : 0),
                  withEmail: prev.withEmail + (sEmail ? 1 : 0),
                  qualifiedTierA: prev.qualifiedTierA + (sTier === "A+" || sTier === "A" ? 1 : 0),
                }));
                break;
              }

              case "lead_enriched":
              case "enriched_candidate": {
                const enrichedName = event.businessName || event.data?.businessName;
                const enrichedPhone = event.phone || event.data?.phone;
                addLog(`[ENRICHED] Verified phone number ${enrichedPhone || ""} updated for ${enrichedName}`, "SUCCESS");

                if (enrichedName && enrichedPhone) {
                  setLeads((prev) =>
                    prev.map((l) => (l.businessName === enrichedName ? { ...l, phone: enrichedPhone } : l))
                  );
                  setStats((prev) => ({
                    ...prev,
                    withPhone: prev.withPhone + 1,
                  }));
                }
                break;
              }

              case "lead_incomplete":
                addLog(event.message || `No phone found for ${event.businessName || "studio"}`, "WARN");
                break;

              case "complete":
                addLog(`SUCCESS: Lead generation complete. All leads pushed to cloud database.`, "SUCCESS");
                setIsRunning(false);
                loadDatabaseLeads();
                break;

              case "cancelled":
                addLog(`Run stopped by operator. Generated leads saved safely.`, "WARN");
                setIsRunning(false);
                loadDatabaseLeads();
                break;

              default:
                if (event.message) addLog(event.message, "INFO");
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        addLog("Run canceled by operator.", "WARN");
      } else {
        addLog(`Error during execution: ${err.message}`, "WARN");
      }
    } finally {
      setIsRunning(false);
      loadDatabaseLeads();
    }
  };

  const handleStop = async () => {
    if (sessionId) {
      try {
        await fetch("/api/discovery/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "CANCEL" }),
        });
      } catch (_) {}
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex flex-col antialiased">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40 px-5 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#000000] flex items-center justify-center font-bold text-white text-base shadow-xs">
              <span className="text-[#FF7700]">D'</span>F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-tight text-[#111827]">
                  D'furn Lead Generator
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FF7700] text-white">
                  Tier 1 Desktop GUI
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#DCFCE7] text-[#166534]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                  Mumbai Cloud DB Active
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                Native Windows Google Maps Scraper with Residential Broadband Privileges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://dfurn-lead-engine.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] hover:border-[#111827] bg-white text-xs font-semibold text-[#374151] hover:text-[#111827] transition shadow-2xs"
            >
              <span>Sales Rep Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#6B7280]" />
            </a>

            <div className="flex items-center gap-2 pl-2 border-l border-[#E5E7EB]">
              <span className="text-[11px] font-mono text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded">
                ⏱ {formatTimer(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Generator Controls (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-xs space-y-5">
            {/* 1. Specifier / Trade Query */}
            <div>
              <label className="block font-bold text-sm text-[#111827] mb-1.5 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#FF7700]" />
                <span>1. Specifier Profession / Trade Query *</span>
              </label>
              <input
                type="text"
                disabled={isRunning}
                value={industryQuery}
                onChange={(e) => setIndustryQuery(e.target.value)}
                placeholder="e.g. Commercial Architects or Turnkey Fitout Contractors"
                className="w-full px-3.5 py-2.5 text-xs border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#000000] bg-white font-medium shadow-2xs"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-[#6B7280]">Suggestions:</span>
                {[
                  "Commercial Architects",
                  "Turnkey Fitout Contractors",
                  "Corporate Interior Designers",
                  "Coworking Space Builders",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setIndustryQuery(s)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] transition"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Location / Corridor / City Query */}
            <div>
              <label className="block font-bold text-sm text-[#111827] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FF7700]" />
                <span>2. Location, Road or City Micro-Market *</span>
              </label>
              <input
                type="text"
                disabled={isRunning}
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="e.g. Sindhu Bhavan Road, Ahmedabad or GIFT City"
                className="w-full px-3.5 py-2.5 text-xs border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#000000] bg-white font-medium shadow-2xs"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-[#6B7280]">Suggestions:</span>
                {[
                  "Sindhu Bhavan Road, Ahmedabad",
                  "Prahlad Nagar, Ahmedabad",
                  "GIFT City, Gandhinagar",
                  "CG Road, Ahmedabad",
                  "Surat Diamond Bourse",
                  "Alkapuri, Vadodara",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setLocationQuery(c)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] transition"
                  >
                    + {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Volume */}
            <div>
              <h2 className="font-bold text-sm text-[#111827] mb-2">3. Target Lead Volume</h2>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 25, 50].map((num) => {
                  const isSelected = targetCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setTargetCount(num)}
                      className={`py-2 rounded-lg border text-center font-bold text-xs transition ${
                        isSelected
                          ? "border-[#000000] bg-[#000000] text-white shadow-2xs"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] text-[#374151]"
                      } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {num} Leads
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="pt-2 border-t border-[#F3F4F6] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#374151]">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  checked={runAudit}
                  onChange={(e) => setRunAudit(e.target.checked)}
                  className="rounded text-[#FF7700] focus:ring-[#FF7700] w-4 h-4"
                />
                <span className="font-medium">Run Portfolio Website Audit (Extract emails & commercial tags)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#374151]">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  checked={!headless}
                  onChange={(e) => setHeadless(!e.target.checked)}
                  className="rounded text-[#FF7700] focus:ring-[#FF7700] w-4 h-4"
                />
                <span className="font-medium">Visible Browser Window (Watch Edge navigate on screen)</span>
              </label>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full py-3.5 px-4 bg-[#FF7700] hover:bg-[#E06900] active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Lead Generator</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Save Extracted Leads</span>
                </button>
              )}
            </div>

            {/* Security & Engine Specs Banner */}
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-[11px] text-[#4B5563] space-y-1 leading-snug">
              <div className="font-bold text-[#111827] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Stealth Residential Safeguards Active</span>
              </div>
              <p>
                Uses your office broadband IP, authentic user agent, and human-like jitter. Google Maps never blocks this traffic.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Live Telemetry & Candidates (7 cols) */}
        <section className="lg:col-span-7 space-y-4 flex flex-col">
          {/* Top Scorecard Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <div className="text-[11px] text-[#6B7280] font-medium">Leads Found</div>
              <div className="text-xl font-bold text-[#111827] mt-0.5">{stats.totalFound}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <div className="text-[11px] text-[#166534] font-medium flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#16A34A]" />
                <span>Verified Phones</span>
              </div>
              <div className="text-xl font-bold text-[#16A34A] mt-0.5">
                {stats.withPhone}
                <span className="text-xs text-[#6B7280] font-normal ml-1">
                  ({stats.totalFound > 0 ? Math.round((stats.withPhone / stats.totalFound) * 100) : 100}%)
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <div className="text-[11px] text-[#6B7280] font-medium flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2563EB]" />
                <span>Direct Emails</span>
              </div>
              <div className="text-xl font-bold text-[#111827] mt-0.5">{stats.withEmail}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <div className="text-[11px] text-[#C2410C] font-medium">Tier A+ / A Fit</div>
              <div className="text-xl font-bold text-[#C2410C] mt-0.5">{stats.qualifiedTierA}</div>
            </div>
          </div>

          {/* Real-Time Terminal Activity Logs */}
          <div className="bg-[#111827] text-white rounded-xl p-3.5 font-mono text-xs shadow-xs h-44 flex flex-col border border-[#374151]">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151] mb-2 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span>Real-Time Engine Console</span>
              </div>
              <span className="text-[10px] text-[#6B7280]">
                {isRunning ? "Scraping & Scoring Active" : "Engine Ready"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-[11px] leading-relaxed pr-1 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-[#6B7280] italic">
                  No active session. Select your persona and click "Start Lead Generator" to launch.
                </div>
              ) : (
                logs.map((log) => {
                  let colorClass = "text-[#D1D5DB]";
                  if (log.type === "MAPS") colorClass = "text-[#38BDF8]";
                  if (log.type === "AUDIT") colorClass = "text-[#FCD34D]";
                  if (log.type === "SAVED") colorClass = "text-[#4ADE80]";
                  if (log.type === "SUCCESS") colorClass = "text-[#34D399] font-bold";
                  if (log.type === "WARN") colorClass = "text-[#F87171]";

                  return (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-[#6B7280] shrink-0">[{log.time}]</span>
                      <span className={colorClass}>{log.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Discovered Leads Stream */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs flex-1 flex flex-col overflow-hidden min-h-[340px]">
            <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
              <h3 className="font-bold text-xs text-[#111827] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#FF7700]" />
                <span>Live Candidate Stream ({leads.length})</span>
              </h3>
              <span className="text-[11px] text-[#6B7280]">
                Pushed to Supabase Mumbai cluster in real time
              </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto space-y-2.5">
              {leads.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-[#9CA3AF]">
                  <Building2 className="w-10 h-10 mb-2 stroke-[1.2] text-[#D1D5DB]" />
                  <p className="font-medium text-xs text-[#4B5563]">No leads generated in this session yet</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    Click "Start Lead Generator" to scrape Google Maps and live architectural portfolios.
                  </p>
                </div>
              ) : (
                leads.map((lead) => {
                  return (
                    <div
                      key={lead.id}
                      className="p-3.5 rounded-lg border border-[#E5E7EB] hover:border-[#D1D5DB] bg-white transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#111827]">{lead.businessName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F3F4F6] text-[#374151]">
                            {lead.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8]">
                            Score {lead.totalScore} ({lead.leadTier})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#4B5563] flex-wrap">
                          {lead.phone && lead.phone !== "-" && lead.phone !== "–" ? (
                            <span className="font-semibold text-[#166534] flex items-center gap-1 bg-[#DCFCE7] px-2 py-0.5 rounded">
                              <Phone className="w-3 h-3 text-[#16A34A]" />
                              {lead.phone}
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF] italic">No phone on Maps</span>
                          )}

                          {lead.email && (
                            <span className="text-[#2563EB] flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </span>
                          )}

                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#6B7280] hover:text-[#111827] flex items-center gap-1 underline"
                            >
                              <Globe className="w-3 h-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.phone && lead.phone !== "-" && (
                          <a
                            href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                            className="p-1.5 rounded-md border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] transition"
                            title="Call Phone Number"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#16A34A]" />
                          </a>
                        )}

                        {lead.phone && lead.phone !== "-" && (
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] transition"
                            title="Open WhatsApp Web"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
