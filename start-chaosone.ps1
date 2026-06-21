$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = if ($env:CHAOSONE_PORT) { $env:CHAOSONE_PORT } elseif ($env:NOVAOS_PORT) { $env:NOVAOS_PORT } else { "4788" }
$url = "http://localhost:$port"
$logDir = Join-Path $root "logs"
$stdout = Join-Path $logDir "chaosone.out.log"
$stderr = Join-Path $logDir "chaosone.err.log"

Write-Host "Starting ChaosOne..."
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$isRunning = $false
try {
  Invoke-RestMethod -Uri "$url/api/status" -TimeoutSec 2 | Out-Null
  $isRunning = $true
} catch {
  $isRunning = $false
}

if (-not $isRunning) {
  Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null
}

$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    Invoke-RestMethod -Uri "$url/api/status" -TimeoutSec 1 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $ready) {
  Write-Host "ChaosOne did not start. Check logs in $logDir"
  exit 1
}

Start-Process $url
Write-Host "ChaosOne is running at $url"

