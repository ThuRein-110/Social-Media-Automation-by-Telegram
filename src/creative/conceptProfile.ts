import { MediaItem } from "../domain";

export interface VideoConceptProfile {
  title: string;
  coreIdea: string;
  primaryEmotion: string;
  secondaryEmotions: string[];
  visualThemes: string[];
  avoidVisualThemes: string[];
  visualStyle: string;
}

export interface ClipRelevanceScore {
  titleRelevance: number;
  segmentRelevance: number;
  emotionMatch: number;
  visualQuality: number;
  continuityScore: number;
  shotVarietyScore: number;
  rightsScore: number;
  recentUsagePenalty: number;
  finalScore: number;
  reason: string;
}

const reflectiveThemes = ["solitude", "quiet room", "walking alone", "window light", "reading", "thinking", "night", "nature", "slow morning", "personal space"];
const reflectiveAvoid = ["party", "crowded celebration", "sports hype", "loud comedy", "game trailer", "technical demo", "aircraft", "billboard", "virus", "prevention", "public transport", "school", "college"];

export function createVideoConceptProfile(title: string): VideoConceptProfile {
  const lower = title.toLowerCase();
  const alone = /\b(alone|yourself|time|quiet|stuck|tired|reset|slow|reading|think|thinking)\b/.test(lower);
  if (alone) {
    const reading = /\b(reading|book|library)\b/.test(lower);
    return {
      title,
      coreIdea: reading ? "Returning to books can feel like returning to quiet focus." : "Taking intentional quiet time helps the viewer slow down and mentally reset.",
      primaryEmotion: "reflective",
      secondaryEmotions: ["overwhelmed", "calm", "hopeful"],
      visualThemes: reading ? ["book", "reading", "library", "pages", "quiet room", "desk", "window light", "coffee", "solitude", "calm"] : reflectiveThemes,
      avoidVisualThemes: reflectiveAvoid,
      visualStyle: "cinematic reflective short-form reel"
    };
  }
  return {
    title,
    coreIdea: `A focused short-form story about ${title}.`,
    primaryEmotion: "curious",
    secondaryEmotions: ["clear", "useful", "satisfied"],
    visualThemes: ["clear subject", "human moment", "detail shot", "environment", "movement"],
    avoidVisualThemes: ["unrelated topic", "low quality", "watermark", "confusing scene"],
    visualStyle: "clean cinematic social reel"
  };
}

export function meaningForNarrationSegment(text: string, profile: VideoConceptProfile, index: number) {
  const lower = text.toLowerCase();
  const desiredEmotion = index < 2 ? profile.secondaryEmotions[0] ?? profile.primaryEmotion : index < 5 ? profile.primaryEmotion : profile.secondaryEmotions.at(-1) ?? profile.primaryEmotion;
  const shotType = /\b(phone|coffee|book|page|hand|minute)\b/.test(lower)
    ? "DETAIL"
    : /\b(walk|went|outside|somewhere|room)\b/.test(lower)
      ? "WIDE"
      : /\b(realize|felt|needed|forgot)\b/.test(lower)
        ? "REACTION"
        : "MEDIUM";
  const desiredVisual = /\b(phone)\b/.test(lower)
    ? "phone put away, quiet choice"
    : /\b(book|read|page)\b/.test(lower)
      ? "person reading, book pages, quiet room"
      : /\b(coffee)\b/.test(lower)
        ? "coffee, table detail, calm ritual"
        : /\b(tired|focus|noise|fast)\b/.test(lower)
          ? "overwhelmed person slowing down"
          : "solitary reflective cinematic moment";
  return { meaning: text, globalTopic: profile.title, desiredEmotion, desiredVisual, shotType };
}

function wordHits(haystack: string, words: string[]) {
  return words.filter((word) => haystack.includes(word.toLowerCase())).length;
}

function normalizedHits(haystack: string, words: string[]) {
  if (words.length === 0) return 0;
  return Math.min(1, wordHits(haystack, words) / Math.max(2, Math.ceil(words.length / 2)));
}

export function scoreClipForConcept(item: MediaItem, profile: VideoConceptProfile, segmentText: string, index: number): ClipRelevanceScore {
  const haystack = [...item.aiTags, ...item.tags, ...item.topics, item.filename, item.description, item.transcript ?? ""].join(" ").toLowerCase();
  const titleWords = [...profile.visualThemes, ...profile.title.toLowerCase().split(/\W+/)].filter((word) => word.length > 2);
  const segment = meaningForNarrationSegment(segmentText, profile, index);
  const segmentWords = [...segment.desiredVisual.split(/\W+/), ...segment.meaning.toLowerCase().split(/\W+/)].filter((word) => word.length > 2);
  const titleRelevance = normalizedHits(haystack, titleWords);
  const segmentRelevance = normalizedHits(haystack, segmentWords);
  const emotionMatch = profile.visualThemes.some((theme) => haystack.includes(theme.split(" ")[0])) || /\b(public domain|silent|film|reading|alone|quiet|room|person)\b/.test(haystack) ? 0.85 : 0.35;
  const visualQuality = Math.min(1, ((item.quality?.score ?? 6) / 10) + ((item.width ?? 0) >= 720 ? 0.1 : 0));
  const continuityScore = profile.avoidVisualThemes.some((theme) => haystack.includes(theme)) ? 0.1 : 0.82;
  const shotVarietyScore = index % 3 === 0 ? 0.86 : 0.78;
  const rightsScore = /\b(public domain|cc0|cc by|creative commons|wikimedia|reusable)\b/.test(haystack) ? 1 : 0;
  const recentUsagePenalty = Math.min(0.25, item.usedCount * 0.05);
  const finalScore = Number(((titleRelevance * 0.22) + (segmentRelevance * 0.22) + (emotionMatch * 0.18) + (visualQuality * 0.12) + (continuityScore * 0.14) + (shotVarietyScore * 0.06) + (rightsScore * 0.16) - recentUsagePenalty).toFixed(2));
  return {
    titleRelevance,
    segmentRelevance,
    emotionMatch,
    visualQuality,
    continuityScore,
    shotVarietyScore,
    rightsScore,
    recentUsagePenalty,
    finalScore,
    reason: `${segment.shotType}: ${segment.desiredVisual}; score ${finalScore}`
  };
}
