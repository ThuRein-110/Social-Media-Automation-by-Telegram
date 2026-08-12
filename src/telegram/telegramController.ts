import { AuditLog } from "../audit/auditLog";
import { PermissionService } from "../permissions/permissionService";
import { isTelegramAuthorized, parseTelegramCommand } from "./commands";

export interface TelegramMessage {
  userId: string;
  chatId: string;
  text: string;
}

export interface TopicStore {
  setTopic(date: "today" | "tomorrow", topic: string, source: string): void;
  pause(reason: string): void;
  resume(): void;
  emergencyStop(): void;
  status(): string;
}

export class TelegramController {
  constructor(
    private readonly allowedUserIds: string[],
    private readonly topicStore: TopicStore,
    private readonly permissions: PermissionService,
    private readonly audit: AuditLog,
    private readonly allowedChatIds: string[] = []
  ) {}

  handle(message: TelegramMessage): string {
    if (!isTelegramAuthorized(message.userId, message.chatId, this.allowedUserIds, this.allowedChatIds)) {
      this.audit.record({
        actor: `telegram:${message.userId}`,
        agent: "TelegramController",
        action: "reject_unauthorized_command",
        resource: message.chatId,
        inputSummary: message.text,
        result: "rejected"
      });
      return "Unauthorized.";
    }
    this.permissions.requirePermission("TELEGRAM_CONTROL");
    const command = parseTelegramCommand(message.text);
    this.audit.record({
      actor: `telegram:${message.userId}`,
      agent: "TelegramController",
      action: "telegram_command",
      resource: message.chatId,
      inputSummary: message.text,
      result: command.type,
      permissionUsed: "TELEGRAM_CONTROL"
    });
    if (command.type === "SET_TOPIC") {
      this.topicStore.setTopic(command.date, command.topic, "telegram");
      return `Today's topic set to: ${command.topic}\nSelecting suitable footage\nCreating content plan\nEditing automatically\nCaption and hashtags will be generated\nUsing today's posting schedule`;
    }
    if (command.type === "APPROVE") return "Approval received. The post remains scheduled for its planned upload time.";
    if (command.type === "NO_POST" || command.type === "PAUSE") {
      this.topicStore.pause(command.type === "NO_POST" ? "telegram_no_post" : "telegram_pause");
      return "Posting paused.";
    }
    if (command.type === "RESUME") {
      this.topicStore.resume();
      return "Posting resumed.";
    }
    if (command.type === "EMERGENCY_STOP") {
      this.topicStore.emergencyStop();
      return "AUTOPILOT STOPPED\nNo new content will be published until /resume is authorized.";
    }
    if (command.type === "STATUS") return this.topicStore.status();
    return "Commands: APPROVE, /today topic, /tomorrow topic, /quality, /status, /pause, /resume, /emergency_stop";
  }
}
