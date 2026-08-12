# Social Media Setup Guide

## Step 1: Use Mock Mode First

Open the app, go to Connections, and click the blue check button for:

- Telegram
- AI
- Storage
- Video Worker
- Instagram
- YouTube

This lets you test the whole workflow for free without posting anything real.

## Step 2: Upload Your Media

Go to Media and upload videos you own or have permission to use.

## Step 3: Test The Agent

Go to Dashboard and run a topic like:

`reading vlog`

The app should create voice-over, subtitles, a vertical MP4 render, captions, and mock scheduled posts.

## Step 4: Real Telegram

Real Telegram needs a bot token from BotFather and your Telegram user ID. Do not paste secrets into public chat or commit them to git.

In the app, go to Connections and click `Use Live` for Telegram after adding the token locally.

## Step 5: Real Social Accounts

Real publishing requires official OAuth:

- Instagram/Facebook: Meta developer app and publishing permissions.
- YouTube: Google Cloud OAuth app and YouTube upload permissions.
- TikTok: developer app and possible platform review.

I will ask permission before creating apps, configuring OAuth, or publishing a real test post.

See `docs/LIVE_SETUP.md` for the exact environment variable names.
