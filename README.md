# Corecast

**Corecast** is an all‑in‑one video‑production toolbox: a single Electron app that bundles a video switcher, intercom, media player, audio mixer, PTZ camera control and macro automation. Built for live‑stream control rooms and multi‑camera studios, Corecast aims to deliver a native, snappy experience that stays easy to extend thanks to its modular architecture.

> **Status:** beta — feel free to test and open issues!

---

## Key features

| Module | What it does | Protocols / APIs | Folder |
|--------|--------------|------------------|--------|
| **Switcher** | Camera sources, transitions, multiview & overlays | NDI™, GetUserMedia, Screen sharing, mediaplayer | `apps/switcher/` |
| **PTZ** | Pan / Tilt / Zoom with speed presets | VISCA‑over‑IP | `apps/ptz/` |
| **Mixer** | Audio mixing, meters, monitoring | AudioCore, Asio, getUserMedia | `apps/mixer/` |
| **Media Player** | Play videos, images, audio, playlists | FFmpeg | `apps/mediaplayer/` |
| **Intercom** | Full‑duplex talk‑back between operators | WebRTC | `apps/intercom/` |
| **Scene** | Automate sequences (e.g. camera preset + settings) | Hotkeys | `apps/macros/` |
| **Layer** | Graphic composition (lower‑thirds, logos) | images / video (with alpha layer) | `apps/layer/` |
| **Settings** | Preferences, OTA updates | Electron‑Store | `apps/settings/` |

---

## Quick start

### Prerequisites

- **Node.js ≥ 18** (LTS recommended)
- **npm** (bundled with Node) or **pnpm** / **yarn**
- macOS, Windows 10/11 or Linux (x64 & arm64)

### Installation

```bash
# 1. Clone the repo
cd corecast

# 2. Install dependencies
npm install
```

### Run in development mode

```bash
npm start   # opens Electron with hot‑reload
```

### Build a signed installer / app

```bash
# macOS / Windows / Linux (cross‑compile)
npm run dist
```

Targets are configured in `package.json > build` (electron‑builder).

---

## Project layout (root)

```text
main.js                 # Electron main process
app.js                  # Shared bootstrap
apps/                   # Functional modules (renderer)
├── switcher/           # Video switcher & multiview
├── ptz/                # PTZ camera control
├── mixer/              # Audio mixer
├── mediaplayer/        # Media player
├── intercom/           # Operator intercom
├── macros/             # Automation
├── layer/              # Graphic overlays
└── settings/           # Preferences & updates
local/                  # Localisation files (EN/FR/NL…)
build/                  # Icons, entitlements, builder config
nginx/                  # Static content served locally
package.json            # Dependencies & npm scripts
README.md               # This file 👋
```

---

## Customisation & configuration

- **User preferences**: saved with [electron‑store](https://github.com/sindresorhus/electron-store) (JSON in `%APPDATA%/Corecast` or `~/.config/Corecast`).
- **NDI streams**: discovered automatically on the local network.
- **PTZ**: set the camera IP in the PTZ panel (default port: `52381`).
- **Updates**: OTA via `electron‑updater`; change the channel under *Settings → Update*.

---

## npm scripts

| Script | Action |
|--------|--------|
| `npm start` | Launch the app in dev mode |
| `npm run build` | Build arm64 (mac M‑series) |
| `npm run dist` | Build + package for all platforms |

---

## Contributing

Pull requests and issues are welcome! Please:

1. Fork → new branch → meaningful commit
2. Make sure `npm run lint` and the tests pass
3. Describe your fix or feature clearly

---

## License

This repo is currently **unlicensed** (all rights reserved). You may clone and contribute, but any binary redistribution requires the author’s permission.

*(Replace with MIT / GPL / AGPL as needed.)*

---

## Acknowledgements

- [Electron](https://www.electronjs.org/) — desktop runtime  
- [FFmpeg](https://ffmpeg.org/) — media decoding / encoding  
- [Grandiose](https://www.npmjs.com/package/grandiose) — Node bindings for NDI  
- [Notyf](https://github.com/caroso1222/notyf) — toast notifications  

---

<div align="center">
  <sub>2025 – made with ❤️ by the Corecast team</sub>
</div>
