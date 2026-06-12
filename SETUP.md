# Setup — getting the photo triage app running

You'll do this once. None of it is permanent or risky; everything lives in this folder
plus three free accounts (Supabase, Google Cloud, Anthropic). Follow the steps in order.

---

## 0. Install the code's packages
In a terminal, from this folder:

```
npm install
```

(That's the slow step — let it finish. It only downloads libraries into this folder.)

Then copy the example settings file:

```
cp .env.example .env.local
```

You'll paste real values into `.env.local` as you go below.

---

## 1. Supabase (database + thumbnail storage) — free
1. Go to supabase.com, create a free project. Pick any name/region.
2. **Settings → API.** Copy these into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)
3. **SQL Editor → New query.** Open `supabase/migrations/0001_init.sql` from this folder,
   paste its whole contents in, and click **Run**. (That creates the tables + the
   thumbnails storage bucket.)
4. **Authentication → Users → Add user.** Create the one login (her email + a password).
   Tick "auto-confirm" so she can sign in right away. There is no sign-up screen by design.

---

## 2. Google Drive (read the photo folder) — free
1. Go to console.cloud.google.com, create a project.
2. **APIs & Services → Library →** search "Google Drive API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.** Name it
   anything, create it.
4. Open that service account → **Keys → Add key → Create new key → JSON.** A file downloads.
5. From that JSON file, copy into `.env.local`:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (paste the whole thing in quotes,
     exactly as it appears with the `\n` pieces).
6. In Google Drive, open the venue's photo folder → **Share** → paste the service
   account's email (the `client_email` above) → give it **Viewer** → send.
7. Copy the folder's ID from its URL (the part after `/folders/`) → `DRIVE_FOLDER_ID`.

---

## 3. Anthropic (photo tagging) — pennies of usage
1. Go to console.anthropic.com → **API Keys** → create one.
2. Paste it into `.env.local` → `ANTHROPIC_API_KEY`.

---

## 4. Run it
```
npm run dev
```
Open http://localhost:3000, sign in with the user you created in step 1.4, and click
**Sync now**. The first sync pulls in the folder's photos and processes them one by one
(you'll see a "Processing 3/12…" counter). After that, only *new* photos are processed —
re-syncing is free.

---

## Notes
- **Cost:** Supabase + Google are free at this size; tagging runs roughly a tenth of a
  cent per photo and only happens once per photo. Expect under a dollar a month.
- **Going live later:** to put this online (not just your laptop), it deploys to Vercel.
  Vercel's free tier is technically non-commercial, so budget ~$20/mo for their Pro plan
  when it's actually in use. That's a Phase-2 concern, not now.
- **Privacy:** the thumbnail bucket is private; the app serves images through short-lived
  signed links, and every page requires login.
