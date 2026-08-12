import { z } from "zod";

export const AutonomyModeSchema = z.enum(["SAFE", "SUPERVISED", "AUTOPILOT"]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

export const PermissionTypeSchema = z.enum([
  "WEBSITE_ANALYSIS",
  "MEDIA_ANALYSIS",
  "AI_GENERATION",
  "VIDEO_RENDERING",
  "SOCIAL_CONNECT",
  "SOCIAL_PUBLISH",
  "SOCIAL_ANALYTICS",
  "TELEGRAM_CONTROL",
  "AUTOPILOT",
  "CLOUD_DEPLOY",
  "PAID_SERVICE",
  "DATA_DELETE"
]);
export type PermissionType = z.infer<typeof PermissionTypeSchema>;

export const PlatformSchema = z.enum(["instagram", "facebook", "youtube", "tiktok"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const PermissionLedgerEntrySchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  type: PermissionTypeSchema,
  platform: PlatformSchema.optional(),
  granted: z.boolean(),
  grantedAt: z.string().datetime().optional(),
  grantedBy: z.string().optional(),
  scope: z.string().optional(),
  revokedAt: z.string().datetime().nullable().default(null)
});
export type PermissionLedgerEntry = z.infer<typeof PermissionLedgerEntrySchema>;

export const BrandProfileSchema = z.object({
  website: z.string().url(),
  brandName: z.string().min(1),
  description: z.string().default(""),
  industry: z.string().default(""),
  targetAudience: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  tone: z.string().default("clear, helpful, brand-safe"),
  brandColors: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(),
  contentCategories: z.array(z.string()).default([]),
  preferredTopics: z.array(z.string()).default([]),
  restrictedTopics: z.array(z.string()).default([]),
  preferredHashtags: z.array(z.string()).default([]),
  bannedWords: z.array(z.string()).default([]),
  ctaStyle: z.string().default("soft call to action"),
  postingStyle: z.string().default("short-form educational and behind-the-scenes posts"),
  socialAccounts: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional()
  }).default({})
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export const MediaItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  filename: z.string(),
  storageUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  type: z.enum(["video", "image", "audio"]),
  duration: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  uploadedAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  aiTags: z.array(z.string()).default([]),
  description: z.string().default(""),
  transcript: z.string().optional(),
  usedCount: z.number().int().nonnegative().default(0),
  lastUsedAt: z.string().datetime().optional(),
  platformUsage: z.object({
    instagram: z.boolean().optional(),
    facebook: z.boolean().optional(),
    youtube: z.boolean().optional(),
    tiktok: z.boolean().optional()
  }).default({}),
  topics: z.array(z.string()).default([]),
  technicalMetadata: z.object({
    codec: z.string().optional(),
    bitrate: z.number().optional(),
    fps: z.number().optional(),
    hasAudio: z.boolean().optional(),
    fileSizeBytes: z.number().optional()
  }).optional(),
  quality: z.object({
    score: z.number().min(0).max(10),
    checks: z.array(z.string()),
    warnings: z.array(z.string())
  }).optional(),
  status: z.enum(["READY", "PROCESSING", "ERROR"]).default("READY")
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

export const JobTypeSchema = z.enum([
  "WEBSITE_SCAN",
  "WEBSITE_UPDATE_CHECK",
  "GENERATE_CONTENT",
  "ANALYZE_MEDIA",
  "TRANSCRIBE_MEDIA",
  "CREATE_EDIT_PLAN",
  "RENDER_VIDEO",
  "VALIDATE_CONTENT",
  "UPLOAD_MEDIA",
  "PUBLISH_POST",
  "CHECK_POST_STATUS",
  "FETCH_ANALYTICS",
  "ANALYZE_ANALYTICS",
  "SEND_TELEGRAM_NOTIFICATION"
]);
export type JobType = z.infer<typeof JobTypeSchema>;

export const JobStatusSchema = z.enum(["PENDING", "RUNNING", "RETRYING", "COMPLETED", "FAILED", "CANCELLED"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  payload: z.unknown(),
  attemptCount: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  nextRetryAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(8)
});
export type Job = z.infer<typeof JobSchema>;

export const VideoEditPlanSchema = z.object({
  topic: z.string().min(1).max(120),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  resolution: z.enum(["1080x1920", "1920x1080", "1080x1080"]),
  targetDurationSeconds: z.number().int().min(5).max(180),
  clips: z.array(z.object({
    mediaId: z.string().min(1),
    start: z.number().nonnegative(),
    end: z.number().positive(),
    reason: z.string().max(300)
  })).min(1).refine((clips) => clips.every((clip) => clip.end > clip.start), "clip end must be after start"),
  subtitles: z.boolean(),
  removeSilence: z.boolean(),
  normalizeAudio: z.boolean(),
  hookText: z.string().max(120),
  outroText: z.string().max(120),
  transitionStyle: z.enum(["none", "cut", "fade"]),
  pace: z.enum(["calm", "standard", "fast"]),
  musicMood: z.string().max(80)
});
export type VideoEditPlan = z.infer<typeof VideoEditPlanSchema>;

export const ContentValidationResultSchema = z.object({
  passed: z.boolean(),
  checks: z.array(z.string()),
  warnings: z.array(z.string()),
  errors: z.array(z.string())
});
export type ContentValidationResult = z.infer<typeof ContentValidationResultSchema>;

export const AutopilotSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: AutonomyModeSchema.default("SAFE"),
  maxPostsPerDay: z.number().int().min(0).default(0),
  maxPostsPerPlatformPerDay: z.number().int().min(0).default(0),
  allowedPlatforms: z.array(PlatformSchema).default([]),
  allowedTopics: z.array(z.string()).default([]),
  restrictedTopics: z.array(z.string()).default([]),
  autoPublishEnabled: z.boolean().default(false),
  aiDailyCostLimit: z.number().nonnegative().default(0),
  aiMonthlyCostLimit: z.number().nonnegative().default(0),
  timezone: z.string().default("UTC")
});
export type AutopilotSettings = z.infer<typeof AutopilotSettingsSchema>;

