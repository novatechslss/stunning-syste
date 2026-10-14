# NOVA TECH MEDIA

Anonymous photo/video hosting on **React + Vite** with **Node.js serverless functions** on Vercel. Files and one metadata JSON per file are stored in **your GitHub repository**. No database. No logins.

> **Honest limits.** GitHub is not a media CDN. Vercel rejects request bodies above ~4.5 MB, so the default (and Vercel maximum) upload size is **4 MB / 4.4 MB**. GitHub's API allows roughly 5,000 authenticated requests/hour and repos should stay small (GitHub recommends under 1 GB). Keep videos short. Public direct links can be downloaded, copied and shared by anyone who has them; nothing here can stop scraping, only slow abuse.

## How it works

| Piece | Route | Auth |
|---|---|---|
| Website upload | `POST /api/web/upload` | none; same-origin check, honeypot, per-IP limit |
| Bot upload | `POST /api/v1/upload` | `Authorization: Bearer KEY` |
| Metadata | `GET /api/v1/media/:id` | API key, or public if `MEDIA_ENABLE_PUBLIC_LOOKUP=true` |
| Recent list | `GET /api/v1/media` | public only if `MEDIA_ENABLE_PUBLIC_LIST=true` (or API key) |
| Delete | `DELETE /api/v1/media/:id` | API key and `MEDIA_ENABLE_DELETE=true` |
| Health / config | `GET /api/v1/health`, `/api/v1/config` | none, secret-free |

Both upload routes share `lib/upload-service.js`: validate (size, extension, MIME, magic bytes) -> secure random ID -> write file (never overwrites; a path conflict retries with a new ID) -> write metadata **only after** the file is confirmed. If metadata fails, the file is rolled back; if rollback fails too, the user is told honestly (`METADATA_FAILED_ORPHAN`).

Storage paths: `img/YYYY/MM/{id}.{ext}`, `videos/YYYY/MM/{id}.{ext}`, `metadata/{id}.json`. IDs start with a base36 timestamp (so the recent list can sort without a catalogue file) followed by 96 random bits.

### Public vs private repository
- **Public repo** (`MEDIA_REPO_VISIBILITY=public`): uploads get a `raw.githubusercontent.com` URL. Anyone with the link can open it.
- **Private repo** (`private`): raw URLs need GitHub auth, so **no public URL is created** (`url: null`); the website says so. Set this value to match the real repo visibility; the app cannot verify it for you.

### No-database consequences
No accounts means no per-user quotas and no private personal gallery. "My Media" shows (a) a public recent list only if you enable it, otherwise (b) uploads made from *this browser* (kept in localStorage).

### Rate limiting (read this)
Limits are counted in **serverless instance memory**: best effort, reset on cold start, not shared across instances. They are **not durable quotas**. For real protection add a **Vercel Firewall rate-limit rule** for `/api/web/upload` and `/api/v1/upload` (Project > Firewall > Rules). The client IP is read from `x-vercel-forwarded-for` only when running on Vercel (or `MEDIA_TRUSTED_PROXY=vercel`). Emergency stop: set `MEDIA_UPLOADS_DISABLED=true` and redeploy.

## Setup from an Android phone
1. **Create the media repo.** GitHub app/browser > New repository (e.g. `nova-media`). Choose Public or Private (see above). Tick "Add a README" so the branch exists.
2. **Upload this project** to a *separate* repo (e.g. `nova-tech-media`): GitHub web > Add file > Upload files. Unzip first, or use Termux (`git`) / a file manager that can unzip. Do not upload `.env`.
3. **Create a fine-grained token**: GitHub > Settings > Developer settings > Personal access tokens > Fine-grained > Generate. Repository access: *Only select repositories* > the media repo. Permissions: **Contents: Read and write** (Metadata read is automatic). Nothing else. Set an expiry and note it.
4. **Vercel env vars**: vercel.com > Add New Project > import `nova-tech-media` > Environment Variables. Add at least `MEDIA_GITHUB_OWNER`, `MEDIA_GITHUB_REPO`, `MEDIA_GITHUB_BRANCH`, `MEDIA_GITHUB_TOKEN`, `MEDIA_REPO_VISIBILITY` (see `.env.example`). Never prefix with `VITE_`.
5. **Deploy.** Vercel detects Vite (`vercel.json` is included).
6. **Test the website**: open the site > Upload Media > pick a small JPG. You should get an ID and (public repo) a link. Confirm the file appears in `img/` and `metadata/` in the media repo.
7. **Create an API key** (needs a computer or Termux with Node): `npm run generate-key -- mybot`. Put the printed `mybot:<hash>` in `MEDIA_API_KEYS` in Vercel, redeploy, give the raw key only to the bot (its environment variable `NOVA_API_KEY`). Test:
   `curl -X POST https://YOUR-SITE.vercel.app/api/v1/upload -H "Authorization: Bearer $NOVA_API_KEY" -F "file=@photo.jpg"`
8. **Troubleshooting**
   - `NOT_CONFIGURED`: a required env var is missing; redeploy after editing vars.
   - `STORAGE_MISCONFIGURED`: token expired, wrong repo/branch, or token lacks *Contents: write*.
   - `FILE_TOO_LARGE`: above `MEDIA_MAX_UPLOAD_MB` (max 4.4 on Vercel).
   - `RATE_LIMITED`: wait for `Retry-After`; raise `MEDIA_*_RATE_LIMIT` if needed.
   - `ORIGIN_NOT_ALLOWED`: calling the website route from another site; use `/api/v1/upload` with a key.
   - `GITHUB_RATE_LIMITED`: GitHub API hourly limit; wait.
   - Images show broken in a private repo: expected, there is no public link.

### Keys: rotate / revoke
`MEDIA_API_KEYS` holds only SHA-256 hashes (`id:hash,id2:hash`). **Rotate**: add a second entry, update the bot, remove the old entry, redeploy. **Revoke**: delete the entry, redeploy. There is no page that creates keys.

## Local development
```
npm install
npm test            # vitest (backend + frontend)
npm run build
npx vercel dev      # runs frontend + /api together (copy .env.example to .env first)
```
`npm run dev` serves only the frontend (it proxies /api to port 3000).

## Security notes
Secrets live only in server env vars. Responses never include tokens, repo paths, stack traces or env values. Filenames are sanitized and storage paths are server-generated; media IDs are regex-validated before use. CORS is closed unless `MEDIA_ALLOWED_ORIGINS` lists an origin (and is never used as authentication). `vercel.json` sets CSP/HSTS/nosniff/frame headers; if you set `MEDIA_PUBLIC_BASE_URL`, previews work because `img-src`/`media-src` allow https. No third-party script receives uploads. Logs contain only error classes/status codes.

## Not verified yet (assumptions)
This project was written **without network access**, so `npm install`, `npm run build`, the vitest suite, and a real Vercel/GitHub deployment have **not** been executed. Only syntax checks and a dependency-free smoke run of validation + the upload pipeline against a fake GitHub were run. Please confirm on first deploy:
- Vercel passes raw multipart bodies to `req` unparsed (busboy reads the stream).
- Vercel Firewall/`x-vercel-forwarded-for` behave as described.
- `raw.githubusercontent.com` serves your videos with a playable content type (small MP4/WebM normally do).
- `git/trees/{branch}:metadata` returns your metadata folder for the public list.
