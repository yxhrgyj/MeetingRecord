# Cloudflare Pages D1 Deployment Design

## Goal

Deploy the current meeting assistant as a Cloudflare Pages app with Pages Functions APIs and a D1 database, while preserving the existing Vue UI and meeting data.

## Approach

The existing Express server and `data/*.json` files are useful for local reference, but Cloudflare Pages needs API routes under `functions/` and persistent data in D1. The deployment version will keep the frontend API shape (`/api/meetings`, `/api/meetings/:id`, export endpoints) and move persistence into D1.

## Scope

- Add D1 schema for meeting records.
- Add Pages Functions for health, CRUD, and Markdown export.
- Add a small shared API layer with validation, serialization, markdown rendering, and token authorization.
- Add tests for validation, auth, serialization, and cross-month update behavior.
- Add a migration script that converts existing `data/*.json` files into SQL seed statements.
- Add deployment documentation for build, D1 creation, migration, secret setup, and verification.

## Access Protection

API routes will require `Authorization: Bearer <token>` only when `MEETING_ACCESS_TOKEN` is configured in the Pages environment. The frontend stores the token in `localStorage` and prompts again after a 401. This keeps local development simple while allowing the deployed site to be protected.

## Data Model

D1 stores one row per meeting with the same public shape currently used by the UI. Attendees are stored as JSON text and converted to arrays at API boundaries.

## Deployment

Use direct Wrangler deployment first:

- Project name: `meeting-assistant`
- D1 database name: `meeting-assistant-db`
- D1 binding name: `DB`
- Static output: `dist`

Git-based deployment can be added later once the project is placed in a repository.