export const TrendAnalysisSchema = z.object({
  topic: z.string().min(1),
  researchedAt: z.string().datetime(),
  sources: z.array(z.object({
    type: z.enum(["global", "niche", "brand", "account_performance", "local_cache"]),
    label: z.string(),
    url: z.string().url().optional()
  })),
  observations: z.array(z.string()),
  recommendedFormats: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  expirationTime: z.string().datetime()
});
export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;

export const CreativeBriefSchema = z.object({
  topic: z.string().min(1),
  goal: z.enum(["engagement", "awareness", "traffic", "education"]),
  concept: z.string().min(1),
  story: z.string().min(1),
  hook: z.string().min(1),
  targetAudience: z.array(z.string()),
  tone: z.string().min(1),
  visualStyle: z.string().min(1),
  pace: z.enum(["slow", "calm", "cinematic", "medium", "energetic", "fast", "high-retention"]),
  targetDuration: z.number().int().min(10).max(90),
  voiceOver: z.object({
    required: z.boolean(),
    style: z.string(),
    emotion: z.string(),
    speed: z.enum(["slow", "normal", "fast"])
  }),
  platforms: z.array(PlatformSchema)
});
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

export const VoiceProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["windows_sapi", "mock_silent", "external"]),
  voiceId: z.string(),
  language: z.string(),
  accent: z.string().optional(),
  style: z.string(),
  speed: z.number().min(0.5).max(1.6),
  tone: z.string(),
  stability: z.number().min(0).max(1),
  enabled: z.boolean()
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export const VoiceOverResultSchema = z.object({
  provider: z.string(),
  path: z.string(),
  durationSeconds: z.number().positive(),
  characters: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  strategy: z.enum(["RECORDED_HUMAN_LIBRARY", "USER_RECORDED_VOICE", "LICENSED_VOICE_PACK", "SYNTHETIC_TTS", "NO_VOICEOVER"]).optional(),
  qualityWarning: z.string().optional(),
  rightsStatus: z.string().optional()
});
export type VoiceOverResult = z.infer<typeof VoiceOverResultSchema>;

