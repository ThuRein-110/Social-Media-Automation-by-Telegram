# Implementation Plan

## Repository Audit

Existing architecture: `D:\Work\automation` was empty and was not a Git repository when inspected. No existing PWA, API, database, auth, storage, deployment config, or integrations were available to preserve.

Reusable components: none found in the workspace.

Problems and risks: production social publishing, OAuth app creation, Telegram bot setup, cloud storage, deployment, billing, DNS, and live posting all require explicit user approval and credentials. FFmpeg is not currently available on PATH.

Minimum-cost integration strategy: start with a TypeScript PWA plus typed server-side modules, local/mock storage, mock publishing by default, in-memory services for development, FFmpeg worker abstraction, and official social API adapters added incrementally after credentials and platform approvals exist.

## P0: Foundation and Safety

- Strict TypeScript project foundation.
- URL validation with SSRF and private-IP blocking.
- Permission ledger and runtime permission checks.
- Audit log.
- Job queue model with idempotency keys.
- Mock social publisher as the default development behavior.
- Video edit plan schema that maps to predefined FFmpeg arguments.
- Cost limit guard.
- Telegram authorization and command parser.

## P1: MVP

- Website URL onboarding.
- Website analyzer that extracts metadata, brand name, description, colors, logo, and categories.
- Brand profile editor.
- Telegram webhook endpoint and bot command handler.
- Media library upload and indexing.
- AI provider adapter for planning, captions, titles, and hashtags.
- FFmpeg worker execution and render status.
- Content validator.
- Scheduler.
- One official publishing adapter after the user grants platform access.

## P2: Professional Video Pipeline

- Trend Intelligence Agent with expiring `TrendAnalysis`.
- Creative Director Agent with validated `CreativeBrief`.
- Script Writer producing separate voice-over, caption, overlays, and hashtags.
- VoiceOverService abstraction with local Windows SAPI default and zero estimated cost.
- Timeline planner with video, voice-over, subtitle, text, music, and SFX tracks.
- Bundled FFmpeg renderer for real 1080x1920 MP4 output.
- Subtitle engine writing SRT files and burning readable subtitles into the render.
- Audio mix with voice-over mapped into the final MP4.
- Quality validation that verifies rendered output exists and is non-empty.
- E2E test that creates test media, runs the topic workflow, and verifies actual MP4 output.

## P3: Platform Expansion and Analytics

- Meta Instagram/Facebook adapters.
- YouTube Shorts adapter.
- TikTok adapter or `PLATFORM_RESTRICTION` workflow where API limits apply.
- Analytics ingestion snapshots.
- Performance learning recommendations.
- Website update detector with opportunity scoring.

## P4: Optimization

- Cloud object storage.
- Local worker reconnect protocol.
- Cloud render worker option.
- Advanced media analysis and transcript caching.
- Multi-user tenancy, database hardening, and production deployment.

## Permission Checklist

- [ ] Repository modification: local scaffold created in this workspace.
- [ ] Install dependencies: required to run build/tests.
- [ ] Database migration: pending database choice.
- [ ] Create Telegram bot: requires user approval.
- [ ] Configure Telegram webhook: requires user approval.
- [ ] Create cloud storage: requires user approval.
- [ ] Create AI API credential: requires user approval.
- [ ] Create Meta developer app: requires user approval.
- [ ] Connect Instagram/Facebook: requires user approval.
- [ ] Create Google OAuth app and connect YouTube: requires user approval.
- [ ] TikTok developer integration: requires user approval and platform review if needed.
- [ ] Deployment: requires user approval.
- [ ] Live social posting: requires user approval.
- [ ] Enable Autopilot: requires final explicit user approval.
