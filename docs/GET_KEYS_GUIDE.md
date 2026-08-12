# How To Get Keys And IDs

## Telegram

1. Open Telegram.
2. Message `@BotFather`.
3. Send `/newbot`.
4. Copy the bot token.
5. Paste it into Telegram setup.
6. Send `/start` to your new bot.
7. Click `Find Telegram User ID` in the app.
8. Click the found user ID, save, then test.

Important: your Telegram user ID is a number, not your bot username.

## Redirect URLs

Use these local redirect URLs while developing:

- Meta / Instagram / Facebook: `http://127.0.0.1:8787/api/oauth/meta/callback`
- Google / YouTube: `http://127.0.0.1:8787/api/oauth/google/callback`
- TikTok: `http://127.0.0.1:8787/api/oauth/tiktok/callback`

## Instagram / Facebook

1. Go to Meta for Developers.
2. Create an app.
3. Copy the App ID and App Secret from app settings.
4. Add the Meta redirect URL to OAuth settings.
5. Paste the values into the app.
6. Click `Test Connection`.

## YouTube

1. Go to Google Cloud Console.
2. Create/select a project.
3. Enable YouTube Data API v3.
4. Create OAuth Client ID for a web application.
5. Add the Google redirect URL to Authorized redirect URIs.
6. Copy Client ID and Client Secret.
7. Paste the values into the app.

## TikTok

1. Go to TikTok for Developers.
2. Create an app.
3. Copy Client Key and Client Secret.
4. Add the TikTok redirect URL.
5. Request posting scopes if you need direct publishing.
6. Paste the values into the app.
