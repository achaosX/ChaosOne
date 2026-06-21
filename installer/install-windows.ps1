$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$appData = Join-Path $env:APPDATA "ChaosOne"
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "ChaosOne.lnk"
$startMenuShortcut = Join-Path $startMenu "ChaosOne.lnk"
$launcher = Join-Path $root "launcher\ChaosOne.Launcher.ps1"
$fallbackTarget = Join-Path $root "start-chaosone.cmd"
$target = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$icon = Join-Path $root "web\assets\favicon.ico"
$node = Get-Command node -ErrorAction SilentlyContinue
$ollama = Get-Command ollama -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $appData | Out-Null

$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @($desktopShortcut, $startMenuShortcut)) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  if (Test-Path $launcher) {
    $shortcut.TargetPath = $target
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
  } else {
    $shortcut.TargetPath = $fallbackTarget
    $shortcut.Arguments = ""
  }
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Start ChaosOne"
  if (Test-Path $icon) {
    $shortcut.IconLocation = $icon
  }
  $shortcut.Save()
}

Write-Host "ChaosOne installed."
Write-Host "Project: $root"
Write-Host "Data:    $appData"
Write-Host "Open it from the Desktop or Start Menu shortcut."
if (-not $node) {
  Write-Warning "Node.js 20+ is required for source installs: https://nodejs.org"
}
if (-not $ollama) {
  Write-Warning "Ollama is required for the local brain: https://ollama.com/download/windows"
  Write-Host "After installing Ollama, download the starter model with: ollama pull tinyllama"
}

