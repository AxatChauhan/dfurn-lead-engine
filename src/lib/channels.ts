export type ParentChannelId =
  | "ALL"
  | "paid_ads_meta"
  | "paid_ads_google"
  | "website_form"
  | "google_maps"
  | "linkedin_signal"
  | "trade_referral";

export interface ParentChannel {
  id: ParentChannelId;
  label: string;
}

export const PARENT_CHANNELS: ParentChannel[] = [
  { id: "ALL", label: "All Channels" },
  { id: "paid_ads_meta", label: "Meta Ads" },
  { id: "paid_ads_google", label: "Google Ads" },
  { id: "website_form", label: "Company Website" },
  { id: "google_maps", label: "Outbound Scraper" },
  { id: "linkedin_signal", label: "LinkedIn Signals" },
  { id: "trade_referral", label: "Trade Referrals" },
];

export type SubChannelCategory =
  | "WHATSAPP_CHAT"
  | "AD_FORM"
  | "SEARCH_QUERY"
  | "ARCHITECT"
  | "CONTRACTOR"
  | "COWORKING"
  | "CANARY_HIRE"
  | "HIRING_SURGE"
  | "TRADE_REFERRAL"
  | "WEB_INBOUND";

export interface SubChannelMeta {
  key: string;
  category: SubChannelCategory;
  label: string;
  parentLabel: string;
  badgeStyle: string;
  dotColor: string;
}

export const SUB_CHANNEL_STYLES: Record<SubChannelCategory, { badgeStyle: string; dotColor: string }> = {
  WHATSAPP_CHAT: {
    badgeStyle: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]",
    dotColor: "#22C55E",
  },
  AD_FORM: {
    badgeStyle: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
    dotColor: "#3B82F6",
  },
  SEARCH_QUERY: {
    badgeStyle: "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]",
    dotColor: "#0EA5E9",
  },
  ARCHITECT: {
    badgeStyle: "bg-[#FAF5FF] text-[#6D28D9] border-[#E9D5FF]",
    dotColor: "#8B5CF6",
  },
  CONTRACTOR: {
    badgeStyle: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    dotColor: "#F59E0B",
  },
  COWORKING: {
    badgeStyle: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
    dotColor: "#6366F1",
  },
  CANARY_HIRE: {
    badgeStyle: "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]",
    dotColor: "#F43F5E",
  },
  HIRING_SURGE: {
    badgeStyle: "bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]",
    dotColor: "#EC4899",
  },
  TRADE_REFERRAL: {
    badgeStyle: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]",
    dotColor: "#14B8A6",
  },
  WEB_INBOUND: {
    badgeStyle: "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]",
    dotColor: "#64748B",
  },
};

export const KNOWN_CHANNELS_MAP: Record<string, string> = {
  paid_ads_meta: "Meta Ads",
  paid_ads_google: "Google Ads",
  website_form: "Website Inbound",
  website: "Website Inbound",
  google_maps: "Outbound Scraper",
  linkedin_signal: "LinkedIn Signals",
  trade_referral: "Trade Referrals",
  click_to_whatsapp: "Click-to-WhatsApp",
  meta_lead_form: "Meta Instant Lead Form",
  google_search_oem: "Google Search (OEM)",
  google_search_form: "Google Ads Lead Form",
  architect_studio: "Architect Studio Scrape",
  turnkey_contractor: "Turnkey Contractor Scrape",
  coworking_expansion: "Coworking Expansion",
  canary_hire: "Facility Canary Hire",
  hiring_surge: "Hiring Surge Signal",
};

/**
 * Resolves a lead's channel & sub-channel metadata based on its source and campaign attributes.
 */
