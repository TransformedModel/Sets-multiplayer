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

### Custom domain for the Worker

In the Cloudflare dashboard: Workers & Pages → your worker → Settings → Triggers → Custom Domains (e.g. `set-api.example.com`). Use that hostname as `VITE_WS_URL` below (with `wss://`).

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
2. Second browser (or incognito): join with code, host starts, play a full round including invalid set and host reshuffle.
