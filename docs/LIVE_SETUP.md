# Live Setup

Use `Connections -> Use Live` after adding the needed values to your local environment. The app will mark a service `CONNECTED` only when its required values are present.

Easiest path:

1. Open `Connections`.
2. Use the `Enter Keys Locally` form.
3. Choose the service.
4. Paste the values.
5. Click Save.
6. Click `Use Live` on that service.

The app saves values to `.env.local` on this computer. Do not commit or share that file.

## Telegram

Required:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_IDS`

Telegram is free. Create the bot with BotFather, then keep the token private.

## YouTube

Required:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

You also need YouTube Data API v3 enabled in Google Cloud and OAuth consent completed.

## Instagram / Facebook

Required:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`

You also need an Instagram Professional account linked to a Facebook Page. Publishing permissions may require Meta App Review.

## TikTok

Required:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`

Direct posting requires approved TikTok scopes. Draft upload is usually easier than direct publish.

## AI

Required:

- `OPENAI_API_KEY`

Keep cost limits configured before using live AI.

## Important

`Use Live` only checks local setup. It does not publish real content. First real posts still require explicit approval.
