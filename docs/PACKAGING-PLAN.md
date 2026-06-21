# ChaosOne Packaging Plan

Goal: install ChaosOne on a Windows machine from a GitHub source/ZIP download and a PowerShell setup script first. Signed EXE packaging is paused until there is a trusted code-signing path.

## Target User Experience

1. User runs the ChaosOne installer.
2. Installer shows a branded visual window, not a raw CMD console.
3. User chooses:
   - Local-first setup.
   - Optional cloud providers.
   - Whether to install/configure a local brain.
4. If local brain is selected:
   - Detect whether a compatible local runtime exists.
   - Offer to install/download the runtime if missing.
   - Offer a recommended model list.
   - Download the selected model.
   - Verify a local chat request before finishing.
5. ChaosOne launches at `http://localhost:4788` or a desktop app shell.

## Recommended First Models

For small or VM-sized environments:

- Fast/default: `tinyllama`
- Very small multilingual option: `qwen2.5:0.5b`
- Better quality if RAM allows: `llama3.2:3b`
- Code-focused option: `qwen2.5-coder:3b`

The UI should present these as ChaosOne choices, not as raw infrastructure:

- `Chaos Local Mini`
- `Chaos Local Ligero`
- `Chaos Local Equilibrado`
- `Chaos Local Codigo`

## Installer Shape

Current GitHub-first artifact:

- `installer/install-windows.ps1`
  - Creates local shortcuts from a downloaded or cloned repository.
  - Creates Desktop and Start Menu shortcuts.
  - Points them at the WPF visual launcher.
  - Warns if Node.js or Ollama are missing.
- `dist/` is ignored and should not be uploaded for now.

Phase 1:

- Windows PowerShell/WPF visual launcher. Done in MVP form.
- Installs local shortcuts from the GitHub checkout/ZIP. Done in MVP form through `installer/install-windows.ps1`.
- Creates Desktop and Start Menu shortcuts. Done in MVP form.
- Starts backend hidden. Done in MVP form.
- Opens the local web panel. Done in MVP form.

Phase 2:

- Decide whether to bundle Node/Ollama later or keep source install requirements.
- Detect `ollama` or compatible runtime.
- Offer model pull/download from a visual screen.
- Store selected model in `data/config.json`.

Phase 3:

- Tray/background process.
- Auto-start option.
- Auto-update channel.
- Health/recovery screen.

## Runtime Detection

Checks:

- `http://localhost:11434/api/tags`
- `ollama --version`
- Available models from `/api/tags`

If missing:

- Show "Instalar cerebro local" screen.
- Offer download/install action.
- Do not require the user to open CMD.

## Safety Defaults

- Local-first by default.
- Cloud providers disabled unless explicitly enabled.
- Workspace file writes disabled by default.
- Process execution disabled by default on fresh installs.
- Any command/model install action should use an integrated confirmation modal.

## Before Packaging

- Runtime setup screen inside ChaosOne. Done in MVP form.
- Local runtime status endpoint. Done in MVP form.
- Model download/pull endpoint. Done in MVP form with approved model allowlist and background job polling.
- Visual Windows launcher. Done in MVP form.
- GitHub source install flow. Done in MVP form.
- Single-file/EXE installer artifact. Paused; keep generated artifacts out of GitHub.
- Visible product version from `package.json`. Done in MVP form through `/api/status`, web status panel, and launcher.
- Add better process/background supervision.
- Decide whether packaging uses:
  - a simple visual PowerShell/WPF installer first,
  - or a proper installer framework later.

## Current MVP Runtime Setup

- `GET /api/local-runtime/status` checks `http://localhost:11434/api/tags` and `ollama --version`.
- `POST /api/local-runtime/pull` accepts only recommended models, requires explicit approval, and starts a background pull job.
- `GET /api/local-runtime/jobs/:id` exposes pull progress/status for the UI.
- First-run setup includes a visual "Cerebro local" panel.
- The current progress UI is text-based. Packaging should polish this into a richer installer-style progress screen.
- If Ollama is missing, the job fails cleanly with a user-facing error instead of freezing the setup screen.

## Current MVP Windows Launcher

- `launcher/ChaosOne.Launcher.ps1` shows a WPF control window.
- It starts the backend hidden, opens the local panel, checks runtime status, links to the Ollama Windows download, and can start an approved recommended-model pull.
- `installer/install-windows.ps1` points Desktop and Start Menu shortcuts at the launcher through hidden Windows PowerShell.
- `installer/build-single-file-installer.ps1` and `installer/build-exe-installer.ps1` are kept as experimental packaging tools, but generated `dist/` artifacts are not part of the GitHub distribution for now.
- `start-chaosone.cmd` remains as a diagnostic fallback.
- The launcher reads `/api/status.version`; the current product version is maintained in `package.json`.
