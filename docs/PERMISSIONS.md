# Permissions

Permissions are explicit ledger entries. Runtime actions call `PermissionService.requirePermission()` before Telegram control, AI generation, video rendering, publishing, analytics, deletion, paid services, cloud deployment, or Autopilot.

Autopilot never grants or expands its own permissions.
