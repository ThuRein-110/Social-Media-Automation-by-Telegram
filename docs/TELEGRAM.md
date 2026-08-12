# Telegram

Supported commands include `/start`, `/help`, `/status`, `/today`, `/tomorrow`, `/calendar`, `/lastpost`, `/analytics`, `/pause`, `/resume`, and `/emergency_stop`.

Natural language examples include `today is reading vlog`, `make today's content about studying`, and `don't post anything today`.

After saving `TELEGRAM_BOT_TOKEN` and numeric `TELEGRAM_ALLOWED_USER_IDS`, run:

```bash
npm run telegram:poll
```

The polling runtime rejects unauthorized users and replies with render/status results.
