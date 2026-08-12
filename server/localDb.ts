import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrandProfile, Job, MediaItem, Platform } from "../src/domain";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = process.env.SOCIAL_AGENT_DATA_ROOT
  ? path.resolve(process.env.SOCIAL_AGENT_DATA_ROOT)
  : process.env.NODE_ENV === "test"
    ? path.resolve(".test-data")
    : defaultRootDir;
export const dataDir = path.join(rootDir, "data");
export const uploadDir = path.join(rootDir, "uploads");
export const outputDir = path.join(rootDir, "outputs");
const dbPath = path.join(dataDir, "db.json");

export interface AgentEvent {
  id: string;
  time: string;
  message: string;
  level: "info" | "warning" | "error";
}

export interface MockPost {
  id: string;
  platform: Platform;
  topic: string;
  caption: string;
  mediaId?: string;
  status: "scheduled" | "published" | "blocked";
  idempotencyKey: string;
  scheduledPublishAt?: string;
  telegramApprovalDueAt?: string;
  telegramApprovalSentAt?: string;
  telegramApprovalStatus?: "pending" | "approved" | "paused";
  telegramApprovalDecidedAt?: string;
  createdAt: string;
}

export interface ProductionAsset {
  id: string;
  topic: string;
  creativeBrief: unknown;
  premiumProfile?: unknown;
  productionMode?: string;
  visualPlan?: unknown;
  storyboard?: unknown;
  backgroundScenePlan?: unknown;
  voiceoverScript: string;
  caption: string;
  voicePath: string;
  voiceStrategy?: string;
  voiceQualityWarning?: string;
  subtitlePath: string;
  renderPath: string;
  premiumMasterPath?: string;
  platformExports?: Record<string, string>;
  thumbnailPath?: string;
  qualityScore?: unknown;
  premiumQualityScore?: unknown;
  qualityReport?: unknown;
  frameReview?: unknown;
  validation: unknown;
  createdAt: string;
}

export interface AppState {
  brandProfile: BrandProfile | null;
  topics: {
    today: { topic: string; source: string } | null;
    tomorrow: { topic: string; source: string } | null;
  };
  media: MediaItem[];
  jobs: Job[];
  posts: MockPost[];
  productions: ProductionAsset[];
  events: AgentEvent[];
  autopilot: {
    enabled: boolean;
    emergencyStopped: boolean;
    paused: boolean;
    monthlyBudget: number;
    monthlyCost: number;
    allowedPlatforms: Platform[];
  };
  connections: Record<string, "not_configured" | "mock" | "connected" | "action_required" | "limited">;
  connectionIssues: Record<string, string[]>;
}

export function defaultState(): AppState {
  return {
    brandProfile: null,
    topics: { today: null, tomorrow: null },
    media: [],
    jobs: [],
    posts: [],
    productions: [],
    events: [],
    autopilot: {
      enabled: false,
      emergencyStopped: false,
      paused: false,
      monthlyBudget: 5,
      monthlyCost: 0,
      allowedPlatforms: ["instagram", "youtube", "tiktok"]
    },
    connections: {
      website: "action_required",
      telegram: "not_configured",
      instagram: "not_configured",
      facebook: "not_configured",
      youtube: "not_configured",
      tiktok: "not_configured",
      ai: "not_configured",
      storage: "not_configured",
      videoWorker: "action_required"
    },
    connectionIssues: {}
  };
}

export function ensureLocalFiles(): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultState(), null, 2));
  }
}

export function readState(): AppState {
  ensureLocalFiles();
  const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8")) as Partial<AppState>;
  return {
    ...defaultState(),
    ...parsed,
    topics: { ...defaultState().topics, ...parsed.topics },
    autopilot: { ...defaultState().autopilot, ...parsed.autopilot },
    connections: { ...defaultState().connections, ...parsed.connections },
    connectionIssues: { ...defaultState().connectionIssues, ...parsed.connectionIssues },
    media: parsed.media ?? [],
    jobs: parsed.jobs ?? [],
    posts: parsed.posts ?? [],
    productions: parsed.productions ?? [],
    events: parsed.events ?? []
  };
}

export function writeState(state: AppState): AppState {
  ensureLocalFiles();
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
  return state;
}

export function updateState(mutator: (state: AppState) => void): AppState {
  const state = readState();
  mutator(state);
  return writeState(state);
}

export function addEvent(message: string, level: AgentEvent["level"] = "info"): void {
  updateState((state) => {
    state.events.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), message, level });
    state.events = state.events.slice(0, 100);
  });
}
