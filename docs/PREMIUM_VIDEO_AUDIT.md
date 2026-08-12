# Premium Video V3 Audit

## Current Problems
- The renderer is reliable enough for local MP4 generation, but it still relies on one large FFmpeg filter graph for layout, color, captions, and audio.
- Clip selection is now title-aware, but the local library is small, so semantic matching is limited by available rights-cleared footage.
- Voice quality is constrained by Windows SAPI. Pace can be controlled, but true premium human-like performance needs an external provider or authorized recorded voice library.
- Quality review extracts frames and checks metadata, but it does not yet perform full computer-vision subject tracking.
- Platform exports are copied from the master and need explicit spec validation.

## Root Causes
- The app started as a low-cost local automation tool, so it favors deterministic FFmpeg and local files over premium provider integrations.
- The rights-safe media pool is intentionally narrow. This protects accounts, but makes variety harder until more licensed/user footage is added.
- Subtitle rendering originally used FFmpeg subtitle filters, which behaved inconsistently on Windows. It now uses safer timed drawtext files.

## Architecture Changes
- Add premium production profiles: `PREMIUM_CINEMATIC_V1`, `PREMIUM_FAST_V1`, and default `PREMIUM_REEL_V1`.
- Add platform exporters that validate master files before producing Instagram, TikTok, and YouTube Shorts exports.
- Add premium quality scoring over hook, story, clip relevance, crop, color, audio, subtitles, pacing, technical quality, and rights.
- Keep FFmpeg for video/audio processing, but make inputs structured and validated before render.
- Add first-cut review metadata and a second-pass decision gate before sending Telegram packages.

## What Can Be Reused
- Local media database, uploads, outputs, Telegram delivery, and `.env.local` secret handling.
- Current title-aware concept profile and clip scoring.
- Current subtitle text-file drawtext approach.
- Current frame extraction reviewer.
- Current high-quality H.264/AAC render settings.

## What Must Be Replaced
- Single-pass “successful render means done” behavior.
- Copy-only platform export with no validation.
- Generic production quality score that does not model premium categories.
- Any silent fallback to weak unrelated visuals.

## Implementation Order
- P0: Premium profile selection, platform validation, rights gate, premium quality scoring.
- P1: Voice pacing and measured duration, semantic scenes, stronger shot planning.
- P2: Audio mix and subtitle safety, color matching heuristics.
- P3: First-cut review and automatic revision plan.
- P4: Platform exports and Telegram package delivery.

## Quality Benchmarks
- Vertical 1080x1920, 9:16, 30 FPS.
- Reel duration normally 24-32 seconds unless profile chooses otherwise.
- Voice pace around 165-190 WPM for normal cinematic/creator content.
- First frame must not be black and must show visible motion/subject.
- Subtitles must be readable on phone, one line preferred, two lines maximum.
- All visual assets must be local/user-owned or rights-cleared with metadata.
- No render is accepted if rights fail, video is non-vertical, audio is missing, or subtitles collide badly.
