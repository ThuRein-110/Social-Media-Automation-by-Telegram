import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CalendarDays,
  Check,
  CirclePause,
  Gauge,
  Globe2,
  Library,
  MessageCircle,
  Play,
  RadioTower,
  ShieldCheck,
  StopCircle,
  Upload
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";
const AUTH_TOKEN_KEY = "social-agent-session";

type ConnectionState = "not_configured" | "action_required" | "connected" | "mock" | "error" | "expired" | "limited";

interface AppState {
  brandProfile: null | {
    website: string;
    brandName: string;
    description: string;
    tone: string;
    contentCategories: string[];
  };
  topics: {
    today: null | { topic: string; source: string };
  };
  media: Array<{
    id: string;
    filename: string;
    storageUrl: string;
    type: string;
    aiTags: string[];
    usedCount: number;
    lastUsedAt?: string;
    width?: number;
    height?: number;
    duration?: number;
    technicalMetadata?: { fps?: number; hasAudio?: boolean; codec?: string; fileSizeBytes?: number };
    quality?: { score: number; warnings: string[] };
    status: string;
  }>;
  jobs: Array<{ id: string; type: string; status: string; createdAt: string }>;
  posts: Array<{
    id: string;
    platform: string;
    topic: string;
    status: string;
    caption: string;
    scheduledPublishAt?: string;
    telegramApprovalDueAt?: string;
    telegramApprovalSentAt?: string;
    telegramApprovalStatus?: "pending" | "approved" | "paused";
    telegramApprovalDecidedAt?: string;
    createdAt: string;
  }>;
  productions: Array<{
    id: string;
    topic: string;
    productionMode?: string;
    voiceoverScript: string;
    voiceStrategy?: string;
    voiceQualityWarning?: string;
    caption?: string;
    renderPath: string;
    thumbnailPath?: string;
    createdAt: string;
    validation: { passed?: boolean };
    qualityScore?: { passed?: boolean; hook?: number; visualVariety?: number; story?: number; technicalQuality?: number; notes?: string[] };
    qualityReport?: {
      ready?: boolean;
      score?: number;
      summary?: string;
      durationSeconds?: number;
      width?: number;
      height?: number;
      checks?: Array<{ name: string; passed: boolean; detail: string }>;
      improvements?: string[];
    };
  }>;
  events: Array<{ id: string; time: string; message: string; level: string }>;
  autopilot: {
    enabled: boolean;
    emergencyStopped: boolean;
    paused: boolean;
    monthlyBudget: number;
    monthlyCost: number;
  };
  connections: Record<string, ConnectionState>;
  connectionIssues: Record<string, string[]>;
}

interface ConnectionTestResult {
  service: string;
  ok: boolean;
  title: string;
  message: string;
  nextSteps: string[];
  details?: {
    users?: Array<{ id: number; username?: string; first_name?: string }>;
    meta?: string;
    google?: string;
    tiktok?: string;
  };
}

interface LoginResponse {
  username: string;
  token: string;
}

type SecretStatus = Record<string, Record<string, boolean>>;

