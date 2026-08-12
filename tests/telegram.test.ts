import { describe, expect, it } from "vitest";
import { isTelegramAuthorized, parseTelegramCommand } from "../src/telegram/commands";

describe("Telegram commands", () => {
  it("accepts approval replies with or without a slash", () => {
    expect(parseTelegramCommand("APPROVE")).toEqual({ type: "APPROVE" });
    expect(parseTelegramCommand("/approve")).toEqual({ type: "APPROVE" });
  });

  it("parses slash topic commands", () => {
    expect(parseTelegramCommand("/today reading vlog")).toEqual({
      type: "SET_TOPIC",
      date: "today",
      topic: "reading vlog"
    });
  });

  it("parses natural topic commands", () => {
    expect(parseTelegramCommand("today is reading vlog")).toEqual({
      type: "SET_TOPIC",
      date: "today",
      topic: "reading vlog"
    });
  });

  it("rejects unauthorized user ids", () => {
    expect(isTelegramAuthorized("1", "chat", ["2"])).toBe(false);
  });
});
