# Cloudflare Pages D1 Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the meeting assistant to Cloudflare Pages with D1-backed APIs and basic access protection.

**Architecture:** Keep the existing Vue frontend and replace the deployment backend with Cloudflare Pages Functions. Shared API helpers handle validation, auth, serialization, markdown export, and D1 CRUD so route files stay small and testable.

**Tech Stack:** Vue 3, Vite, Cloudflare Pages Functions, D1, Wrangler, Node built-in test runner.

---

### Task 1: Add API Helper Tests

**Files:**
- Create: `tests/meeting-api.test.js`
- Modify: `package.json`

- [ ] Add a `test` script that runs `node --test`.
- [ ] Write failing tests for authorization, payload validation, attendee serialization, markdown rendering, and D1 update-by-id behavior.
- [ ] Run `npm test` and confirm the tests fail because the shared helper module does not exist yet.

### Task 2: Implement Shared D1 API Layer

**Files:**
- Create: `functions/_shared/meetings.js`

- [ ] Implement token authorization with optional `MEETING_ACCESS_TOKEN`.
- [ ] Implement meeting payload validation.
- [ ] Implement row serialization and deserialization.
- [ ] Implement CRUD helper functions using `context.env.DB`.
- [ ] Implement Markdown export helpers.
- [ ] Run `npm test` and confirm all helper tests pass.

### Task 3: Add Pages Functions Routes

**Files:**
- Create: `functions/api/health.js`
- Create: `functions/api/meetings/index.js`
- Create: `functions/api/meetings/[id].js`
- Create: `functions/api/meetings/[id]/export.js`
- Create: `functions/api/meetings/export/month.js`

- [ ] Add `/api/health` to prove the D1 binding works.
- [ ] Add `/api/meetings` GET and POST.
- [ ] Add `/api/meetings/:id` GET, PUT, and DELETE.
- [ ] Add single-meeting and monthly Markdown export endpoints.
- [ ] Run `npm test` and `npm run build`.

### Task 4: Add D1 Schema and Data Migration

**Files:**
- Create: `schema.sql`
- Create: `scripts/generate-d1-seed.mjs`
- Create directory: `migrations/`

- [ ] Create D1 `meetings` table and date index.
- [ ] Add a script that reads `data/*.json` and writes `migrations/seed-from-json.sql`.
- [ ] Run the seed generator and inspect generated SQL.

### Task 5: Add Frontend API Token Handling

**Files:**
- Modify: `src/composables/useApi.js`

- [ ] Add bearer token storage in `localStorage`.
- [ ] Prompt for a token on first protected API call.
- [ ] Retry once after a 401 with a fresh token.
- [ ] Ensure blob export requests include the same authorization header.
- [ ] Run `npm run build`.

### Task 6: Add Deployment Configuration and Docs

**Files:**
- Modify: `package.json`
- Create: `wrangler.toml`
- Create: `DEPLOYMENT.md`

- [ ] Add Wrangler as a dev dependency.
- [ ] Add deployment scripts.
- [ ] Document Cloudflare login, D1 create, schema import, data import, secret setup, deploy, and verification commands.

### Task 7: Deploy and Verify

**Files:**
- No source changes expected after this task unless verification reveals a defect.

- [ ] Run `npm install` if dependencies changed.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run Wrangler login if needed.
- [ ] Create or reuse D1 database.
- [ ] Execute `schema.sql` remotely.
- [ ] Execute generated seed SQL remotely.
- [ ] Deploy Pages project.
- [ ] Verify `/api/health`.
- [ ] Verify a protected read endpoint.
- [ ] Report project URL, D1 database name, binding name, and verification output.
