# API Integrations

The local MVP uses mock-safe integrations by default:

- Telegram: mock command endpoint now; real bot requires a Telegram bot token and allowed user IDs.
- AI: local rule-based planning now; real provider requires an API key and cost limits.
- Storage: local `uploads/` now; cloud storage requires approval.
- Social platforms: mock publishing now; live adapters must use official OAuth APIs.

No real external account is created without explicit approval.
