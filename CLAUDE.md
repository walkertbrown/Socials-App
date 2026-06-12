@AGENTS.md

# Venue Photo Triage — project notes

A private, single-user tool (one venue, Facebook + Instagram). Phase 1 only: pull
photos from a Google Drive folder, auto-thumbnail + tag + dedupe them, and let the
user pick keepers on a board. No scheduling, captions, or email — those are later phases.

## Conventions
- **One feature per file. ~300-line ceiling per file.** If a file grows past that, split it.
- Plain, readable code over cleverness. Comments explain *why*, not *what*.
- This is **Next.js 16** — Middleware is now `proxy.ts`; `cookies()` is async. Check
  `node_modules/next/dist/docs/` before assuming an older API.

## Structure
- `proxy.ts` — auth gate (runs before requests; redirects logged-out users to /login).
- `app/login` — the single login screen (no sign-up).
- `app/board` — the triage board (`page.tsx` loads data; `board-client.tsx` is the UI).
- `app/api/sync` — lists new Drive files, inserts placeholder rows, returns ids to process.
- `app/api/process` — processes **one** photo per call (thumbnail → hash → one vision tag).
- `app/api/thumb/[id]` — auth-gated redirect to a signed thumbnail URL.
- `app/api/photos/pick` — toggle a photo's "picked" flag.
- `lib/supabase` — `admin` (service role, server-only), `server` (auth), `client` (browser).
- `lib/drive` — Drive auth + recursive image listing + single-file download.
- `lib/process` — thumbnail, perceptual hash + dedupe grouping, vision tag, orchestrator.
- `lib/db/photos.ts` — all photo table reads/writes.
- `supabase/migrations` — the schema.

## Cost / correctness rules (do not break)
- **Idempotency:** `process-photo` skips any photo already `ready`; `insertPlaceholders`
  ignores known `drive_file_id`s. A re-sync must never re-download or re-tag a known photo.
- **Thumbnails only** live in Supabase Storage. Originals stay in Drive.
- **One photo per `/api/process` call** — never loop the heavy work inside one request.
- Serve thumbnails with a plain `<img>` (not `next/image`) — they're already sized.
