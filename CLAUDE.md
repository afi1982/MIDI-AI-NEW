# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## User Context

This project is developed by a high school student learning MIDI AI development. When making changes, explain what you're doing and why in plain language. Follow the React + TypeScript patterns already used in the existing 40+ components.

## Commands

```bash
npm run dev       # Start local dev server at http://localhost:5173
npm run build     # Production build to dist/
npm run lint      # TypeScript type-check (tsc --noEmit), no test suite exists
npm run preview   # Preview the production build
```

There are no automated tests. Use `npm run lint` to catch type errors before treating work as done.

## Architecture Overview

### No bundled dependencies
`vite.config.ts` is intentionally empty. All dependencies (React, Tone.js, etc.) are loaded at runtime from `esm.sh` via an **importmap** defined in `index.html`. This means `node_modules` are only used for TypeScript types and dev tooling — nothing is bundled.

### API Key mismatch to be aware of
`.env.local` sets `GEMINI_API_KEY`, but `services/geminiService.ts` reads `process.env.API_KEY`. Vite doesn't expose `process.env` without a `define` config, so the Gemini API calls will fail locally until this is reconciled (either fix the env var name, or add a `define` block to `vite.config.ts`).

### Central data type: `GrooveObject`
Everything in this app revolves around `GrooveObject` (defined in `types.ts`). It represents a complete music track with:
- Metadata: `id`, `name`, `bpm`, `key`, `scale`, `genre`, `totalBars`
- 16 MIDI channels as `NoteEvent[]` arrays: `ch1_kick` through `ch16_synth`
- Optional fields: `storyMap`, `structureMap`, `automation`, `qaReport`, `engineMeta`

`NoteEvent` has: `note` (pitch string), `time`, `duration`, `velocity`, and optional tick fields for precise timing.

### View-based navigation (App.tsx)
`App.tsx` is the root. Navigation is a simple `ViewType` string state — no router library. Views: `WELCOME → CREATE → STUDIO → AUDIO_LAB → GENERATOR → RENDERER → JOBS`. Horizontal swipe gestures cycle through `NAV_ORDER` on mobile (uses `data-no-swipe="true"` attribute to opt out).

### Generation pipeline
1. User configures `GenerationParams` (genre, key, scale, BPM, channels) on the CREATE view
2. `jobQueueService.addMidiJob(params, channels)` enqueues the job
3. `jobQueueService` (observer pattern: `subscribe`/`notify`) processes the queue and calls `maestroService.generateGroove()`
4. `maestroService` builds a `GrooveObject` by generating patterns per channel, consulting `engineProfileService` for learned style profiles
5. Completed jobs appear in `JobsCenterPage` (JOBS view); opening one sets `groove` state in `App.tsx` and navigates to STUDIO

### Service layer
All services in `services/` are singletons. Key ones:
- **`jobQueueService`** — async job queue; all generation goes through here
- **`maestroService`** — core MIDI generation orchestrator; owns `ELITE_16_CHANNELS` (the canonical list of all 16 channel keys)
- **`geminiService`** — Google Gemini API calls for AI generation with model fallback (`gemini-3-pro-preview` → `gemini-3-flash-preview`)
- **`engineProfileService`** — persists learned style profiles to `localStorage` under key `EMG_ENGINE_STATE_V38`; enables the engine to improve from reference MIDI files
- **`midiService`** — exports `GrooveObject` to `.mid` files using `@tonejs/midi` and `midi-writer-js`; internal PPQ is 480 (1920 ticks/bar)

### Timing model
- 1 bar = 1920 ticks (PPQ 480 × 4 beats)
- 1 16th note = 120 ticks
- Step index `s` in AI-generated patterns = 16th-note slot (0–15 per bar)
- `NoteEvent.tickOffset` allows micro-timing humanization (±15 ticks)

### Types
- `types.ts` — all shared types; re-exports from `types/learning.ts`
- `types/learning.ts` — `EngineMeta`, `StyleEngineProfile`, `KnowledgeRecord` for the learning engine
- Import types with `import type { ... }` where possible (enforced by `isolatedModules: true`)

### Supported genres
Defined in the `MusicGenre` enum: Full-On Psytrance, Psytrance (Power Groove), Goa Trance, Melodic Techno, Techno (Peak Time). BPM defaults are set in `GENRE_BPM_MAP` in `App.tsx`.