const emptyState: AppState = {
  brandProfile: null,
  topics: { today: null },
  media: [],
  jobs: [],
  posts: [],
  productions: [],
  events: [],
  autopilot: { enabled: false, emergencyStopped: false, paused: false, monthlyBudget: 5, monthlyCost: 0 },
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

const serviceLabels: Record<string, string> = {
  website: "Website",
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  ai: "AI",
  storage: "Storage",
  videoWorker: "Video Worker"
};

const connectionOrder = ["telegram", "instagram", "facebook", "youtube", "tiktok", "ai", "storage", "videoWorker"];
const manualUploadServices = new Set(["instagram", "facebook", "youtube"]);

const setupGuides: Record<string, { title: string; purpose: string; simple: string; needs: string[]; steps: string[]; note: string; readyText: string }> = {
  telegram: {
    title: "Telegram Remote",
    purpose: "Control the agent from your phone.",
    simple: "Start here. Telegram lets you type messages like â€œtoday is reading vlogâ€ and the agent starts working.",
    needs: ["A Telegram bot", "Your numeric Telegram user ID"],
    steps: [
      "Open Telegram and search BotFather.",
      "Send /newbot and copy the token BotFather gives you.",
      "Paste the token below, send any message to your bot, then click Find My Telegram ID."
    ],
    note: "Your user ID is a number. It is not your @username and not the bot username.",
    readyText: "Telegram can be tested for real after the token and numeric user ID are saved."
  },
  instagram: {
    title: "Instagram Reels",
    purpose: "Prepare Reels, captions, and hashtags for Instagram.",
    simple: "Use Manual Upload Pack. The agent creates the Reel and sends it to Telegram.",
    needs: ["Manual upload pack"],
    steps: [
      "Use Manual Upload Pack now.",
      "The agent creates the 30-second Reel and caption.",
      "Open the MP4 from Media and upload it manually to Instagram."
    ],
    note: "The app prepares the MP4 and caption. You upload manually.",
    readyText: "Instagram is ready for manual upload packs."
  },
  facebook: {
    title: "Facebook Page",
    purpose: "Prepare Reels/posts for a Facebook Page.",
    simple: "Use Manual Upload Pack for Facebook too.",
    needs: ["Manual upload pack"],
    steps: [
      "Use Manual Upload Pack now.",
      "The agent creates the video and caption.",
      "Upload the MP4 manually to your Facebook Page."
    ],
    note: "The app prepares the MP4 and caption. You upload manually.",
    readyText: "Facebook is ready for manual upload packs."
  },
  youtube: {
    title: "YouTube Shorts",
    purpose: "Prepare Shorts, captions, and hashtags for manual upload.",
    simple: "The agent creates a 30-second vertical Reel/Short and caption. You upload it manually.",
    needs: ["Manual upload pack"],
    steps: [
      "Use Manual Upload Pack now.",
      "The agent creates the MP4 and caption.",
      "Upload the MP4 manually to YouTube Shorts."
    ],
    note: "No Google developer setup is needed for manual upload.",
    readyText: "YouTube is ready for manual upload packs."
  },
  tiktok: {
    title: "TikTok",
    purpose: "Prepare TikTok videos now, then connect official auto-upload when TikTok approves the app.",
    simple: "The app can save your TikTok developer keys. Real auto-upload also needs TikTok Login/OAuth and Content Posting API approval.",
    needs: ["TikTok Client Key", "TikTok Client Secret", "Redirect URI", "TikTok Content Posting API approval"],
    steps: [
      "Copy the Redirect URI below into TikTok Login Kit settings.",
      "Paste Client Key and Client Secret from TikTok Developer.",
      "After TikTok approves video.publish or video.upload, connect OAuth and test with a private post."
    ],
    note: "Client Key and Secret do not upload by themselves. TikTok requires a user access token from OAuth before live posting.",
    readyText: "TikTok developer keys can be checked after saving."
  },
  ai: {
    title: "AI Writing + Planning",
    purpose: "Improve scripts, captions, hooks, and creative direction.",
    simple: "Optional. Local planning is free. Live AI may cost money depending on usage.",
    needs: ["OpenAI API key", "A small monthly budget limit"],
    steps: [
      "Create or use an OpenAI API key.",
      "Paste it in Advanced.",
      "Keep the monthly budget low first."
    ],
    note: "You can automate raw-video editing without live AI, but live AI improves quality.",
    readyText: "AI can be checked after the key is saved."
  },
  storage: {
    title: "Local Storage",
    purpose: "Store uploaded media and rendered videos.",
    simple: "Already works on this computer. You do not need to buy cloud storage for local automation.",
    needs: ["Nothing for local use"],
    steps: [
      "Local storage is already working.",
      "Upload raw videos in Media.",
      "Rendered videos are saved in outputs."
    ],
    note: "Cloud storage is only needed later for production deployment.",
    readyText: "Local storage is ready."
  },
  videoWorker: {
    title: "Video Editor",
    purpose: "Render vertical videos automatically.",
    simple: "Already included. No account, no key, no paid video editor required.",
    needs: ["Nothing for local use"],
    steps: [
      "Bundled FFmpeg is already installed.",
      "Upload raw videos.",
      "Run a topic to generate the final MP4."
    ],
    note: "Cloud rendering is only needed if you want this to run while your computer is off.",
    readyText: "The local video editor is ready."
  }
};

const secretFields: Record<string, Array<{ key: string; label: string; placeholder: string; secret?: boolean; required?: boolean }>> = {
  telegram: [
    { key: "TELEGRAM_BOT_TOKEN", label: "Bot token from BotFather", placeholder: "Paste bot token", secret: true, required: true },
    { key: "TELEGRAM_ALLOWED_USER_IDS", label: "Your Telegram user ID", placeholder: "Paste user ID", required: true }
  ],
  ai: [
    { key: "OPENAI_API_KEY", label: "OpenAI API key", placeholder: "sk-...", secret: true, required: true }
  ],
  tiktok: [
    { key: "TIKTOK_CLIENT_KEY", label: "TikTok Client Key", placeholder: "Paste client key", required: true },
    { key: "TIKTOK_CLIENT_SECRET", label: "TikTok Client Secret", placeholder: "Paste client secret", secret: true, required: true },
    { key: "TIKTOK_REDIRECT_URI", label: "Redirect URI", placeholder: "http://127.0.0.1:8787/api/oauth/tiktok/callback", required: true }
  ]
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof localStorage === "undefined" ? "" : localStorage.getItem(AUTH_TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: options?.body instanceof FormData
      ? { ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers }
      : { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.dispatchEvent(new Event("social-agent-auth-expired"));
  }
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function formatState(state: ConnectionState) {
  return state.replace(/_/g, " ").toUpperCase();
}

function statusLabel(state: ConnectionState) {
  if (state === "connected") return "Live ready";
  if (state === "mock") return "Manual ready";
  if (state === "action_required") return "Needs setup";
  if (state === "limited") return "Limited";
  return "Not set up";
}

function actionText(service: string) {
  if (service === "storage" || service === "videoWorker") return "Enable Local Automation";
  if (service === "telegram") return "Test Telegram";
  return "Check Saved Setup";
}

function assetUrl(filePath?: string) {
  if (!filePath) return "";
  const normalized = filePath.replaceAll("\\", "/");
  const marker = "/outputs/";
  const index = normalized.toLowerCase().indexOf(marker);
  if (index >= 0) return `${API_BASE}/outputs/${normalized.slice(index + marker.length)}`;
  return filePath;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) ?? "");
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [state, setState] = useState<AppState>(emptyState);
  const [website, setWebsite] = useState("");
  const [topic, setTopic] = useState("reading vlog");
  const [onlineClipTopic, setOnlineClipTopic] = useState("reading vlog");
  const [telegramText, setTelegramText] = useState("today is reading vlog");
  const [message, setMessage] = useState("Start with a website URL. Local automation keeps costs low.");
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState("Dashboard");
  const [selectedSetup, setSelectedSetup] = useState("telegram");
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [secretStatus, setSecretStatus] = useState<SecretStatus>({});
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

  async function refresh() {
    const [nextState, nextSecretStatus] = await Promise.all([
      api<AppState>("/api/state"),
      api<SecretStatus>("/api/secrets/status")
    ]);
    setState(nextState);
    setSecretStatus(nextSecretStatus);
  }

  useEffect(() => {
    if (!authToken) return;
    refresh().catch((error) => setMessage(error.message));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [authToken]);

  useEffect(() => {
    const logout = () => setAuthToken("");
    window.addEventListener("social-agent-auth-expired", logout);
    return () => window.removeEventListener("social-agent-auth-expired", logout);
  }, []);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUser, password: loginPassword })
      });
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      setAuthToken(result.token);
      setLoginPassword("");
      setMessage("Login successful. Your saved setup is remembered on this computer.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken("");
    setLoginPassword("");
    setMessage("Logged out.");
  }

  const readiness = useMemo(() => {
    const ready = Object.values(state.connections).filter((value) => value === "connected" || value === "mock").length;
    return { ready, total: Object.keys(state.connections).length };
  }, [state.connections]);

  const telegramReview = useMemo(() => {
    const sentPosts = state.posts.filter((post) => Boolean(post.telegramApprovalSentAt));
    const waitingPosts = state.posts.filter((post) => post.telegramApprovalDueAt && !post.telegramApprovalSentAt);
    const activity = state.events.filter((event) => event.message.toLowerCase().includes("telegram"));
    return { sentPosts, waitingPosts, activity };
  }, [state.events, state.posts]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function analyze() {
    runAction(async () => {
      setMessage("Analyzing website and creating Brand Profile...");
      const profile = await api<AppState["brandProfile"]>("/api/analyze-website", { method: "POST", body: JSON.stringify({ url: website }) });
      setMessage(`Brand Profile created for ${profile?.brandName}.`);
    });
  }

  function mock(service: string) {
    runAction(async () => {
      setMessage(`Configuring ${serviceLabels[service]} for manual upload automation...`);
      await api<AppState>(`/api/mock/${service}`, { method: "POST" });
      setMessage(`${serviceLabels[service]} is ready for manual upload packs.`);
    });
  }

  function live(service: string) {
    runAction(async () => {
      setMessage(`Checking live setup for ${serviceLabels[service]}...`);
      const next = await api<AppState>(`/api/live/${service}`, { method: "POST" });
      const missing = next.connectionIssues[service] ?? [];
      setMessage(missing.length ? `${serviceLabels[service]} needs: ${missing.join(", ")}` : `${serviceLabels[service]} is live-configured locally.`);
    });
  }

  function resetConnection(service: string) {
    runAction(async () => {
      await api<AppState>(`/api/unmock/${service}`, { method: "POST" });
      setMessage(`${serviceLabels[service]} reset. You can configure it again.`);
    });
  }

  function saveServiceSecrets(service: string) {
    runAction(async () => {
      const fields = secretFields[service] ?? [];
      const payload = Object.fromEntries(fields.map((field) => [field.key, secretValues[field.key] ?? ""]));
      const result = await api<{ saved: string[]; status: Record<string, Record<string, boolean>> }>(`/api/secrets/${service}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSecretValues((current) => {
        const next = { ...current };
        for (const field of fields) delete next[field.key];
        return next;
      });
      setMessage(result.saved.length ? `${serviceLabels[service]} values saved locally. Click Use Live to verify.` : `No ${serviceLabels[service]} values were saved.`);
    });
  }

  function saveAndTestService(service: string) {
    runAction(async () => {
      const fields = secretFields[service] ?? [];
      const payload = Object.fromEntries(fields.map((field) => [field.key, secretValues[field.key] ?? ""]));
      await api<{ saved: string[]; status: Record<string, Record<string, boolean>> }>(`/api/secrets/${service}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const next = await api<AppState>(`/api/live/${service}`, { method: "POST" });
      const missing = next.connectionIssues[service] ?? [];
      if (missing.length) {
        setTestResult({
          service,
          ok: false,
          title: "More information needed",
          message: `${serviceLabels[service]} still needs: ${missing.join(", ")}`,
          nextSteps: ["Fill the missing required fields", `Click Save and Test ${serviceLabels[service]} again`]
        });
        setMessage(`${serviceLabels[service]} still needs required information.`);
        return;
      }
      const result = await api<ConnectionTestResult>(`/api/test/${service}`, { method: "POST" });
      setTestResult(result);
      setSecretValues((current) => {
        const clean = { ...current };
        for (const field of fields) delete clean[field.key];
        return clean;
      });
      setMessage(result.ok ? `${serviceLabels[service]} is working.` : `${serviceLabels[service]} needs attention.`);
    });
  }

  function selectConnection(service: string) {
    setSelectedSetup(service);
    setTestResult(null);
    setShowAdvancedKeys(false);
    setMessage(`Setup opened for ${serviceLabels[service]}.`);
  }

  function testService(service: string) {
    runAction(async () => {
      setMessage(`Testing ${serviceLabels[service]}...`);
      const result = await api<ConnectionTestResult>(`/api/test/${service}`, { method: "POST" });
      setTestResult(result);
      setMessage(result.ok ? `${serviceLabels[service]} test passed.` : `${serviceLabels[service]} test needs attention.`);
    });
  }

  function discoverTelegramUser() {
    runAction(async () => {
      setMessage("Looking for Telegram users who messaged your bot...");
      const result = await api<ConnectionTestResult>("/api/telegram/discover-user", { method: "POST" });
      setTestResult(result);
      const firstUser = result.details?.users?.[0];
      if (firstUser?.id) {
        setSecretValues((current) => ({ ...current, TELEGRAM_ALLOWED_USER_IDS: String(firstUser.id) }));
      }
      setMessage(result.message);
    });
  }

  function uploadMedia(file: File) {
    runAction(async () => {
      const form = new FormData();
      form.append("media", file);
      setMessage(`Uploading and analyzing ${file.name}...`);
      await api("/api/media", { method: "POST", body: form });
      setMessage(`${file.name} uploaded and analyzed.`);
    });
  }

  function collectOnlineClipsForTopic(inputTopic = onlineClipTopic) {
    runAction(async () => {
      setMessage(`Collecting reusable online clips for ${inputTopic}...`);
      const result = await api<{ imported: Array<{ filename: string }> }>("/api/media/collect-online", {
        method: "POST",
        body: JSON.stringify({ topic: inputTopic, count: 2 })
      });
      setMessage(`Collected ${result.imported.length} reusable clip${result.imported.length === 1 ? "" : "s"} for ${inputTopic}.`);
    });
  }

  function runTopic() {
    runAction(async () => {
      setMessage("Running agent workflow...");
      if (!state.media.some((item) => item.type === "video" && item.status === "READY")) {
        setMessage(`No raw videos found. Collecting reusable online clips for ${topic} first...`);
        await api("/api/media/collect-online", {
          method: "POST",
          body: JSON.stringify({ topic, count: 2 })
        });
      }
      await api("/api/topic", { method: "POST", body: JSON.stringify({ topic, source: "dashboard" }) });
      setMessage("Workflow completed: final video created, caption saved, and posts prepared.");
    });
  }

  function runTelegram() {
    runAction(async () => {
      setMessage("Processing Telegram command...");
      await api("/api/telegram/mock", { method: "POST", body: JSON.stringify({ text: telegramText }) });
      setMessage("Telegram command handled and workflow started.");
    });
  }

  function sendLatestTelegramPreview() {
    runAction(async () => {
      setMessage("Sending latest prepared post to Telegram...");
      const result = await api<{ message: string }>("/api/telegram/send-latest-preview", { method: "POST" });
      setMessage(result.message);
    });
  }

  function sendSocialSetupToTelegram() {
    runAction(async () => {
      setMessage("Sending social setup checklist to Telegram...");
      const result = await api<{ message: string }>("/api/telegram/send-social-setup", { method: "POST" });
      setMessage(result.message);
    });
  }

  function stop() {
    runAction(async () => {
      await api("/api/emergency-stop", { method: "POST" });
      setMessage("AUTOPILOT STOPPED. New publish jobs and scheduled posts are blocked.");
    });
  }

  if (!authToken) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={submitLogin}>
          <p className="eyebrow">Secure Login</p>
          <h1>Social Agent</h1>
          <p className="muted">Login only. No account creation.</p>
          <label>
            Username
            <input value={loginUser} onChange={(event) => setLoginUser(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {loginError ? <p className="login-error">{loginError}</p> : null}
          <button className="login-button" type="submit">Login</button>
          <p className="safe-note">This remembers your login on this computer. Videos and created posts stay local.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Bot size={22} /> Social Agent</div>
        {[
          ["Dashboard", Activity],
          ["Media", Library],
          ["Calendar", CalendarDays],
          ["Posts", RadioTower],
          ["Analytics", Gauge],
          ["Brand", Globe2],
          ["Telegram", MessageCircle],
          ["Connections", ShieldCheck],
          ["Agent Activity", Activity],
          ["Settings", CirclePause]
        ].map(([label, Icon]) => (
          <button
            className={`nav-button ${activeView === label ? "active" : ""}`}
            key={label as string}
            title={label as string}
            onClick={() => setActiveView(label as string)}
          >
            <Icon size={18} /> <span>{label as string}</span>
          </button>
        ))}
        <button className="nav-button logout-button" onClick={logout}>
          <CirclePause size={18} /> <span>Logout</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Build Your Social Agent</p>
            <h1>What's your website?</h1>
          </div>
          <button className="danger-button" title="Emergency stop" onClick={stop} disabled={busy}>
            <StopCircle size={18} /> Emergency Stop
          </button>
        </header>

        <section className="onboarding-band">
          <input aria-label="Website URL" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" />
          <button onClick={analyze} disabled={busy}>Analyze Website</button>
        </section>

        <p className="status-line">{busy ? "Working..." : message}</p>

        {activeView === "Dashboard" ? <>
          <section className="setup-guide">
            <h2>Easy Setup</h2>
            <ol>
              <li><strong>Analyze your website.</strong> Enter your website above and click Analyze Website.</li>
              <li><strong>Connect Telegram.</strong> Telegram sends approvals and setup reminders to your phone.</li>
              <li><strong>Upload videos.</strong> Go to Media and upload your own clips.</li>
              <li><strong>Run a topic.</strong> Type your topic and click Run Agent to create the final MP4 and captions.</li>
              <li><strong>Manual upload.</strong> Use the MP4 and caption from Media/Brand to post on Instagram, Facebook, YouTube Shorts, or TikTok.</li>
            </ol>
          </section>

          <section className="dashboard-grid">
          <div className="panel status-panel">
            <p className="eyebrow">Autopilot</p>
            <h2>{state.autopilot.emergencyStopped ? "Stopped" : state.autopilot.paused ? "Paused" : readiness.ready >= 6 ? "Local Ready" : "Setup Needed"}</h2>
            <p className="muted">Local video automation is safe and low cost. You manually upload the final MP4.</p>
          </div>
          <div className="panel">
            <p className="eyebrow">Today's Topic</p>
            <input aria-label="Today's topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
            <button className="secondary-button" onClick={runTopic} disabled={busy}><Play size={16} /> Run Agent</button>
          </div>
          <div className="panel">
            <p className="eyebrow">Agent Health</p>
            <h2>{readiness.ready}/{readiness.total}</h2>
            <p className="muted">Ready connections include local automation services and verified account setup.</p>
          </div>
          <div className="panel">
            <p className="eyebrow">Monthly Cost</p>
            <h2>${state.autopilot.monthlyCost.toFixed(2)}</h2>
            <p className="muted">Budget: ${state.autopilot.monthlyBudget.toFixed(2)}</p>
          </div>
          </section>

          <section className="two-column">
          <div className="panel">
            <h2>Brand Profile</h2>
            {state.brandProfile ? (
              <>
                <p><strong>{state.brandProfile.brandName}</strong></p>
                <p className="muted">{state.brandProfile.description}</p>
                <p className="tag-row">{state.brandProfile.contentCategories.map((category) => <span key={category}>{category}</span>)}</p>
              </>
            ) : <p className="muted">Analyze a website to create this automatically.</p>}
          </div>

          <div className="panel">
            <h2>Telegram Review</h2>
            <p className="muted">Open the Telegram section to review every approval message and Telegram command in one place.</p>
            <button className="secondary-button" onClick={() => setActiveView("Telegram")}>
              <MessageCircle size={16} /> Open Telegram Review
            </button>
          </div>
          </section>
        </> : null}

        {activeView === "Telegram" ? <section className="telegram-workspace">
          <div className="telegram-heading">
            <div>
              <p className="eyebrow">Telegram Review</p>
              <h2>Messages and post approvals</h2>
              <p className="muted">Look back at what the agent sent to Telegram and check what is waiting.</p>
            </div>
            <span className={`status-pill ${state.connections.telegram === "connected" ? "ready" : ""}`}>
              {state.connections.telegram === "connected" ? "Connected" : "Needs setup"}
            </span>
          </div>

          <div className="telegram-summary">
            <div><strong>{telegramReview.sentPosts.length}</strong><span>Posts sent</span></div>
            <div><strong>{telegramReview.waitingPosts.length}</strong><span>Waiting to send</span></div>
            <div><strong>{telegramReview.activity.length}</strong><span>Telegram activities</span></div>
          </div>

          <div className="telegram-review-layout">
            <section className="panel telegram-history">
              <div className="section-title-row">
                <div>
                  <h2>Sent to Telegram</h2>
                  <p className="muted">These are the post previews you can also find in your Telegram chat.</p>
                </div>
                <button className="secondary-button test-button" onClick={sendLatestTelegramPreview} disabled={busy}>
                  <MessageCircle size={16} /> Send Latest Post
                </button>
              </div>
              {telegramReview.sentPosts.length === 0 ? <p className="empty-state">No post preview has been sent yet. Create a post, then click Send Latest Post.</p> : null}
              {telegramReview.sentPosts.map((post) => (
                <article className="telegram-post" key={post.id}>
                  <div className="telegram-post-header">
                    <div><strong>{post.topic}</strong><span>{post.platform}</span></div>
                    <span className={`delivery-badge ${post.telegramApprovalStatus ?? "pending"}`}>
                      <Check size={14} /> {post.telegramApprovalStatus === "approved" ? "Approved" : post.telegramApprovalStatus === "paused" ? "Paused" : "Waiting for approval"}
                    </span>
                  </div>
                  <p>{post.caption}</p>
                  <div className="telegram-post-meta">
                    <span>Sent: {formatDate(post.telegramApprovalSentAt!)}</span>
                    {post.telegramApprovalDecidedAt ? <span>Decision: {formatDate(post.telegramApprovalDecidedAt)}</span> : null}
                    {post.scheduledPublishAt ? <span>Planned upload: {formatDate(post.scheduledPublishAt)}</span> : null}
                  </div>
                </article>
              ))}
            </section>

            <aside className="telegram-side">
              <section className="panel">
                <h2>Waiting to Send</h2>
                {telegramReview.waitingPosts.length === 0 ? <p className="muted">Nothing is waiting right now.</p> : null}
                {telegramReview.waitingPosts.map((post) => (
                  <div className="waiting-row" key={post.id}>
                    <strong>{post.topic}</strong>
                    <span>{post.platform}</span>
                    {post.scheduledPublishAt ? <small>Upload: {formatDate(post.scheduledPublishAt)}</small> : null}
                  </div>
                ))}
              </section>

              <section className="panel">
                <h2>Telegram Activity</h2>
                {telegramReview.activity.length === 0 ? <p className="muted">Telegram actions will appear here.</p> : null}
                {telegramReview.activity.slice(0, 12).map((event) => (
                  <div className="telegram-event" key={event.id}>
                    <span className={`event-dot ${event.level}`} />
                    <div><p>{event.message}</p><small>{formatDate(event.time)}</small></div>
                  </div>
                ))}
              </section>

              <details className="panel telegram-command-panel">
                <summary>Run a Telegram command here</summary>
                <p className="muted">This performs the same command locally as a message received from your bot.</p>
                <input aria-label="Telegram command" value={telegramText} onChange={(event) => setTelegramText(event.target.value)} />
                <button className="secondary-button" onClick={runTelegram} disabled={busy}><Play size={16} /> Run Command</button>
              </details>
            </aside>
          </div>
        </section> : null}

        {activeView === "Connections" ? <section className="connection-list">
          <div className="setup-guide compact-guide">
            <h2>Before You Configure Social Media</h2>
            <p>Send the current saved/missing account checklist to Telegram so you can follow the setup from your phone.</p>
            <button className="secondary-button" onClick={sendSocialSetupToTelegram} disabled={busy}>
              Send Setup Checklist to Telegram
            </button>
          </div>
          <div className="connection-layout">
            <aside className="connection-picker">
              <p className="eyebrow">Connections</p>
              <h2>What do you want to set up?</h2>
              {connectionOrder.map((key) => {
                const value = state.connections[key];
                const required = secretFields[key] ?? [];
                const savedCount = required.filter((field) => secretStatus[key]?.[field.key]).length;
                return (
                  <button className={selectedSetup === key ? "selected" : ""} key={key} onClick={() => selectConnection(key)}>
                    <span>{serviceLabels[key]}</span>
                    <strong className={["connected", "mock"].includes(value) ? "ok" : "warn"}>
                      {required.length && value !== "connected" ? `${savedCount}/${required.length} saved` : statusLabel(value)}
                    </strong>
                  </button>
                );
              })}
            </aside>

            <section className="setup-panel">
              <div className="setup-panel-header">
                <div>
                  <p className="eyebrow">Account Setup</p>
                  <h2>{setupGuides[selectedSetup].title}</h2>
                  <p className="muted">{setupGuides[selectedSetup].simple}</p>
                </div>
                <span className={`status-pill ${["connected", "mock"].includes(state.connections[selectedSetup]) ? "ready" : ""}`}>
                  {statusLabel(state.connections[selectedSetup])}
                </span>
              </div>

              <div className="plain-summary">
                <div>
                  <strong>What this does</strong>
                  <p>{setupGuides[selectedSetup].purpose}</p>
                </div>
                <div>
                  <strong>What you need</strong>
                  <ul>
                    {setupGuides[selectedSetup].needs.map((need) => <li key={need}>{need}</li>)}
                  </ul>
                </div>
              </div>

              <div className="friendly-steps">
                {setupGuides[selectedSetup].steps.map((step, index) => (
                  <div key={step}>
                    <strong>{index + 1}</strong>
                    <p>{step}</p>
                  </div>
                ))}
              </div>

              {state.connectionIssues[selectedSetup]?.length ? (
                <div className="missing-box">
                  <strong>Still needed</strong>
                  <p>{state.connectionIssues[selectedSetup].join(", ")}</p>
                </div>
              ) : null}

              {(secretFields[selectedSetup] ?? []).length ? (
                <>
                  <button className="advanced-toggle" onClick={() => setShowAdvancedKeys((value) => !value)}>
                    {showAdvancedKeys ? "Hide account fields" : "Start Final Setup"}
                  </button>
                  {!showAdvancedKeys ? (
                    <p className="safe-note">Paste the required local key here only for services we still use.</p>
                  ) : (
                    <>
                      <div className="secret-form friendly-form">
                        {(secretFields[selectedSetup] ?? []).map((field) => (
                          <label key={field.key}>
                            <span className="field-label-row">
                              <span>{field.label}{field.required ? <strong className="required-star" aria-label="required">*</strong> : null}</span>
                              <strong className={secretStatus[selectedSetup]?.[field.key] ? "saved-chip" : "missing-chip"}>
                                {secretStatus[selectedSetup]?.[field.key] ? "Saved" : "Missing"}
                              </strong>
                            </span>
                            <input
                              required={field.required}
                              type={field.secret ? "password" : "text"}
                              value={secretValues[field.key] ?? ""}
                              placeholder={field.placeholder}
                              onChange={(event) => setSecretValues((current) => ({ ...current, [field.key]: event.target.value }))}
                            />
                          </label>
                        ))}
                      </div>
                      <p className="safe-note"><strong className="required-star">*</strong> Required for live setup. Saved keys stay hidden for security, so blank fields can still be saved. After filling missing fields, click <strong>Save and Test {serviceLabels[selectedSetup]}</strong>.</p>
                    </>
                  )}
                </>
              ) : (
                <p className="safe-note">{setupGuides[selectedSetup].note}</p>
              )}

              <div className="setup-actions">
                {manualUploadServices.has(selectedSetup) && state.connections[selectedSetup] !== "mock" ? (
                  <button className="secondary-button primary-action" onClick={() => mock(selectedSetup)} disabled={busy}>
                    Use Manual Upload Pack
                  </button>
                ) : manualUploadServices.has(selectedSetup) ? (
                  <button className="secondary-button primary-action" onClick={() => testService(selectedSetup)} disabled={busy}>
                    Check Manual Pack
                  </button>
                ) : (secretFields[selectedSetup] ?? []).length && showAdvancedKeys ? (
                  <button className="secondary-button primary-action" onClick={() => saveAndTestService(selectedSetup)} disabled={busy}>
                    Save and Test {serviceLabels[selectedSetup]}
                  </button>
                ) : (secretFields[selectedSetup] ?? []).length ? (
                  <button className="secondary-button primary-action" onClick={() => setShowAdvancedKeys(true)} disabled={busy}>
                    Start Final Setup
                  </button>
                ) : state.connections[selectedSetup] !== "mock" ? (
                  <button className="secondary-button primary-action" onClick={() => mock(selectedSetup)} disabled={busy}>
                    Enable Local Automation
                  </button>
                ) : (
                  <button className="secondary-button primary-action" onClick={() => testService(selectedSetup)} disabled={busy}>
                    Check {serviceLabels[selectedSetup]}
                  </button>
                )}
              </div>

              <div className="helper-actions">
                {selectedSetup === "telegram" && showAdvancedKeys ? (
                  <button className="text-helper-button" onClick={discoverTelegramUser} disabled={busy}>
                    I do not know my numeric Telegram ID
                  </button>
                ) : null}
                {state.connections[selectedSetup] !== "not_configured" ? (
                  <button className="text-helper-button reset-link" onClick={() => resetConnection(selectedSetup)} disabled={busy}>
                    Reset this setup
                  </button>
                ) : null}
              </div>

              {testResult && testResult.service === selectedSetup ? (
                <div className={`test-result ${testResult.ok ? "passed" : "failed"}`}>
                  <strong>{testResult.title}</strong>
                  <p>{testResult.message}</p>
                  {testResult.details?.users?.length ? (
                    <div className="found-users">
                      {testResult.details.users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSecretValues((current) => ({ ...current, TELEGRAM_ALLOWED_USER_IDS: String(user.id) }))}
                        >
                          Use {user.first_name || user.username || "Telegram user"} ID: {user.id}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {testResult.nextSteps.length ? (
                    <ol>
                      {testResult.nextSteps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </section> : null}

        {activeView === "Media" ? <section className="two-column">
          <div className="panel upload-panel" onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) uploadMedia(file);
          }} onDragOver={(event) => event.preventDefault()}>
            <h2>Media Library</h2>
            <p className="safe-note">Output focus: vertical Reels around 30 seconds.</p>
            <label className="upload-button">
              <Upload size={18} /> Upload Media
              <input type="file" accept="video/*,image/*,audio/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMedia(file);
              }} />
            </label>
            <div className="online-collector">
              <strong>Automatic Online Clip Collector</strong>
              <p className="muted">Collect reusable short clips from online sources and save them locally for editing.</p>
              <div>
                <input
                  aria-label="Online clip topic"
                  value={onlineClipTopic}
                  onChange={(event) => setOnlineClipTopic(event.target.value)}
                  placeholder="reading, study, cafe, travel"
                />
                <button className="secondary-button" onClick={() => collectOnlineClipsForTopic()} disabled={busy}>
                  Collect Clips
                </button>
              </div>
            </div>
            <div className="media-list">
              {state.media.map((item) => (
                <article key={item.id}>
                  <strong>{item.filename}</strong>
                  <p>AI detected: {item.aiTags.join(", ")}</p>
                  {item.duration ? <p>Video: {Math.round(item.duration)}s Â· {item.width ?? "?"}x{item.height ?? "?"} Â· {item.technicalMetadata?.fps ?? "?"} fps</p> : null}
                  {item.quality ? <p>Quality score: {item.quality.score}/10{item.quality.warnings.length ? ` Â· ${item.quality.warnings.join(", ")}` : ""}</p> : null}
                  <p>Status: {item.status} Â· Used: {item.usedCount} times</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Final Videos Created</h2>
            {state.productions.length === 0 ? <p className="muted">Run the agent after uploading media. Your 30-second Reel MP4 videos will appear here.</p> : null}
            {state.productions.map((item) => (
              <article className="production-card" key={item.id}>
                <video controls preload="metadata" src={assetUrl(item.renderPath)} poster={assetUrl(item.thumbnailPath)} />
                <div>
                  <strong>{item.topic}</strong>
                  <p className="muted">{formatDate(item.createdAt)}</p>
                  <p>
                    Quality: {item.qualityReport?.ready ? "Ready for upload" : item.validation?.passed ? "Passed" : "Needs attention"}
                    {item.qualityReport?.score !== undefined ? ` · ${item.qualityReport.score}/100` : ""}
                  </p>
                  {item.qualityReport ? <p className="muted">
                    {Math.round(item.qualityReport.durationSeconds ?? 0)}s · {item.qualityReport.width ?? "?"}x{item.qualityReport.height ?? "?"} · {item.qualityReport.summary}
                  </p> : null}
                  {item.qualityReport?.checks?.length ? (
                    <div className="quality-check-grid">
                      {item.qualityReport.checks.slice(0, 6).map((check) => (
                        <span className={check.passed ? "quality-ok" : "quality-fail"} key={check.name}>
                          {check.passed ? "OK" : "Fix"} {check.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.voiceStrategy ? <p>Voice: {item.voiceStrategy.replace(/_/g, " ").toLowerCase()}</p> : null}
                  {item.voiceQualityWarning ? <p className="muted">{item.voiceQualityWarning}</p> : null}
                  {item.qualityScore ? <p>Story {item.qualityScore.story ?? "-"}/10 · Hook {item.qualityScore.hook ?? "-"}/10 · Visual variety {item.qualityScore.visualVariety ?? "-"}/10</p> : null}
                  <a href={assetUrl(item.renderPath)} target="_blank" rel="noreferrer">Open MP4</a>
                </div>
              </article>
            ))}
          </div>
        </section> : null}

        {activeView === "Posts" ? <section className="two-column">
          <div className="panel">
            <h2>Latest Renders</h2>
            {state.productions.length === 0 ? <p className="muted">Rendered MP4s will appear after the agent runs.</p> : null}
            {state.productions.slice(0, 3).map((item) => (
              <article className="media-list" key={item.id}>
                <strong>{item.topic}</strong>
                <p>Mode: {item.productionMode ?? "Professional short"}</p>
                <p>MP4: {item.renderPath}</p>
                {item.thumbnailPath ? <p>Cover: {item.thumbnailPath}</p> : null}
                <p>Quality: {item.validation?.passed ? "Passed" : "Needs attention"}</p>
                {item.voiceStrategy ? <p>Voice: {item.voiceStrategy.replace(/_/g, " ").toLowerCase()}</p> : null}
                {item.qualityScore ? <p>Scores: Story {item.qualityScore.story}/10 Â· Hook {item.qualityScore.hook}/10 Â· Visual variety {item.qualityScore.visualVariety}/10</p> : null}
              </article>
            ))}
          </div>
          <div className="panel">
            <h2>Voice-over</h2>
            {state.productions[0] ? (
              <p className="muted">{state.productions[0].voiceoverScript}</p>
            ) : <p className="muted">The Script Writer creates voice-over separately from captions.</p>}
          </div>
        </section> : null}

        {activeView === "Agent Activity" ? <section className="consent-band">
          <h2>Agent Activity</h2>
          {state.events.length === 0 ? <p className="muted">Activity will appear as the agent works.</p> : null}
          {state.events.slice(0, 8).map((event) => (
            <p className="activity-row" key={event.id}><span>{new Date(event.time).toLocaleTimeString()}</span>{event.message}</p>
          ))}
        </section> : null}

        {activeView === "Brand" ? <section className="two-column">
          <div className="panel">
            <h2>Brand</h2>
            {state.brandProfile ? (
              <>
                <p><strong>{state.brandProfile.brandName}</strong></p>
                <p className="muted">{state.brandProfile.website}</p>
                <p>{state.brandProfile.description}</p>
                <p className="tag-row">{state.brandProfile.contentCategories.map((category) => <span key={category}>{category}</span>)}</p>
              </>
            ) : <p className="muted">Analyze your website first.</p>}
          </div>

          <div className="panel">
            <h2>Created Posts</h2>
            {state.posts.length === 0 ? <p className="muted">After you run the agent, every created caption and post plan will be saved here.</p> : null}
            {state.posts.map((post) => (
              <article className="saved-post-card" key={post.id}>
                <div className="post-row">
                  <strong>{post.platform}</strong>
                  <span>{post.topic}</span>
                  <span>{post.status}</span>
                </div>
                <p>{post.caption}</p>
                {post.scheduledPublishAt ? <p className="muted">Planned upload: {formatDate(post.scheduledPublishAt)}</p> : null}
                {post.telegramApprovalDueAt ? <p className="muted">Telegram approval: 1 hour before upload</p> : null}
                {post.telegramApprovalSentAt ? <p className="ok">Sent to Telegram: {formatDate(post.telegramApprovalSentAt)}</p> : null}
                <p className="muted">{formatDate(post.createdAt)}</p>
              </article>
            ))}
          </div>
        </section> : null}

        {activeView === "Calendar" ? <section className="panel">
          <h2>Calendar</h2>
          <p className="muted">Default low-cost schedule: prepare content in the morning, review posts at evening slots, then publish after real platforms are connected.</p>
          <div className="post-row"><strong>Today</strong><span>{state.topics.today?.topic ?? "fallback topic"}</span><span>{state.topics.today?.source ?? "calendar"}</span></div>
        </section> : null}

        {activeView === "Analytics" ? <section className="panel">
          <h2>Analytics</h2>
          <p className="muted">Real analytics appear after official social APIs are connected and posts exist.</p>
        </section> : null}

        {activeView === "Settings" ? <section className="two-column">
          <div className="panel">
            <h2>Settings</h2>
            <p>Monthly budget: ${state.autopilot.monthlyBudget.toFixed(2)}</p>
            <p>Publishing mode: {Object.values(state.connections).some((value) => value === "connected") ? "live/local" : "local review"}</p>
            <p>Autopilot: {state.autopilot.enabled ? "On" : "Off"}</p>
          </div>
          <div className="panel">
            <h2>Real Account Setup</h2>
            <p className="muted">Use Live checks local credentials. It does not publish. First real publishing still requires your explicit approval.</p>
            <p>Background worker: <code>npm run worker</code></p>
            <p>Telegram polling: <code>npm run telegram:poll</code></p>
          </div>
          <div className="panel">
            <h2>Data Storage</h2>
            <p><strong>Login and account keys:</strong> remembered privately on this computer in <code>.env.local</code>.</p>
            <p><strong>Videos, renders, and post history:</strong> stored locally in <code>uploads</code>, <code>outputs</code>, and <code>data</code>.</p>
            <p className="muted">Firebase/Vercel can store account settings later after you create those projects and add their credentials. Large video files should stay local to save budget.</p>
          </div>
        </section> : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

