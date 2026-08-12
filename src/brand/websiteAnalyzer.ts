import { BrandProfile, BrandProfileSchema } from "../domain";
import { assertSafePublicUrl, assertSameOrigin } from "../security/urlSafety";

export interface WebsiteAnalysisOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 1_000_000;

function textBetween(html: string, pattern: RegExp): string | undefined {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim();
}

function allMeta(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return textBetween(html, new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"));
}

function extractColors(html: string): string[] {
  const colors = new Set<string>();
  for (const match of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) colors.add(match[0].toLowerCase());
  return [...colors].slice(0, 8);
}

function extractLogo(html: string, base: URL): string | undefined {
  const href = textBetween(html, /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!href) return undefined;
  return new URL(href, base).toString();
}

function inferCategories(html: string): string[] {
  const source = html.toLowerCase();
  const candidates = ["products", "services", "articles", "blog", "pricing", "tutorials", "features", "case studies", "about"];
  return candidates.filter((item) => source.includes(item)).slice(0, 6);
}

async function fetchLimited(url: URL, options: Required<WebsiteAnalysisOptions>): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "AutonomousSocialAgent/0.1 (+responsible-crawler)" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response did not include a location.");
      const next = new URL(location, url);
      await assertSafePublicUrl(next.toString());
      assertSameOrigin(url, next);
      return fetchLimited(next, options);
    }
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > options.maxBytes) throw new Error("Website response exceeded size limit.");
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeWebsite(inputUrl: string, options: WebsiteAnalysisOptions = {}): Promise<BrandProfile> {
  const url = await assertSafePublicUrl(inputUrl);
  const html = await fetchLimited(url, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES
  });
  const title = textBetween(html, /<title[^>]*>(.*?)<\/title>/is) ?? url.hostname.replace(/^www\./, "");
  const description = allMeta(html, "description") ?? allMeta(html, "og:description") ?? "";
  const brandName = allMeta(html, "og:site_name") ?? title.split(/[|-]/)[0].trim();
  return BrandProfileSchema.parse({
    website: url.toString(),
    brandName,
    description,
    industry: "",
    targetAudience: [],
    languages: [],
    tone: "clear, helpful, brand-safe",
    brandColors: extractColors(html),
    logoUrl: extractLogo(html, url),
    contentCategories: inferCategories(html),
    preferredTopics: [],
    restrictedTopics: [],
    preferredHashtags: [],
    bannedWords: [],
    ctaStyle: "soft call to action",
    postingStyle: "short-form educational and behind-the-scenes posts",
    socialAccounts: {}
  });
}
