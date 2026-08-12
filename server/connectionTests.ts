import { secretRequirements } from "./secrets";

export interface ConnectionTestResult {
  service: string;
  ok: boolean;
  title: string;
  message: string;
  nextSteps: string[];
  details?: Record<string, unknown>;
}

function missingFor(service: string) {
  return (secretRequirements[service] ?? []).filter((key) => !process.env[key]);
}

export async function testConnection(service: string): Promise<ConnectionTestResult> {
  const missing = missingFor(service);
  if (missing.length) {
    return {
      service,
      ok: false,
      title: "Missing required values",
      message: `${service} cannot be tested yet.`,
      nextSteps: [`Fill: ${missing.join(", ")}`, "Save private keys", "Run the test again"]
    };
  }

  if (service === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const allowed = process.env.TELEGRAM_ALLOWED_USER_IDS!;
    if (!/^\d+(,\d+)*$/.test(allowed.trim())) {
      return {
        service,
        ok: false,
        title: "Telegram user ID must be numeric",
        message: "You entered something that looks like a username. Telegram allowed user IDs must be numbers.",
        nextSteps: ["Send any message to your bot", "Click Find Telegram User ID", "Save the numeric ID it finds"]
      };
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as { ok?: boolean; result?: { username?: string; id?: number }; description?: string };
    return {
      service,
      ok: Boolean(data.ok),
      title: data.ok ? "Telegram bot works" : "Telegram bot test failed",
      message: data.ok ? `Connected to @${data.result?.username}.` : data.description ?? "Telegram rejected the bot token.",
      nextSteps: data.ok ? ["Send your bot /start from Telegram", "Use Telegram commands after webhook/polling is enabled"] : ["Check the BotFather token", "Save it again", "Run the test again"],
      details: data.ok ? { botId: data.result?.id, username: data.result?.username } : undefined
    };
  }

  if (["instagram", "facebook", "youtube", "tiktok"].includes(service)) return {
    service,
    ok: true,
    title: "Manual upload pack ready",
    message: "The agent will prepare the Reel/Short MP4, caption, and hashtags. You upload manually.",
    nextSteps: ["Run the agent", "Open Media for the MP4", "Open Brand for the caption"]
  };

  if (service === "ai") {
    return {
      service,
      ok: true,
      title: "AI key is saved",
      message: "The API key is present locally. A live model call test can be added after budget limits are confirmed.",
      nextSteps: ["Set daily/monthly AI budget", "Use live AI only when you are ready for usage-based cost"]
    };
  }

  return {
    service,
    ok: true,
    title: "Local service ready",
    message: "This service works locally.",
    nextSteps: []
  };
}

export async function discoverTelegramUsers(): Promise<ConnectionTestResult> {
  const missing = missingFor("telegram").filter((key) => key !== "TELEGRAM_ALLOWED_USER_IDS");
  if (missing.length) {
    return {
      service: "telegram",
      ok: false,
      title: "Bot token required",
      message: "Save your BotFather token first.",
      nextSteps: ["Paste Bot token from BotFather", "Save private keys", "Message your bot", "Click Find Telegram User ID"]
    };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await response.json() as { ok?: boolean; result?: Array<{ message?: { from?: { id?: number; username?: string; first_name?: string } } }>; description?: string };
  const users = (data.result ?? [])
    .map((item) => item.message?.from)
    .filter((user): user is { id: number; username?: string; first_name?: string } => Boolean(user?.id));
  const unique = Array.from(new Map(users.map((user) => [user.id, user])).values());
  return {
    service: "telegram",
    ok: Boolean(data.ok && unique.length),
    title: unique.length ? "Telegram user ID found" : "No Telegram user message found",
    message: unique.length ? `Found ${unique.length} Telegram user ID${unique.length === 1 ? "" : "s"}.` : "Send any message to your bot in Telegram, then try again.",
    nextSteps: unique.length ? ["Copy the numeric ID into Your Telegram user ID", "Save private keys", "Test Telegram"] : ["Open your bot in Telegram", "Send /start", "Click Find Telegram User ID again"],
    details: { users: unique }
  };
}
