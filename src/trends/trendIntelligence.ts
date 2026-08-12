import { TrendAnalysis, TrendAnalysisSchema } from "../domain";

const TREND_TTL_HOURS = 24;

export function analyzeTrends(topic: string, previousObservations: string[] = []): TrendAnalysis {
  const now = new Date();
  const expires = new Date(now.getTime() + TREND_TTL_HOURS * 60 * 60 * 1000);
  const words = topic.toLowerCase();
  const observations = [
    "Use an original structure based on broad short-form patterns, not copied creator assets.",
    "Open with a clear visual or spoken hook in the first moments.",
    "Keep cuts intentional and match visuals to the narration.",
    "Use readable mobile subtitles with safe margins.",
    ...previousObservations.slice(0, 3)
  ];
  const recommendedFormats = words.includes("reading") || words.includes("study")
    ? ["cozy narrative montage", "calm first-person voice-over", "minimal subtitle style"]
    : words.includes("coding")
      ? ["problem-to-solution micro story", "screen/detail alternation", "concise technical hook"]
      : ["short narrative arc", "topic-matched montage", "clear closing question"];
  return TrendAnalysisSchema.parse({
    topic,
    researchedAt: now.toISOString(),
    sources: [{ type: "local_cache", label: "Local strategy and previous account observations" }],
    observations,
    recommendedFormats,
    confidence: previousObservations.length > 0 ? 0.64 : 0.42,
    expirationTime: expires.toISOString()
  });
}
