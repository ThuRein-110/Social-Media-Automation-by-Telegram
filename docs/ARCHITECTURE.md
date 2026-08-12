# Architecture

The system starts as a single TypeScript codebase with clean boundaries. The central orchestrator is `SocialManagerAgent`; specialist modules can later split into separate agents without changing product behavior.

Core boundaries: website analysis, brand profile, Telegram control, permissions, audit, jobs, media, video, social publishing, analytics, and cost control.