export const VideoTimelineSchema = z.object({
  duration: z.number().positive().max(180),
  tracks: z.object({
    video: z.array(z.object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
      mediaId: z.string(),
      operation: z.enum(["trim", "crop_vertical", "zoom", "hold"]),
      transition: z.enum(["cut", "fade"]).default("cut"),
      reason: z.string()
    })),
    voiceOver: z.array(z.object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
      source: z.string()
    })),
    music: z.array(z.object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
      source: z.string(),
      license: z.string()
    })).default([]),
    soundEffects: z.array(z.object({
      start: z.number().nonnegative(),
      source: z.string(),
      reason: z.string()
    })).default([]),
    subtitles: z.array(z.object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
      text: z.string()
    })),
    text: z.array(z.object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
      text: z.string(),
      style: z.enum(["minimal", "cinematic", "dynamic"])
    })).default([])
  })
});
export type VideoTimeline = z.infer<typeof VideoTimelineSchema>;

export const ProductionModeSchema = z.enum([
  "CINEMATIC_VLOG",
  "FACELESS_EXPLAINER",
  "TECH_EXPLAINER",
  "PRODUCT_DEMO",
  "EDUCATIONAL",
  "DAILY_VLOG",
  "STUDY_VLOG",
  "PROMOTIONAL",
  "HYBRID"
]);
export type ProductionMode = z.infer<typeof ProductionModeSchema>;

export const VisualPlanSchema = z.object({
  segment: z.number().int().nonnegative(),
  voiceStart: z.number().nonnegative(),
  voiceEnd: z.number().positive(),
  narration: z.string(),
  visualGoal: z.string(),
  visualType: z.enum([
    "USER_VIDEO",
    "WEBSITE_ASSET",
    "WEBSITE_SCREENSHOT",
    "MOTION_GRAPHIC",
    "KINETIC_TEXT",
    "DIAGRAM",
    "BROLL",
    "TITLE_CARD"
  ]),
  motion: z.enum(["none", "slow_push", "pan", "punch_in", "text_reveal"]),
  overlay: z.object({
    text: z.string(),
    style: z.enum(["bold-minimal", "cinematic", "clean-callout"])
  }).optional(),
  reason: z.string()
});
export type VisualPlan = z.infer<typeof VisualPlanSchema>;

export const StoryboardSceneSchema = z.object({
  id: z.string(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  purpose: z.enum(["HOOK", "CONTEXT", "STORY", "PAYOFF", "CTA"]),
  visual: z.string(),
  text: z.string().optional(),
  sound: z.string().optional(),
  transition: z.enum(["hard_cut", "fade", "graphic_cut"]),
  sourceType: z.enum(["USER_VIDEO", "WEBSITE_SCREENSHOT", "MOTION_GRAPHIC", "KINETIC_TEXT", "BROLL", "TITLE_CARD"])
});
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

export const StoryboardSchema = z.object({
  topic: z.string(),
  productionMode: ProductionModeSchema,
  scenes: z.array(StoryboardSceneSchema).min(1)
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const ProductionQualityScoreSchema = z.object({
  story: z.number().min(0).max(10),
  hook: z.number().min(0).max(10),
  visualRelevance: z.number().min(0).max(10),
  visualVariety: z.number().min(0).max(10),
  editing: z.number().min(0).max(10),
  narration: z.number().min(0).max(10),
  audio: z.number().min(0).max(10),
  subtitles: z.number().min(0).max(10),
  brandConsistency: z.number().min(0).max(10),
  technicalQuality: z.number().min(0).max(10),
  passed: z.boolean(),
  notes: z.array(z.string())
});
export type ProductionQualityScore = z.infer<typeof ProductionQualityScoreSchema>;

export const ThumbnailResultSchema = z.object({
  path: z.string(),
  text: z.string(),
  platform: PlatformSchema,
  generatedAt: z.string().datetime()
});
export type ThumbnailResult = z.infer<typeof ThumbnailResultSchema>;
