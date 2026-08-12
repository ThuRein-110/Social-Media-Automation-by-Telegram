# Video

The workflow creates a validated 9:16 `VideoEditPlan` from uploaded media and the selected topic. FFmpeg is detected by `npm run doctor`; when FFmpeg is missing, the system uses mock render mode so the workflow remains testable at zero cost.

AI or user input never becomes a shell command.

Uploaded videos are inspected with FFprobe. The media library stores duration, width, height, FPS, codec, audio presence, file size, and quality warnings so the agent can prefer better raw footage.
