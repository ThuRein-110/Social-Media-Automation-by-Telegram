# Video Pipeline

The agent creates a strict `VideoEditPlan`. The renderer maps that plan to predefined FFmpeg operations for trim, crop, scale, concatenate, subtitles, normalization, and simple transitions.

AI output is never executed as a shell command.
