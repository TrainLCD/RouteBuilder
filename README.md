# Route Builder

A web companion to the [TrainLCD](https://github.com/TrainLCD/MobileApp) iOS / Android app for assembling custom train routes that span multiple lines and operators, then handing them off to the native app via a deep link.

## Features

- **Incremental station search** against the full TrainLCD nationwide dataset (Japanese name, romaji, or station number)
- **Per-line adjacency-aware insertion** — only stations that physically connect to your current endpoint are addable; cross-operator transfers are handled automatically
- **Automatic gap-filling** via BFS shortest path when a station is removed mid-route
- **AI route generation** (stubbed; pluggable for Claude API) from natural-language prompts
- **Drag-and-drop reordering** with drop validation so the route stays connected
- **Light / dark theme**, **JP / EN** locale, **density** toggle (a "Tweaks" panel)
- **Deep link export** matching the upcoming TrainLCD `sids=` spec ([TrainLCD/MobileApp#6002](https://github.com/TrainLCD/MobileApp/issues/6002)), with QR code generated via [`qrcode`](https://www.npmjs.com/package/qrcode)
- **Canary release toggle** that switches the deep link scheme from `trainlcd://` to `trainlcd-canary://`

## Tech stack

- **Next.js 15** (App Router) — frontend SPA and BFF route handlers in one project
- **React 18** with `'use client'` boundary at the app entry; the page itself ships zero pre-rendered app content (avoids hydration mismatches against `localStorage`)
- **TypeScript** strict mode
- **TrainLCD GraphQL API** as the data source (staging or production), proxied through internal `app/api/trainlcd/*` endpoints
- **In-memory stale-while-revalidate cache** in the BFF, plus a DataLoader-style batcher with split-and-retry to survive upstream timeouts on heavy queries
- **localStorage** for route persistence on the client

## Project layout

```
apps/
└── web/
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css
    │   └── api/trainlcd/        # BFF endpoints (search / stations / line-list-stations / line / station-group)
    ├── components/              # React UI
    ├── lib/
    │   ├── api/                 # Client-side fetch wrapper, DataLoader, in-memory cache
    │   ├── data/                # Routing / adjacency / BFS / sample routes
    │   ├── hooks/               # useLocalStorage, useDataStore, useTweaks, ...
    │   ├── server/              # BFF-only: upstream GraphQL client, SwrCache, split-retry
    │   ├── deeplink.ts          # Deep link URL builder
    │   ├── i18n.ts, route-utils.ts, ai.ts
    │   └── ...
    └── public/brand-icon.png
```

The repo is an **npm workspace** rooted at the top level; everything lives under `apps/web/` to keep room for future apps or shared packages.

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```sh
npm install
```

### Configure

Copy the example env and set the upstream GraphQL endpoint:

```sh
cp apps/web/.env.example apps/web/.env.local
```

Then fill in `TRAINLCD_GRAPHQL_ENDPOINT` in `apps/web/.env.local` with the upstream URL. The frontend never reads this — only the BFF Route Handlers do. The browser only talks to relative `/api/trainlcd/*` paths.

### Run

```sh
npm run dev       # http://localhost:3000
npm run typecheck
npm run build
npm start
```

## Architecture notes

### BFF in front of TrainLCD GraphQL

The upstream API is rate- and timeout-sensitive — heavy queries like `lineListStations` can take 8+ seconds and intermittently return `Request timeout - please try with a smaller pageSize`. Every read flows through `app/api/trainlcd/*` so the server can:

1. **Cache** responses with a 24h fresh / 24h stale window (`lib/server/swr-cache.ts`). Stale reads return immediately and trigger a background refresh.
2. **Batch** requests where the upstream supports it (`stations(ids: [...])`, `lineListStations(lineIds: [...])`).
3. **Split-and-retry** on upstream failure (`lib/server/split-retry.ts`): a chunk that times out is halved and re-issued recursively until size 1.
4. **Set `Cache-Control: s-maxage=86400, stale-while-revalidate=86400`** so a CDN in front can absorb load too.

### Station identity

Routes are stored as arrays of `Station.id` (per-operator row id), not `groupId`. The reasoning:

- Each `Station` row carries its own `.line`, so the line context at every stop is unambiguous — Shibuya on the Ginza Line and Shibuya on the Yamanote Line are different rows.
- Transfers at the same physical location are represented by two consecutive rows that share a `groupId`.
- The adjacency check at `lib/data/routing.ts` cascades through three rules:
  1. Same `line` and consecutive in that line's row-id order
  2. Same `groupId` (in-place transfer)
  3. `groupId`-adjacent on any shared line (cross-operator)

### Deep link

See [`apps/web/lib/deeplink.ts`](apps/web/lib/deeplink.ts). The link format is:

```
trainlcd://route?sids=<sid1>,<sid2>,...
trainlcd-canary://route?sids=<sid1>,<sid2>,...
```

The order of `sids` is the direction of travel; there is no separate `dir` parameter. Receiver behavior is proposed in [TrainLCD/MobileApp#6002](https://github.com/TrainLCD/MobileApp/issues/6002).

## License

MIT — see [LICENSE](LICENSE).
