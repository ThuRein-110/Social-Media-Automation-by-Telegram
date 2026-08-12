import { CreativeBrief } from "../domain";

export type PremiumVideoProfileId = "PREMIUM_REEL_V1" | "PREMIUM_FAST_V1" | "PREMIUM_CINEMATIC_V1";

export interface PremiumVideoProfile {
  id: PremiumVideoProfileId;
  resolution: "1080x1920";
  aspectRatio: "9:16";
  fps: 30;
  minDuration: number;
  maxDuration: number;
  voice: "FAST_NATURAL";
  visual: "CINEMATIC_SEMANTIC";
  subtitles: "CINEMATIC_MINIMAL";
  audio: "PREMIUM_MIX";
  color: "SHOT_MATCHED";
  firstCutReview: "REQUIRED";
  secondPass: "AUTO_IF_NEEDED";
  rightsValidation: "REQUIRED";
}

export const premiumProfiles: Record<PremiumVideoProfileId, PremiumVideoProfile> = {
  PREMIUM_REEL_V1: {
    id: "PREMIUM_REEL_V1",
    resolution: "1080x1920",
    aspectRatio: "9:16",
    fps: 30,
    minDuration: 24,
    maxDuration: 32,
    voice: "FAST_NATURAL",
    visual: "CINEMATIC_SEMANTIC",
    subtitles: "CINEMATIC_MINIMAL",
    audio: "PREMIUM_MIX",
    color: "SHOT_MATCHED",
    firstCutReview: "REQUIRED",
    secondPass: "AUTO_IF_NEEDED",
    rightsValidation: "REQUIRED"
  },
  PREMIUM_FAST_V1: {
    id: "PREMIUM_FAST_V1",
    resolution: "1080x1920",
    aspectRatio: "9:16",
    fps: 30,
    minDuration: 20,
    maxDuration: 30,
    voice: "FAST_NATURAL",
    visual: "CINEMATIC_SEMANTIC",
    subtitles: "CINEMATIC_MINIMAL",
    audio: "PREMIUM_MIX",
    color: "SHOT_MATCHED",
    firstCutReview: "REQUIRED",
    secondPass: "AUTO_IF_NEEDED",
    rightsValidation: "REQUIRED"
  },
  PREMIUM_CINEMATIC_V1: {
    id: "PREMIUM_CINEMATIC_V1",
    resolution: "1080x1920",
    aspectRatio: "9:16",
    fps: 30,
    minDuration: 24,
    maxDuration: 32,
    voice: "FAST_NATURAL",
    visual: "CINEMATIC_SEMANTIC",
    subtitles: "CINEMATIC_MINIMAL",
    audio: "PREMIUM_MIX",
    color: "SHOT_MATCHED",
    firstCutReview: "REQUIRED",
    secondPass: "AUTO_IF_NEEDED",
    rightsValidation: "REQUIRED"
  }
};

export function choosePremiumProfile(topic: string, brief?: CreativeBrief): PremiumVideoProfile {
  const lower = topic.toLowerCase();
  if (/\b(ai|technology|tech|cyber|security|news|software|app|model|automation)\b/.test(lower)) return premiumProfiles.PREMIUM_FAST_V1;
  if (/\b(reading|vlog|alone|quiet|time|story|motivation|reflect|lifestyle|coffee|study)\b/.test(lower) || brief?.voiceOver.emotion.includes("reflective")) {
    return premiumProfiles.PREMIUM_CINEMATIC_V1;
  }
  return premiumProfiles.PREMIUM_REEL_V1;
}
