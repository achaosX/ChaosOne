# ChaosOne

ChaosOne is a local-first AI assistant shell for Windows. It starts as a web panel with a small visual launcher, keeps user data on the machine by default, and can use either a local Ollama model or optional cloud providers.

## Status

This is an early MVP. The current recommended distribution path is GitHub source + PowerShell install, not a signed EXE installer.

Current version: **0.1.0**

## What ChaosOne Does

ChaosOne runs a local web assistant at `http://localhost:4788`.

It can:

- Chat through a local Ollama model.
- Switch to optional cloud providers when configured.
- Keep chats and settings on the local machine.
- Store supported API keys encrypted for the current Windows user.
- Import local OpenClaw identity context when available.
- Read attached documents and URL context when allowed.
- Browse and inspect files inside its allowed project workspace.
- Execute local PowerShell commands only when the user enables that permission.

## How It Works

1. `npm start` launches `src/server.js`.
2. The server exposes a local HTTP API and serves the UI from `web/`.
3. The Windows launcher in `launcher/` starts the backend hidden and gives the user a small control window.
4. The Brain screen lets the user choose local Ollama, demo mode, or a cloud provider.
5. Local model downloads are started through Ollama after explicit user confirmation.

## Requirements

- Windows 10/11
- PowerShell 5+
- Node.js 20+ for source-based installs
- Ollama for local AI models

Cloud providers are optional and require their own API keys.

## Install From GitHub

Download the repository ZIP from GitHub, extract it, open PowerShell in the extracted `ChaosOne` folder, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\installer\install-windows.ps1
```

Open ChaosOne from the Desktop or Start Menu shortcut.

For diagnostics, run:

```powershell
.\installer\check-windows.ps1
```

## Start Manually

```powershell
npm start
```

Then open:

```text
http://localhost:4788
```

## Local Brain

ChaosOne defaults to Ollama with a small starter model:

```powershell
ollama pull tinyllama
```

Recommended model options:

- TinyLlama: small starter model, around 638 MB  
  https://ollama.com/library/tinyllama
- Qwen 2.5 0.5B: very small multilingual model  
  https://ollama.com/library/qwen2.5:0.5b
- Llama 3.2 1B: small general chat model  
  https://ollama.com/library/llama3.2:1b
- Llama 3.2 3B: better quality, needs more memory  
  https://ollama.com/library/llama3.2:3b
- Qwen 2.5 Coder 3B: small coding-oriented model  
  https://ollama.com/library/qwen2.5-coder

Install Ollama for Windows:

```text
https://ollama.com/download/windows
```

## Cloud Providers

ChaosOne can also use OpenAI, Anthropic, Gemini, or Mistral if configured in the Brain screen. API keys can be stored encrypted for the current Windows user under `%APPDATA%\ChaosOne`.

## What Exists Now

- Local web panel
- Visual Windows launcher
- GitHub-friendly PowerShell install flow
- Chat screen
- First-run setup screen
- Personality screen
- Brain Provider Hub with local/cloud privacy labels
- Runtime status screen
- Local model download jobs with UI polling
- OpenClaw identity import into `data/openclaw-identity.json`
- Encrypted local OpenAI key storage on Windows
- Basic OpenAI-compatible chat path using the Responses API
- Basic Ollama-compatible local chat path
- Provider registry in `config/models-registry.json`

## Packaging Policy

`dist/`, generated EXE files, portable runtimes, logs, local data, and certificates are intentionally ignored. For now, release through GitHub source/ZIP and PowerShell install.

Signed EXE packaging can come back later once there is a proper code-signing strategy.
