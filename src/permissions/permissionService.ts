import { PermissionLedgerEntry, PermissionType, Platform } from "../domain";

export class PermissionService {
  constructor(private readonly ledger: PermissionLedgerEntry[] = []) {}

  hasPermission(type: PermissionType, platform?: Platform): boolean {
    return this.ledger.some((entry) => (
      entry.type === type &&
      entry.granted &&
      !entry.revokedAt &&
      (!platform || entry.platform === platform)
    ));
  }

  requirePermission(type: PermissionType, platform?: Platform): void {
    if (!this.hasPermission(type, platform)) {
      throw new Error(`Missing required permission: ${type}${platform ? `:${platform}` : ""}`);
    }
  }

  grant(entry: PermissionLedgerEntry): void {
    this.ledger.push(entry);
  }

  list(): PermissionLedgerEntry[] {
    return [...this.ledger];
  }
}
