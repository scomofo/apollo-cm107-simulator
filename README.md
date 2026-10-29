# Apollo CM-107 Capsule Simulator

An interactive, browser-based Apollo 11 Command Module **Columbia** viewer and educational Earth-return simulator. The exterior uses the Smithsonian’s CC0 scan of CM-107, normalized to a 3.912 m base diameter and combined with clearly disclosed procedural reconstruction layers.

Built with Three.js and Vite. No backend, account, API key, or external model service is required at runtime.

## Run locally

Use a current Node.js LTS release.

```bash
npm install
npm run dev
```

The first `dev`, `build`, or `preview` command prepares the local assets: it copies the Draco decoder from the installed Three.js package and downloads the exact Smithsonian model if it is not already present. The model’s SHA-256 is verified before use. This one-time setup requires network access; subsequent runs use the local files.

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

The production output is written to `dist/` and can be served by a static web host. Serve the app over HTTP rather than opening `index.html` as a `file://` URL.

## Features

- Smithsonian scan-based CM-107 exterior with orbit, zoom, camera reset, fullscreen, auto-orbit, and component callouts.
- Exterior, schematic cabin X-ray, and subsystem display modes.
- Six animated configurations: launch escape, trans-Earth coast, atmospheric entry, drogues, three main ringsails, and Pacific splashdown.
- Timeline scrubbing, play/pause, restart, and 0.5×/1×/2×/4× playback.
- Representative telemetry and visual RCS pulses.
- Two interactive checklists with note, action, and observable wait steps.
- Browser-local checkpoints and deterministic command-log replay.
- Model Data panel with sourced, derived, and estimated parameter provenance.
- Responsive desktop and mobile layouts.

## Controls

| Input | Action |
| --- | --- |
| Drag / touch-drag | Orbit the camera |
| Wheel / pinch | Zoom |
| `Space` | Play or pause |
| `1`–`6` | Select a mission phase |
| `R` | Fire a visual RCS pulse |
| `L` | Toggle callouts |
| `C` | Open or close the checklist |
| `N` | Continue a checklist note while the panel is open |
| `F5` | Save a checkpoint |
| `F9` | Load the saved checkpoint |

Checklist **Locate Control** highlights the relevant interface control. Save, Load, and Replay are also available as buttons in the checklist panel.

## Checkpoints and deterministic replay

The simulator separates authoritative mission state from Three.js presentation. `src/runtime.js` owns phase, phase time, playback state, RCS state, view mode, checklist progress, a fixed 60 Hz tick counter, and the timestamped command log.

- **Save** stores one versioned checkpoint in this browser’s `localStorage`; saving again replaces it.
- **Load** restores the saved truth state, origin state, and command log.
- **Replay** resets to the recorded origin and reapplies commands at their original fixed-step ticks through the saved or current tick.
- Checkpoint schema and parameter-data versions are validated before restoration.
- Camera position, auto-orbit, callout visibility, and other presentation-only choices are not part of deterministic mission truth.

Checkpoint data remains only in the current browser. It is not uploaded, synchronized across devices, or a substitute for a flight-simulator state file.

## Parameter confidence

Open **Model Data** to inspect the parameter registry. Confidence describes **provenance, not precision**:

- **Sourced** — tied to an identified external record.
- **Derived** — measured or calculated from project geometry.
- **Estimated** — an educational presentation value awaiting document-level validation.

The registry in `src/parameters.js` is the single source for registered numeric values and their display metadata. Estimated values remain explicitly labeled rather than being presented as validated historical data.

## Accuracy boundary

The Smithsonian asset documents the flown artifact’s exterior in its museum configuration, including weathering and an open hatch. The docking probe, launch escape assembly, cabin, subsystem layout, RCS plumes, plasma, parachutes, Earth, ocean, telemetry, and mission motion are educational reconstructions.

This is **not an engineering flight-dynamics solver**. It does not integrate orbital mechanics, guidance, aerodynamics, structural loads, parachute dynamics, or historical mission timing. Phase timing is compressed, telemetry is representative, and visual effects are illustrative. See [CREDITS.md](CREDITS.md) for asset provenance.

## Project structure

```text
src/runtime.js       Authoritative state, commands, checkpoints, and replay
src/checklists.js    Guided procedures and observable step conditions
src/parameters.js    Numeric parameter registry and provenance metadata
src/scene.js         Rendering, interface bindings, and browser persistence
src/spacecraft.js    Reconstructed spacecraft hardware and effects
src/environment.js   Procedural space, atmosphere, and ocean environments
scripts/prepare-assets.mjs  Reproducible, checksum-verified asset setup
public/models/       Generated local Smithsonian CM-107 exterior asset
public/draco/        Generated local Draco decoder assets
tests/               Runtime and registry regression tests
```

Architectural inspiration came from the truth-state, checklist, checkpoint/replay, and source-confidence ideas in [`scomofo/gemini-capsule`](https://github.com/scomofo/gemini-capsule). This implementation is independent and designed for this Three.js application.

## Tests

```bash
npm test
npm run build
```

The Node test suite covers exact command replay, replay after checkpoint restoration, stable renderer-facing state identity, malformed checkpoint rejection, checklist behavior, parameter provenance, and checklist condition validation.
