import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeCategory =
  | "mobile-ui" | "supabase-docs" | "troubleshooting" | "android" | "security" | "other";

export interface KnowledgeArticle {
  id?: string;
  title: string;
  category: KnowledgeCategory;
  body: string;
  platform: string;
  source_url?: string | null;
  source_type: "official-docs" | "verified-screenshot" | "user-observation" | "community";
  confidence: "verified" | "likely" | "unverified";
  verified_at?: string | null;
  ui_version?: string | null;
}

const starterArticles: KnowledgeArticle[] = [
  {
    title: "Supabase Dashboard on Android Chrome: responsive UI can differ",
    category: "mobile-ui",
    body: "Use the current Android Chrome viewport as the source of truth. Navigation may be collapsed into a sidebar/menu, labels may be hidden, and the page may change at different viewport widths. Do not claim a button is in a specific location unless supported by a recent screenshot or verified observation. Ask the user what they can currently see if the path is uncertain.",
    platform: "android-chrome",
    source_type: "user-observation",
    confidence: "unverified"
  },
  {
    title: "Find project API settings safely",
    category: "supabase-docs",
    body: "Supabase projects expose API connection information in project settings/API-related sections, but labels and navigation can change. On mobile, open the project first, expand the dashboard navigation if collapsed, then look for project settings and API settings. If the exact label differs, search official Supabase docs or ask the user to share a screenshot with secrets redacted. Never ask the user to publish secret/service-role keys.",
    platform: "android-chrome",
    source_type: "official-docs",
    confidence: "likely",
    source_url: "https://supabase.com/docs"
  },
  {
    title: "Never expose Supabase service role keys",
    category: "security",
    body: "A service_role/secret key bypasses Row Level Security and must remain on a trusted server. Do not put it in Android app code, frontend JavaScript, public GitHub repositories, screenshots, or chat messages. Use a publishable/anon key only where appropriate and protect data with RLS policies.",
    platform: "all",
    source_type: "official-docs",
    confidence: "verified",
    source_url: "https://supabase.com/docs/guides/api/api-keys"
  }
];

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function score(article: KnowledgeArticle, query: string, platform: string): number {
  const q = query.toLowerCase().split(/[^a-z0-9ก-๙_-]+/i).filter(Boolean);
  const text = `${article.title} ${article.body} ${article.category}`.toLowerCase();
  let value = q.reduce((n, token) => n + (text.includes(token) ? 2 : 0), 0);
  if (article.platform === platform) value += 5;
  if (article.platform === "all") value += 1;
  if (article.confidence === "verified") value += 3;
  if (article.confidence === "unverified") value -= 1;
  return value;
}

export async function searchKnowledge(query: string, platform = "android-chrome", limit = 5) {
  const client = getSupabaseClient();
  let articles: KnowledgeArticle[] = starterArticles;

  if (client) {
    const { data, error } = await client
      .from("knowledge_articles")
      .select("id,title,category,body,platform,source_url,source_type,confidence,verified_at,ui_version")
      .limit(100);
    if (!error && data?.length) articles = [...data as KnowledgeArticle[], ...starterArticles];
  }

  return articles
    .map(article => ({ article, score: score(article, query, platform) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ article, score }) => ({ ...article, relevance_score: score }));
}

export async function recordObservation(input: {
  title: string; body: string; page?: string; source_url?: string; ui_version?: string;
}) {
  const client = getSupabaseClient();
  const article: KnowledgeArticle = {
    title: input.title,
    body: `${input.body}${input.page ? `\nPage/section: ${input.page}` : ""}`,
    category: "mobile-ui",
    platform: "android-chrome",
    source_url: input.source_url || null,
    source_type: "user-observation",
    confidence: "unverified",
    ui_version: input.ui_version || "current-unknown"
  };
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { saved: false, article, message: "Not saved: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the trusted server, or add the record through a protected admin workflow." };
  }
  const { data, error } = await client.from("knowledge_articles").insert(article).select("id").single();
  if (error) return { saved: false, article, message: error.message };
  return { saved: true, id: data.id, confidence: "unverified" };
}
