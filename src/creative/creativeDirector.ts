import { BrandProfile, CreativeBrief, CreativeBriefSchema, MediaItem, Platform, TrendAnalysis } from "../domain";
import { createVideoConceptProfile } from "./conceptProfile";

export function createCreativeBrief(topic: string, brand: BrandProfile, trend: TrendAnalysis, media: MediaItem[], platforms: Platform[]): CreativeBrief {
  const lowerTopic = topic.toLowerCase();
  const cinematicTopic = /movie|film|scene|cinematic|cinema/.test(lowerTopic);
  const conceptProfile = createVideoConceptProfile(topic);
  const reflectiveTopic = conceptProfile.primaryEmotion === "reflective";
  const noVoice = lowerTopic.includes("no voice");
  const hasVoiceFriendlyTopic = !noVoice;
  const mediaHints = media.flatMap((item) => item.aiTags).slice(0, 6).join(", ") || "available original footage";
  return CreativeBriefSchema.parse({
    topic,
    goal: "engagement",
    concept: `${brand.brandName} shares an original ${topic} moment using ${trend.recommendedFormats[0] ?? "a short narrative format"}.`,
    story: cinematicTopic
      ? `Create a cinematic montage: dramatic opening line, mood-heavy public-domain scenes (${mediaHints}), fast emotional cuts, original narration, and a final quote-style payoff.`
      : `Hook attention, establish the mood, show the most relevant original clips (${mediaHints}), then end with a simple reflective payoff.`,
    hook: cinematicTopic ? "Some moments change the whole story" : reflectiveTopic ? topic.replace(/\b\w/g, (letter) => letter.toUpperCase()) : `This ${topic} moment is worth saving`,
    targetAudience: brand.targetAudience.length ? brand.targetAudience : ["social followers", "website visitors"],
    tone: brand.tone || "clear, warm, brand-safe",
    visualStyle: cinematicTopic ? "cinematic public-domain film montage with dramatic narration and text" : conceptProfile.visualStyle,
    pace: cinematicTopic ? "cinematic" : reflectiveTopic ? "fast" : "medium",
    targetDuration: 30,
    voiceOver: {
      required: hasVoiceFriendlyTopic,
      style: cinematicTopic ? "dramatic original movie-trailer narration" : reflectiveTopic ? "fast natural creator narration" : "concise creator narration",
      emotion: cinematicTopic ? "tense and reflective" : reflectiveTopic ? "reflective" : "confident",
      speed: reflectiveTopic ? "fast" : "normal"
    },
    platforms
  });
}
