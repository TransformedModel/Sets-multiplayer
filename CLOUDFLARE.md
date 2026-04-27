# Deploy Online Set on Cloudflare (Pages + Worker)

This repo uses **Cloudflare Pages** for the static React client and a **Cloudflare Worker + Durable Object** for the WebSocket game server (see [`cloudflare/set-game/`](cloudflare/set-game/)).

## 1. Deploy the game Worker (WebSocket API)

```bash
cd cloudflare/set-game
npm install
npx wrangler login   # once per machine
npx wrangler deploy
```

After deploy, Wrangler prints a URL like `https://sets-game.<your-subdomain>.workers.dev` (the Worker `name` in [`wrangler.toml`](cloudflare/set-game/wrangler.toml) must match your Workers Builds project name if you use CI).

- **Health check:** `GET https://<worker-host>/health` → `{ "ok": true }`
- **WebSocket:** connect to `wss://<worker-host>/` (same host, `Upgrade: websocket`). The client uses the root URL with no path.
- **Browser:** Opening `https://<worker-host>/` in a tab shows a short HTML explainer (this URL is **not** the game UI). Play from your **Pages** URL after building with `VITE_WS_URL` above.

**Workers Builds / CI:** Use only `CLOUDFLARE_API_TOKEN` (or the dashboard token Workers injects). Do **not** run `npx wrangler login` in the build step—when `CLOUDFLARE_API_TOKEN` is set, Wrangler refuses OAuth login. Build can be `npm ci` (or `npm install`); deploy step: `npx wrangler deploy`.

First deploy creates the Durable Object migration (`GameHub`) using **`new_sqlite_classes`** (required on the Workers free plan; `new_classes` fails with API error 10097). Do not rename `class_name` in [`wrangler.toml`](cloudflare/set-game/wrangler.toml) without a follow-up migration.

Optional: run `npx wrangler types` in `cloudflare/set-game` after changing bindings; the generated `worker-configuration.d.ts` is gitignored—this repo uses a small hand-written [`src/env.d.ts`](cloudflare/set-game/src/env.d.ts) instead.

### Custom domain for the Worker (e.g. `sets-game.yourdomain.com`)

The Pages hostname and the WebSocket hostname are **different** unless you use advanced routing. A subdomain like `sets-game.niharikakohli.com` must be bound to the **Worker** (`sets-game`), **not** to the Pages project.

1. Dashboard → **Workers & Pages** → select the **`sets-game` Worker** (not your Pages project).
2. **Settings** → **Domains & Routes** (or **Triggers** → **Custom Domains**, depending on dashboard version) → **Add** → enter `sets-game.niharikakohli.com` and complete the flow so the zone gets the correct DNS (hostname should be **proxied** / orange cloud when using Cloudflare DNS).
3. Wait until TLS is active, then verify in a terminal:
   - `curl -sS https://sets-game.niharikakohli.com/health` → `{"ok":true}`
4. In **Pages** → your site → **Settings** → **Environment variables** (Production), set **`VITE_WS_URL`** to exactly:
   - `wss://sets-game.niharikakohli.com`  
   (no quotes in the dashboard value; trailing `/` is optional.)
5. **Redeploy** the Pages project (or push an empty commit) so the client **rebuilds** with that variable. Changing `VITE_WS_URL` alone does not update an already-built `dist` until the next build.

If `/health` works in the browser but the game stays on “Connecting…”, the live bundle was almost certainly built **without** `VITE_WS_URL` (it would then default to `wss://<your-pages-host>`, which does not run this Worker).

## 2. Build the client with the correct WebSocket URL

The browser must know where the Worker lives. Set **`VITE_WS_URL`** at **build time** (Vite inlines `import.meta.env`).

Example (replace host with your worker or custom domain):

```bash
cd client
VITE_WS_URL=wss://sets-game.your-subdomain.workers.dev npm run build
```

Rules:

- Use **`wss://`** in production (HTTPS site → secure WebSocket).
- **No trailing path** unless you change the Worker to mount the socket on a path (default is `/`).
- If you change the Worker URL, **rebuild the client** and redeploy Pages so the bundle picks up the new value.

Local UI against a remote Worker:

```bash
VITE_WS_URL=wss://sets-game.your-subdomain.workers.dev npm run dev --prefix client
```

## 3. Cloudflare Pages (static SPA)

Connect the Git repo (or upload) and configure:

| Setting | Value |
|--------|--------|
| Root directory | `client` (or repo root; see below) |
| Build command | `npm ci && npm run build` (if root is `client`) **or** `npm ci --prefix client && npm run build --prefix client` (if root is repo) |
| Build output directory | `dist` (if root is `client`) **or** `client/dist` (if root is repo) |

SPA routing files in [`client/public/`](client/public/) are copied into `dist`:

- [`_redirects`](client/public/_redirects) — `/* /index.html 200` so client routes resolve to the app (static files such as `/assets/*` still win over the splat rule on Pages).
- [`_routes.json`](client/public/_routes.json) — optional; reserved if you add Pages Functions later.

Set **environment variables** for the build in Pages only if you inject them into the build command (e.g. `VITE_WS_URL=... npm run build`). Pages “Variables” for runtime do not replace Vite’s build-time `import.meta.env` unless you add a custom build step.

## 4. Optional: keep Node server for local dev

`npm run dev` from the repo root still runs **Express + ws** on port 4000 and Vite on 5173. The Worker is only required for the Cloudflare deployment path.

## 5. Verification

1. Open the Pages URL, create a room, confirm no WebSocket errors in the network tab (`101` on WS).

If the browser reports `WebSocket connection to 'wss://…' failed` but `GET /health` works, the Worker may be answering the WebSocket handshake with **`200` HTML** instead of **`101`**. The entry Worker must handle `Upgrade: websocket` **before** any “friendly `GET /` page” branch (a handshake is still `GET /`).
2. Second browser (or incognito): join with code, host starts, play a full round including invalid set and host reshuffle.

## 6. WebSocket resilience (manual QA)

The client persists `{ roomCode, playerId }` in `sessionStorage`, sends `{ type: 'reconnect' }` after drops, retries with backoff, and JSON **`ping` / `pong`** every 25s (Worker and Node resolve `ping`). Server logs JSON lines `{ "event":"ws_close", ... }` on disconnect.

Use these scenarios after deploy or with local `npm run dev`:

| Scenario | What to verify |
|---------|----------------|
| Brief offline | Mid-game, toggle Wi‑Fi off ~2s then on; banner shows “Reconnecting…”; play resumes without refresh. |
| Background tab | Leave the game tab in background 2–5 min (desktop); return and confirm connection recovers or banner clears. |
| Refresh mid-game | Reload the page during an in‑progress game (same browser tab); you should land back in lobby or game with state restored from the DO / Node server. |
| Gone room | After everyone leaves / room expired on dev server, stale session should show an error and clear resume (no infinite spinner). |

**DevTools:** Network → WS → inspect close **code** (e.g. `1006` abnormal). Browser console warns `[ws close]` with code and `visibility` state in development builds.
