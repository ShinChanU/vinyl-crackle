# Vinyl Crackle

A Chrome extension that adds LP vinyl crackle (surface noise) to any website's audio. When music plays on YouTube, Spotify Web, SoundCloud, or any other site, Vinyl Crackle overlays authentic analog warmth — as if you're listening on a turntable.

## Features

- **Three Playback Modes**
  - **Off** — Crackle disabled
  - **Overlay** — Crackle overlays on top of media playback (requires playing `<audio>` / `<video>`)
  - **Ambient** — Crackle plays on its own via an offscreen document, no media required
- **Real-time DSP**: Three procedurally generated noise components
  - **Surface Noise** — Band-pass filtered white noise (continuous hiss)
  - **Clicks & Pops** — Poisson-distributed random impulses
  - **Dust Particles** — Short noise bursts with envelope
- **4 Presets**: Light Dust, Warm Vinyl, Worn Record, Antique
- **Fine-tuning**: Individual sliders for Surface, Pops, Dust, and Master Intensity
- **Mode-indicator icons**: Toolbar icon changes per mode for at-a-glance status
- **Settings sync**: Your preferences persist across browser sessions

## Screenshot

<img width="320" alt="image" src="https://github.com/user-attachments/assets/48f69182-bccb-493d-ae02-24a996036792" />

## Install (Development)

```bash
# Clone
git clone https://github.com/ShinChanU/vinyl-crackle.git
cd vinyl-crackle

# Install dependencies
pnpm install

# Build
pnpm build

# Load in Chrome
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select the dist/ folder
```

## Development

```bash
pnpm dev          # Watch mode — rebuilds on file changes
pnpm build        # Production build → dist/
pnpm typecheck    # TypeScript type check
pnpm test         # Run unit tests (Vitest)
pnpm test:watch   # Unit tests in watch mode
pnpm e2e          # Run E2E tests (Playwright, requires pnpm build first)
pnpm package      # Package dist/ → vinyl-crackle.zip
```

## Tech Stack

- **TypeScript** (strict mode, ES2022)
- **esbuild** for bundling (5 entry points: content, service-worker, popup, offscreen, crackle-processor)
- **Web Audio API** — ScriptProcessorNode for real-time noise generation
- **Chrome Extension Manifest V3** (service worker, `offscreen` API)
- **Vitest** + **Playwright** for unit & E2E testing

## Architecture

```
src/
├── background/  → Service worker. Routes messages, persists settings,
│                  manages offscreen document lifecycle, swaps mode icons.
├── content/     → Injected into every page. Overlay mode — detects media
│                  playback and generates crackle via ScriptProcessorNode.
├── offscreen/   → Offscreen document for Ambient mode. Plays crackle
│                  independently without requiring tab media.
├── popup/       → Extension popup UI. Mode selector, presets, sliders.
├── audio/       → AudioWorklet processor (built but unused at runtime due
│                  to CSP restrictions on sites like YouTube).
└── shared/      → Types, presets, constants, storage wrapper, crackle
                   engine (DSP + node factory used by both content & offscreen).
```

Crackle is generated as a **separate audio overlay** rather than intercepting media audio. In **Overlay** mode, the content script runs per-tab alongside page media. In **Ambient** mode, a single offscreen document plays crackle globally without needing any media element.

## How the DSP Works

Three noise components are mixed per sample:

1. **Surface Noise**: White noise → 2nd-order IIR band-pass filter (center ~1.5kHz, Q=0.7) → amplitude scaling. Simulates the continuous hiss from the stylus tracking the groove.

2. **Clicks & Pops**: Per-sample Poisson process (`probability = rate / sampleRate`). Each impulse has random amplitude (0.1–0.35) and random polarity. Simulates dust and scratches.

3. **Dust Particles**: Random-onset noise bursts (1–5ms) with linear decay envelope. Simulates particles briefly contacting the stylus.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

[MIT](LICENSE)
