"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  MessageSquare,
  Mail,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  Phone,
  Building2,
  ArrowRight,
  Sparkles,
  Check
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

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/candidates");
      const data = await res.json();

      if (data.candidates) {
        // Collect messages across candidates
        const items: OutreachItem[] = [];
        for (const cand of data.candidates) {
          const detailRes = await fetch(`/api/candidates/${cand.id}`);
          const detail = await detailRes.json();
          if (detail.messages) {
            for (const msg of detail.messages) {
              if (msg.approvalStatus === "draft_pending_review") {
                items.push({
                  id: msg.id,
                  candidateId: cand.id,
                  candidateName: cand.businessName,
                  category: cand.category,
                  city: cand.city,
                  phone: cand.phone,
                  email: cand.email,
                  leadTier: cand.leadTier,
                  totalScore: cand.totalScore,
                  channel: msg.channel,
                  subject: msg.subject,
                  bodyContent: msg.bodyContent,
                  approvalStatus: msg.approvalStatus,
                  whatsappAvailable: cand.whatsappAvailable,
                });
              }
            }
          }
        }
        setMessages(items);
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

  const handleMarkSent = async (item: OutreachItem) => {
    try {
      setActingId(item.id);
      await fetch(`/api/candidates/${item.candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_message",
          messageId: item.id,
          approvalStatus: "sent",
        }),
      });

      // Also update candidate status to CONTACTED
      await fetch(`/api/candidates/${item.candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          status: "CONTACTED",
        }),
      });

      setMessages((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      alert("Error marking message sent");
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
          Human Outreach Review Queue
        </h1>
        <p className="text-sm text-[#4B5563] mt-1">
          Review, approve, and launch personalized WhatsApp & Email conversations. No messages leave automatically.
        </p>
      </div>

      {/* Channel Tabs (Black Active State) */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
        <button
          onClick={() => setActiveChannel("WHATSAPP")}
          className={`tab-pill flex items-center gap-2 ${
            activeChannel === "WHATSAPP" ? "active" : ""
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp Drafts ({messages.filter((m) => m.channel === "WHATSAPP").length})</span>
        </button>
        <button
          onClick={() => setActiveChannel("EMAIL")}
          className={`tab-pill flex items-center gap-2 ${
            activeChannel === "EMAIL" ? "active" : ""
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Pitches ({messages.filter((m) => m.channel === "EMAIL").length})</span>
        </button>
      </div>

      {/* Queue Feed */}
      {loading ? (
        <div className="py-20 text-center text-[#6B7280]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF7700]" />
          Loading approval queue...
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-[#E5E7EB] text-center">
          <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#111827]">Queue Clear</h3>
          <p className="text-sm text-[#6B7280] mt-1">
            All generated drafts for {activeChannel === "WHATSAPP" ? "WhatsApp" : "Email"} have been reviewed and dispatched.
          </p>
          <Link href="/" className="btn-secondary mt-4 text-xs">
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((item) => {
            const phoneDigits = (item.phone || "").replace(/\D/g, "");
            let cleanPhone = phoneDigits;
            if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
            const waUrl = cleanPhone.length >= 10
              ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(item.bodyContent)}`
              : "";

            return (
              <div
                key={item.id}
                className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4"
              >
                {/* Top Row: Firm Meta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
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

                {/* Message Content Preview */}
                <div className="space-y-2">
                  {item.subject ? (
                    <div className="text-xs font-semibold text-[#111827]">
                      Subject: <span className="font-normal text-[#374151]">{item.subject}</span>
                    </div>
                  ) : null}

                  <div className="p-4 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-sm text-[#1F2937] whitespace-pre-line leading-relaxed font-sans">
                    {item.bodyContent}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(item.id, item.bodyContent)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {copiedId === item.id ? (
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
                  </div>

                  <div className="flex items-center gap-2">
                    {item.channel === "WHATSAPP" && waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleMarkSent(item)}
                        className="bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-xs transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Launch WhatsApp Web ↗</span>
                      </a>
                    ) : null}

                    <button
                      onClick={() => handleMarkSent(item)}
                      disabled={actingId === item.id}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {actingId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Mark Sent & Archive</span>
                    </button>
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
