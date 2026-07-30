# Frontend rebuild — console-dark React UI

Date: 2026-07-30. Approved by Joey. Fork-only work (`redesign` branch,
never targeted upstream). Prior spec: 2026-07-30-pairing-ux-design.md.

## Goal

Replace the vanilla-TS frontend with a modern, console-launcher-style UI
(near-black, cool "moonlight" accent, cover-art tiles, glowing focus states,
keyboard/controller navigable) while keeping everything that isn't UI.

## Load-bearing decisions

1. **The streaming engine is kept, not rewritten.** `web/stream/**` (WebRTC/
   WebSocket transport, WebCodecs pipelines, workers, audio, input encoding),
   `web/api.ts`, and generated `web/api_bindings.ts` are consumed as a vendored
   engine by the new app. Rule: engine files are only modified when a UI hook
   genuinely requires it, and each such change is documented in the PR/commit.
2. **Old `web/` stays untouched** so `git merge upstream/master` stays cheap
   and the old UI remains buildable. New app lives in `web-ui/` as its own
   npm package.
3. **Multi-page build, same serving contract.** Vite MPA with `index.html`,
   `stream.html`, `admin.html` entries emitting into the same static layout
   the Rust `web-server` already serves. No server changes. Navigation
   contract preserved (`stream.html` query params).

## Stack

Vite + React + TypeScript + Tailwind (v4, `@tailwindcss/vite`). A small
custom Vite resolve plugin maps the engine's ESM `./x.js` specifiers onto the
`web/**/*.ts` sources.

## Phases

1. **Scaffold + engine boot (riskiest first):** web-ui package, MPA build
   emitting to the served dir, stream page instantiates the engine Stream
   with placeholder chrome and actually streams. Also runtime-proves the
   codec-level change (WebSocket transport exercises VideoDecoder).
2. **Login + host grid + pairing:** console-dark shell, host tiles, new
   pairing flow (PIN + countdown + cancel, from the #157 protocol).
3. **App grid:** cover art via `/api/app/image`, launch/resume/quit.
4. **Stream chrome:** overlay menu replacing the sidebar, stats panel,
   quality controls, fullscreen/pointer-lock flows.
5. **Settings + admin + i18n port + polish.** Playwright verification pass
   per phase.

## Design system (phase 2 refines with frontend-design skill)

Near-black layered background, single cool accent, big radius tiles with
cover art and glow focus ring, Inter/system type ramp, motion kept subtle
(focus/hover transitions only). Dark-only by design.

## Out of scope

Rust server changes; touch/screen-keyboard engine internals (restyled later,
logic untouched); upstreaming any of this.
