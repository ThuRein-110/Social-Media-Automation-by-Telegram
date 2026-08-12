export type TelegramCommand =
  | { type: "START" | "HELP" | "STATUS" | "CALENDAR" | "LASTPOST" | "PACKAGE" | "QUALITY" | "ANALYTICS" | "APPROVE" | "PAUSE" | "RESUME" | "EMERGENCY_STOP" }
  | { type: "SET_TOPIC"; date: "today" | "tomorrow"; topic: string }
  | { type: "NO_POST"; date: "today" | "tomorrow" };

export function parseTelegramCommand(text: string): TelegramCommand {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const exact: Record<string, TelegramCommand> = {
    "/start": { type: "START" },
    "/help": { type: "HELP" },
    "/status": { type: "STATUS" },
    "/calendar": { type: "CALENDAR" },
    "/lastpost": { type: "LASTPOST" },
    "/package": { type: "PACKAGE" },
    "/quality": { type: "QUALITY" },
    "/analytics": { type: "ANALYTICS" },
    "/approve": { type: "APPROVE" },
    "/pause": { type: "PAUSE" },
    "/resume": { type: "RESUME" },
    "/emergency_stop": { type: "EMERGENCY_STOP" }
  };
  if (exact[lower]) return exact[lower];
  if (lower === "approve") return { type: "APPROVE" };
  if (lower === "send video pack" || lower === "send latest package" || lower === "send latest video") return { type: "PACKAGE" };
  if (lower === "check quality" || lower === "quality check" || lower === "latest video quality") return { type: "QUALITY" };

  const slashTopic = trimmed.match(/^\/(today|tomorrow)\s+(.+)$/i);
  if (slashTopic) return { type: "SET_TOPIC", date: slashTopic[1].toLowerCase() as "today" | "tomorrow", topic: slashTopic[2].trim() };

  const naturalTopic = lower.match(/^(?:today|tomorrow)\s+(?:is|post about|content about)\s+(.+)$/i);
  if (naturalTopic) return { type: "SET_TOPIC", date: lower.startsWith("tomorrow") ? "tomorrow" : "today", topic: naturalTopic[1].trim() };

  const makeTopic = lower.match(/^make\s+(today|tomorrow)'?s?\s+content\s+about\s+(.+)$/i);
  if (makeTopic) return { type: "SET_TOPIC", date: makeTopic[1] as "today" | "tomorrow", topic: makeTopic[2].trim() };

  if (lower.includes("don't post anything today") || lower.includes("do not post anything today")) {
    return { type: "NO_POST", date: "today" };
  }

  throw new Error("Unsupported Telegram command.");
}

export function isTelegramAuthorized(userId: string, chatId: string, allowedUserIds: string[], allowedChatIds: string[] = []): boolean {
  return allowedUserIds.includes(userId) && (allowedChatIds.length === 0 || allowedChatIds.includes(chatId));
}