export function resolveSubChannel(lead: {
  leadSource?: string;
  sourceType?: string;
  campaignName?: string | null;
  adsetName?: string | null;
  category?: string | null;
  portfolioTags?: string | null;
}): {
  parentLabel: string;
  subChannel: SubChannelMeta;
  multiTouchSources: string[];
} {
  const source = lead.leadSource || lead.sourceType || "paid_ads_meta";
  const campaign = (lead.campaignName || "").toLowerCase();
  const adset = (lead.adsetName || "").toLowerCase();
  const category = (lead.category || "").toLowerCase();

  // Multi-Touch detection from portfolioTags or secondary source data
  let multiTouchSources: string[] = [];
  if (lead.portfolioTags) {
    try {
      const parsed = typeof lead.portfolioTags === "string" ? JSON.parse(lead.portfolioTags) : (lead.portfolioTags as unknown as string[]);
      if (Array.isArray(parsed) && parsed.length > 1) {
        // Only include if secondary items are recognized acquisition channels
        const candidateSources = parsed.slice(1);
        multiTouchSources = candidateSources
          .filter((tag) => KNOWN_CHANNELS_MAP[tag] !== undefined)
          .map((tag) => KNOWN_CHANNELS_MAP[tag]);
      }
    } catch {
      // not JSON array
    }
  }

  // 1. Meta Ads Sub-Channels
  if (source === "paid_ads_meta") {
    if (campaign.includes("whatsapp") || adset.includes("whatsapp")) {
      return {
        parentLabel: "Meta Ads",
        subChannel: {
          key: "click_to_whatsapp",
          category: "WHATSAPP_CHAT",
          label: "Click-to-WhatsApp",
          parentLabel: "Meta Ads",
          ...SUB_CHANNEL_STYLES.WHATSAPP_CHAT,
        },
        multiTouchSources,
      };
    }
    return {
      parentLabel: "Meta Ads",
      subChannel: {
        key: "meta_lead_form",
        category: "AD_FORM",
        label: "Instant Lead Form",
        parentLabel: "Meta Ads",
        ...SUB_CHANNEL_STYLES.AD_FORM,
      },
      multiTouchSources,
    };
  }

  // 2. Google Ads Sub-Channels
  if (source === "paid_ads_google") {
    if (campaign.includes("search") || adset.includes("search") || campaign.includes("oem")) {
      return {
        parentLabel: "Google Ads",
        subChannel: {
          key: "google_search",
          category: "SEARCH_QUERY",
          label: "Search: OEM Workstations",
          parentLabel: "Google Ads",
          ...SUB_CHANNEL_STYLES.SEARCH_QUERY,
        },
        multiTouchSources,
      };
    }
    return {
      parentLabel: "Google Ads",
      subChannel: {
        key: "google_lead_form",
        category: "AD_FORM",
        label: "Lead Extension Form",
        parentLabel: "Google Ads",
        ...SUB_CHANNEL_STYLES.AD_FORM,
      },
      multiTouchSources,
    };
  }

  // 3. Outbound Scraper Sub-Channels
  if (source === "google_maps") {
    if (category.includes("contractor") || campaign.includes("contractor")) {
      return {
        parentLabel: "Outbound Scraper",
        subChannel: {
          key: "turnkey_contractor",
          category: "CONTRACTOR",
          label: "Turnkey Contractor",
          parentLabel: "Outbound Scraper",
          ...SUB_CHANNEL_STYLES.CONTRACTOR,
        },
        multiTouchSources,
      };
    }
    if (category.includes("coworking") || campaign.includes("coworking")) {
      return {
        parentLabel: "Outbound Scraper",
        subChannel: {
          key: "coworking_hub",
          category: "COWORKING",
          label: "Coworking Space",
          parentLabel: "Outbound Scraper",
          ...SUB_CHANNEL_STYLES.COWORKING,
        },
        multiTouchSources,
      };
    }
    return {
      parentLabel: "Outbound Scraper",
      subChannel: {
        key: "architect_studio",
        category: "ARCHITECT",
        label: "Architect Studio",
        parentLabel: "Outbound Scraper",
        ...SUB_CHANNEL_STYLES.ARCHITECT,
      },
      multiTouchSources,
    };
  }

  // 4. LinkedIn Signals Sub-Channels
  if (source === "linkedin_signal") {
    if (campaign.includes("canary") || adset.includes("canary") || campaign.includes("facility")) {
      return {
        parentLabel: "LinkedIn Signals",
        subChannel: {
          key: "canary_role",
          category: "CANARY_HIRE",
          label: "Canary: Facility Admin",
          parentLabel: "LinkedIn Signals",
          ...SUB_CHANNEL_STYLES.CANARY_HIRE,
        },
        multiTouchSources,
      };
    }
    return {
      parentLabel: "LinkedIn Signals",
      subChannel: {
        key: "hiring_surge",
        category: "HIRING_SURGE",
        label: "Hiring Surge (+25%)",
        parentLabel: "LinkedIn Signals",
        ...SUB_CHANNEL_STYLES.HIRING_SURGE,
      },
      multiTouchSources,
    };
  }

  // 5. Trade Referral Sub-Channels
  if (source === "trade_referral") {
    const partnerType = campaign.includes("it") ? "IT Cabling Partner" : "HVAC Trade Partner";
    return {
      parentLabel: "Trade Referral",
      subChannel: {
        key: "trade_referral",
        category: "TRADE_REFERRAL",
        label: partnerType,
        parentLabel: "Trade Referral",
        ...SUB_CHANNEL_STYLES.TRADE_REFERRAL,
      },
      multiTouchSources,
    };
  }

  // 6. Company Website Inbound
  if (source === "website_form" || source === "website") {
    return {
      parentLabel: "Company Website",
      subChannel: {
        key: "web_inbound",
        category: "WEB_INBOUND",
        label: "Website Contact Form",
        parentLabel: "Company Website",
        ...SUB_CHANNEL_STYLES.WEB_INBOUND,
      },
      multiTouchSources,
    };
  }

  // Fallback Direct / Manual
  return {
    parentLabel: "Direct Inbound",
    subChannel: {
      key: "direct_inquiry",
      category: "WEB_INBOUND",
      label: "Direct Inquiry",
      parentLabel: "Direct Inbound",
      ...SUB_CHANNEL_STYLES.WEB_INBOUND,
    },
    multiTouchSources,
  };
}
