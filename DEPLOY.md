# Deploy — Tier 2 (free, working demo)

Frontend on Vercel (always up) + backend behind a Cloudflare Tunnel (up while
your machine is up). Real HTTPS on both ends, no cloud bill, no credit card.

**What this gets you:** a public URL anyone can open and actually use.
**What it does not get you:** always-on. Close the tunnel or sleep the laptop
and the API dies. For always-on, see Tier 3 (AWS ECS, ~$50-80/mo).

---

## Why the order matters

Each side needs the other's URL, so it is a two-pass setup:

```
1. Start tunnel        -> get  https://xxx.trycloudflare.com   (API URL)
2. Deploy frontend     -> uses that API URL at BUILD time
                       -> get  https://yyy.vercel.app          (site URL)
3. Allowlist the site  -> gateway CORS + cross-site cookies
4. Restart backend     -> picks up the allowlist
```

Vite inlines `VITE_*` at **build** time, not runtime. Changing the API URL on
Vercel needs a **redeploy**, not just an env edit.

---

## Step 1 — Start the tunnel

Leave this terminal open for the whole session.

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the assigned URL from the output:

```
https://<random-words>.trycloudflare.com
```

No Cloudflare account needed — quick tunnels are anonymous.

> **Quick tunnels get a new random URL on every restart.** Each new URL means a
> frontend redeploy (Step 2) because the API URL is baked into the bundle. If
> that becomes annoying, a free Cloudflare account + named tunnel gives you a
> stable hostname.

Make sure the stack is actually running first:

```bash
docker compose up -d
curl http://localhost:8000/api   # expect {"msg":"gateway"}
```

---

## Step 2 — Deploy the frontend to Vercel

Import `mohan-coder444/Agentic-OS` at [vercel.com/new](https://vercel.com/new).

**Root Directory: `frontend`** — this is the setting people miss. The repo is a
monorepo; without it Vercel builds the wrong folder.

Framework preset, build command, and output dir come from `frontend/vercel.json`.

Set these environment variables (Vercel: Settings -> Environment Variables):

| Variable | Value |
|---|---|
| `VITE_SERVER_URL` | your `https://xxx.trycloudflare.com` from Step 1 |
| `VITE_FIREBASE_API_KEY` | from `frontend/.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | from `frontend/.env` |
| `VITE_FIREBASE_PROJECT_ID` | from `frontend/.env` |
| `VITE_FIREBASE_STORAGE_BUCKET` | from `frontend/.env` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | from `frontend/.env` |
| `VITE_FIREBASE_APP_ID` | from `frontend/.env` |

Deploy, then copy your `https://<project>.vercel.app` URL.

These Firebase `VITE_*` values are client-side by design and ship in the bundle;
Firebase expects that. Backend secrets (`JWT_SECRET`, AWS keys, `MONGO_URI`,
`serviceAccountKey.json`) must **never** appear here — they stay server-side.

---

## Step 3 — Authorize the domain in Firebase

**Google login fails with `auth/unauthorized-domain` until you do this.**
Firebase only accepts sign-in popups from domains it knows, and `localhost` is
the only one trusted out of the box.

Firebase Console -> your project -> **Authentication** -> **Settings** ->
**Authorized domains** -> **Add domain** -> paste your `<project>.vercel.app`
(hostname only, no `https://`, no trailing slash).

---

## Step 4 — Allowlist the frontend and enable cross-site cookies

Create a `.env` in the **repo root** (gitignored, sits next to
`docker-compose.yml`):

```bash
FRONTEND_URLS=http://localhost:5173,https://<project>.vercel.app
CROSS_SITE_COOKIES=true
```

Both matter, for different reasons:

- `FRONTEND_URLS` — the gateway CORS allowlist. `credentials: true` forbids a
  `*` wildcard, so each origin must be listed explicitly. Keeping localhost in
  the list means local dev keeps working at the same time.
- `CROSS_SITE_COOKIES=true` — switches the session cookie to
  `sameSite=none; Secure`. Browsers **refuse** to send a `lax` cookie from
  `vercel.app` to `trycloudflare.com`, so without this you log in and
  immediately appear logged out. `none` requires `Secure`, which requires HTTPS
  — both Vercel and the tunnel provide it, so this only works on the deployed
  pair, never on plain-HTTP localhost.

Apply it:

```bash
docker compose up -d gateway auth
```

Confirm both switches took effect:

```bash
docker logs 1cortexai-gateway-1 | grep "CORS allowlist"
#   [gateway] CORS allowlist: http://localhost:5173, https://<project>.vercel.app

docker logs 1cortexai-auth-1 | grep "session cookies"
#   [auth] session cookies: cross-site (sameSite=none; Secure — requires HTTPS)
```

---

## Step 5 — Verify

Open your Vercel URL and walk the flow:

1. Login with Google — popup completes, avatar appears
2. Refresh the page — still logged in (proves the cross-site cookie round-trips)
3. **+ New chat**, send a message — response comes back
4. Coding pill, send 6 prompts fast — 6th shows the rate-limit message
5. Log out — session actually clears

If something fails, jump to Troubleshooting.

---

## Going back to local-only

Delete the root `.env` (or set `CROSS_SITE_COOKIES=false`) and restart:

```bash
docker compose up -d gateway auth
```

`CROSS_SITE_COOKIES=true` breaks plain-HTTP localhost, because a `Secure` cookie
is not sent over `http://`. Local dev needs it `false`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `auth/unauthorized-domain` on login | Vercel domain not in Firebase | Step 3 |
| Login succeeds, refresh shows logged out | Cookie not sent cross-site | `CROSS_SITE_COOKIES=true`, restart auth |
| CORS error in browser console | Vercel origin not allowlisted | Add to `FRONTEND_URLS`, restart gateway |
| All API calls fail after a restart | Tunnel got a new URL | Update `VITE_SERVER_URL` on Vercel, **redeploy** |
| Login popup opens then hangs | COOP header | Already handled in `frontend/vercel.json` |
| Site loads, every request times out | Stack or tunnel down | `docker compose up -d`, restart `cloudflared` |
| Vercel build fails, cannot resolve imports | Root Directory not set | Set it to `frontend` |

Check the gateway log first — it prints every blocked origin:

```bash
docker logs 1cortexai-gateway-1 --tail 30
```

---

## Known limits

- **Not always-on.** Tunnel and Docker must be running.
- **Tunnel URL is ephemeral.** New URL per restart, so a redeploy per restart.
- **Single machine.** No redundancy, no scaling.
- **S3 downloads** may be blocked by bucket CORS from the Vercel origin. The
  download button falls back to `window.open`, so it degrades rather than
  breaks. To fix properly, add the Vercel origin to the `cortex-ai-pdfs` bucket
  CORS policy.
- **LLM credits still apply.** OpenRouter credits are near exhausted, so the
  coding agent falls through its provider chain and responds slowly.
