import { handleTelegramText } from "./workflow";
import { loadLocalEnv } from "./secrets";
import { addEvent } from "./localDb";
import fs from "node:fs";
import path from "node:path";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

type ReplyMarkup = {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard: boolean;
  is_persistent?: boolean;
  one_time_keyboard?: boolean;
};

export interface TelegramVideoPackage {
  telegramPackage: true;
  videoPath: string;
  caption: string;
  summary: string;
}

const mainMenu: ReplyMarkup = {
  keyboard: [
    [{ text: "Create Content" }, { text: "Send Video Pack" }],
    [{ text: "Review Latest Post" }, { text: "Check Quality" }],
    [{ text: "Status" }],
    [{ text: "Analytics" }],
    [{ text: "Pause" }, { text: "Resume" }],
    [{ text: "Emergency Stop" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const createMenu: ReplyMarkup = {
  keyboard: [
    [{ text: "Create for Today" }, { text: "Create for Tomorrow" }],
    [{ text: "Back to Menu" }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const emergencyMenu: ReplyMarkup = {
  keyboard: [
    [{ text: "Confirm Emergency Stop" }],
    [{ text: "Cancel" }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const pendingTopic = new Map<number, "today" | "tomorrow">();
const pendingEmergencyStop = new Set<number>();

export function requireConfig() {
  loadLocalEnv();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowed = process.env.TELEGRAM_ALLOWED_USER_IDS;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  if (!allowed) throw new Error("TELEGRAM_ALLOWED_USER_IDS is missing.");
  const allowedIds = new Set(allowed.split(",").map((id) => Number(id.trim())).filter(Boolean));
  if (allowedIds.size === 0) throw new Error("TELEGRAM_ALLOWED_USER_IDS must contain numeric Telegram user IDs.");
  return { token, allowedIds };
}

async function telegramApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json() as T & { ok?: boolean; description?: string };
  if (!response.ok || data.ok === false) throw new Error(data.description ?? `Telegram ${method} failed`);
  return data;
}

export async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: ReplyMarkup) {
  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 3900),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function sendVideoFile(token: string, chatId: number, videoPath: string, caption?: string, replyMarkup?: ReplyMarkup) {
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("video", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), path.basename(videoPath));
  form.set("supports_streaming", "true");
  if (caption) form.set("caption", caption.slice(0, 1024));
  if (replyMarkup) form.set("reply_markup", JSON.stringify(replyMarkup));
  const response = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    body: form
  });
  const data = await response.json() as { ok?: boolean; description?: string };
  if (!response.ok || data.ok === false) throw new Error(data.description ?? "Telegram sendVideo failed");
}

export function telegramMenuAction(text: string): string | undefined {
  const actions: Record<string, string> = {
    "review latest post": "/lastpost",
    "send video pack": "/package",
    "check quality": "/quality",
    status: "/status",
    analytics: "/analytics",
    pause: "/pause",
    resume: "/resume",
    "approve latest": "APPROVE"
  };
  return actions[text.trim().toLowerCase()];
}

function statusText(result: unknown): string {
  if (typeof result === "object" && result && "telegramPackage" in result) {
    return (result as TelegramVideoPackage).summary;
  }
  if (typeof result === "object" && result && "rendered" in result) {
    const workflow = result as { topic?: string; rendered?: { outputPath?: string }; posts?: Array<{ platform: string; status: string }> };
    return [
      `${workflow.topic ?? "Topic"} selected.`,
      "",
      "I'm handling:",
      "- trend/context research",
      "- creative direction",
      "- script and voice-over",
      "- footage selection",
      "- professional editing",
      "- subtitles",
      "- cover thumbnail",
      "- captions and mock scheduling",
      "",
      `Render: ${workflow.rendered?.outputPath ?? "created"}`,
      `Posts: ${workflow.posts?.map((post) => `${post.platform} ${post.status}`).join(", ") || "none"}`
    ].join("\n");
  }
  if (typeof result === "object" && result && "message" in result) return String((result as { message: string }).message);
  return "Command handled.";
}

export async function pollTelegramOnce(offset = 0): Promise<number> {
  const { token, allowedIds } = requireConfig();
  const data = await telegramApi<{ ok: boolean; result: TelegramUpdate[] }>(token, `getUpdates?timeout=20&offset=${offset}`);
  let nextOffset = offset;
  for (const update of data.result) {
    nextOffset = Math.max(nextOffset, update.update_id + 1);
    const message = update.message;
    if (!message?.text || !message.from?.id) continue;
    if (!allowedIds.has(message.from.id)) {
      await sendMessage(token, message.chat.id, "Unauthorized.");
      addEvent(`Rejected Telegram command from unauthorized user ${message.from.id}`, "warning");
      continue;
    }
    try {
      addEvent(`Telegram command received: ${message.text}`);
      const chatId = message.chat.id;
      const text = message.text.trim();
      const lower = text.toLowerCase();

      if (lower === "/start" || lower === "/menu" || lower === "back to menu" || lower === "cancel") {
        pendingTopic.delete(chatId);
        pendingEmergencyStop.delete(chatId);
        await sendMessage(token, chatId, "What would you like me to do? Tap one option below.", mainMenu);
        continue;
      }
      if (lower === "create content") {
        await sendMessage(token, chatId, "When should I create the content?", createMenu);
        continue;
      }
      if (lower === "create for today" || lower === "create for tomorrow") {
        pendingTopic.set(chatId, lower.endsWith("tomorrow") ? "tomorrow" : "today");
        await sendMessage(token, chatId, "Now type only the topic you want, for example: reading vlog");
        continue;
      }
      const topicDate = pendingTopic.get(chatId);
      if (topicDate) {
        pendingTopic.delete(chatId);
        const result = await handleTelegramText(`${topicDate} is ${text}`);
        await sendMessage(token, chatId, statusText(result), mainMenu);
        continue;
      }
      if (lower === "emergency stop") {
        pendingEmergencyStop.add(chatId);
        await sendMessage(token, chatId, "This stops all new automation. Are you sure?", emergencyMenu);
        continue;
      }
      if (lower === "confirm emergency stop" && pendingEmergencyStop.has(chatId)) {
        pendingEmergencyStop.delete(chatId);
        const result = await handleTelegramText("/emergency_stop");
        await sendMessage(token, chatId, statusText(result), mainMenu);
        continue;
      }

      const result = await handleTelegramText(telegramMenuAction(text) ?? text);
      if (typeof result === "object" && result && "telegramPackage" in result) {
        const pack = result as TelegramVideoPackage;
        await sendVideoFile(token, chatId, pack.videoPath, pack.summary, mainMenu);
        await sendMessage(token, chatId, pack.caption, mainMenu);
        continue;
      }
      await sendMessage(token, chatId, statusText(result), mainMenu);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Telegram command failed.";
      addEvent(`Telegram command failed: ${text}`, "error");
      await sendMessage(token, message.chat.id, `I could not complete that yet.\n\nReason: ${text}`, mainMenu);
    }
  }
  return nextOffset;
}

export async function pollTelegramForever() {
  let offset = 0;
  console.log("Telegram polling started. Press Ctrl+C to stop.");
  while (true) {
    try {
      offset = await pollTelegramOnce(offset);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
