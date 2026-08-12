export interface AuditEvent {
  timestamp: string;
  actor: string;
  agent: string;
  action: string;
  resource: string;
  inputSummary?: string;
  result?: string;
  error?: string;
  permissionUsed?: string;
  jobId?: string;
  costEstimate?: number;
}

export class AuditLog {
  private readonly events: AuditEvent[] = [];

  record(event: Omit<AuditEvent, "timestamp">): AuditEvent {
    const saved = { ...event, timestamp: new Date().toISOString() };
    this.events.push(saved);
    return saved;
  }

  list(): AuditEvent[] {
    return [...this.events];
  }
}
