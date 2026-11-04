"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Mail,
  CheckCircle2,
  Copy,
  ArrowRight,
  Check,
  RefreshCw,
} from "lucide-react";

interface OutreachItem {
  id: string;
  candidateId: string;
  candidateName: string;
  category: string;
  city: string;
  phone?: string;
  email?: string;
  leadTier: string;
  totalScore: number;
  channel: string;
  subject?: string;
  bodyContent: string;
  approvalStatus: string;
  whatsappAvailable?: boolean;
}

export default function ReviewQueuePage() {
  const [messages, setMessages] = useState<OutreachItem[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>("WHATSAPP");
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/queue");
      const data = await res.json();
      if (data.queue) {
        setMessages(data.queue);
      }
    } catch (err) {
      console.error("Error loading queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMessageEdit = (id: string, newText: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, bodyContent: newText } : m))
    );
  };

  const handleSaveMessage = async (item: OutreachItem) => {
    try {
      setSavingId(item.id);
      await fetch(`/api/candidates/${item.candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_message",
          messageId: item.id,
          bodyContent: item.bodyContent,
        }),
      });
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2500);
    } catch (err) {
      console.error("Error saving draft message:", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleWhatsAppAction = async (item: OutreachItem) => {
    try {
      setActingId(item.id);
      // Mark message approved & sent
      await fetch(`/api/candidates/${item.candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_message",
          messageId: item.id,
          approvalStatus: "sent",
        }),
      });

      // Update candidate stage to CONTACTED & record timestamp
      await fetch(`/api/candidates/${item.candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualificationStage: "CONTACTED",
          markContacted: true,
        }),
      });

      setMessages((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      console.error("Error updating outreach queue status:", err);
    } finally {
      setActingId(null);
    }
  };

  const filteredMessages = messages.filter((m) => m.channel === activeChannel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
          Outreach Queue
        </h1>
        <p className="text-sm text-[#4B5563] mt-1">
          Review and dispatch personalized WhatsApp and email outreach to qualified leads.
        </p>
      </div>

      {/* Channel Tabs (Strictly Black Active State) */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
        <button
          onClick={() => setActiveChannel("WHATSAPP")}
          className={`tab-pill flex items-center gap-2 ${
            activeChannel === "WHATSAPP" ? "active" : ""
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp ({messages.filter((m) => m.channel === "WHATSAPP").length})</span>
        </button>
        <button
          onClick={() => setActiveChannel("EMAIL")}
          className={`tab-pill flex items-center gap-2 ${
            activeChannel === "EMAIL" ? "active" : ""
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email ({messages.filter((m) => m.channel === "EMAIL").length})</span>
        </button>
      </div>

      {/* Queue Stream */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E5E7EB]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#6B7280] mx-auto" />
          <p className="text-sm text-[#6B7280] mt-2">Loading outreach candidates...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E5E7EB] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto" />
          <h3 className="font-semibold text-base text-[#111827]">All Caught Up</h3>
          <p className="text-sm text-[#6B7280] max-w-sm mx-auto">
            Zero pending drafts awaiting approval in this channel.
          </p>
          <div className="pt-2">
            <Link href="/" className="btn-secondary text-xs inline-flex items-center gap-1.5">
              <span>View All Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((item) => {
            const rawPhoneDigits = (item.phone || "").replace(/\D/g, "");
            const waNumber = rawPhoneDigits.length === 10 ? `91${rawPhoneDigits}` : rawPhoneDigits;
            const waUrl = waNumber
              ? `https://web.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(item.bodyContent)}`
              : null;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-xs space-y-4 hover:border-[#D1D5DB] transition"
              >
                {/* Candidate Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/candidates/${item.candidateId}`}
                        className="font-bold text-base text-[#111827] hover:text-[#FF7700] flex items-center gap-1"
                      >
                        {item.candidateName}
                        <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      </Link>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {item.city} {item.phone ? `· ${item.phone}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.leadTier === "A+"
                          ? "badge-tier-aplus"
                          : item.leadTier === "A"
                          ? "badge-tier-a"
                          : item.leadTier === "B"
                          ? "badge-tier-b"
                          : "badge-tier-c"
                      }`}
                    >
                      Tier {item.leadTier} ({item.totalScore}/100)
                    </span>
                  </div>
                </div>

                {/* Editable Message Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span className="font-semibold text-[#374151] flex items-center gap-1.5">
                      <span>Outreach Message Draft (Editable)</span>
                      {savedId === item.id && (
                        <span className="text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
                          Saved ✓
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-mono">{item.bodyContent.length} chars</span>
                  </div>

                  {item.subject ? (
                    <div className="text-xs font-semibold text-[#111827]">
                      Subject: <span className="font-normal text-[#374151]">{item.subject}</span>
                    </div>
                  ) : null}

                  <textarea
                    rows={5}
                    value={item.bodyContent}
                    onChange={(e) => handleMessageEdit(item.id, e.target.value)}
                    onBlur={() => handleSaveMessage(item)}
                    className="w-full p-3.5 rounded-lg bg-[#F9FAFB] border border-[#D1D5DB] focus:bg-white focus:border-[#000000] focus:ring-1 focus:ring-[#000000] text-xs text-[#1F2937] leading-relaxed font-sans transition resize-y"
                    placeholder="Customize your outreach message..."
                  />
                </div>

                {/* Actions Footer: Copy + Save Draft + WhatsApp */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(item.id, item.bodyContent)}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSaveMessage(item)}
                      disabled={savingId === item.id}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-[#374151]"
                      title="Save customized message edits"
                    >
                      {savingId === item.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : savedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#059669]" />
                          <span className="text-[#059669]">Saved</span>
                        </>
                      ) : (
                        <span>Save Draft</span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.channel === "WHATSAPP" && waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleWhatsAppAction(item)}
                        className="bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-xs transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
