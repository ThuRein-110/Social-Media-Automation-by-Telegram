import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "../src/telegram/commands";
import { telegramMenuAction } from "../server/telegramRuntime";

describe("real Telegram command support", () => {
  it("supports natural topic commands used by polling runtime", () => {
    expect(parseTelegramCommand("today is reading vlog")).toEqual({
      type: "SET_TOPIC",
      date: "today",
      topic: "reading vlog"
    });
  });

  it("maps button labels to Telegram commands", () => {
    expect(telegramMenuAction("Status")).toBe("/status");
    expect(telegramMenuAction("Review Latest Post")).toBe("/lastpost");
    expect(telegramMenuAction("Approve Latest")).toBe("APPROVE");
  });
});
