# Cloudflare Pages + D1 Deployment

This project deploys to Cloudflare Pages with Pages Functions and a D1 database.

## Project Values

- Pages project: `meeting-assistant`
- D1 database: `meeting-assistant-db`
- D1 binding: `DB`
- Build output: `dist`

## One-Time Setup

```powershell
npm install
npx wrangler login
npx wrangler d1 create meeting-assistant-db
```

Copy the returned `database_id` into `wrangler.toml`.

## Initialize Remote Database

```powershell
npx wrangler d1 execute meeting-assistant-db --remote --file=./schema.sql
npm run d1:seed
npx wrangler d1 execute meeting-assistant-db --remote --file=./migrations/seed-from-json.sql
```

## Configure Access Token

Set `MEETING_ACCESS_TOKEN` as a Pages secret:

```powershell
npx wrangler pages secret put MEETING_ACCESS_TOKEN --project-name meeting-assistant
```

The browser will ask for this token the first time the protected API returns 401.

## Deploy

```powershell
npm run deploy
```

## Verify

```powershell
curl.exe https://meeting-assistant.pages.dev/api/health
curl.exe https://meeting-assistant.pages.dev/api/meetings?month=2026-06 -H "Authorization: Bearer <token>"
```

## Backup

Export D1 regularly:

```powershell
npx wrangler d1 export meeting-assistant-db --remote --output=backup.sql
```
