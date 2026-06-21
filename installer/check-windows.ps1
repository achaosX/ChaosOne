$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$bundledNode = Join-Path $root "runtime\node\node.exe"
$installedBundledNode = Join-Path $env:LOCALAPPDATA "ChaosOne\runtime\node\node.exe"

[pscustomobject]@{
  NodeFound = [bool]$node
  NodePath = if ($node) { $node.Source } else { $null }
  BundledNodeFound = (Test-Path $bundledNode) -or (Test-Path $installedBundledNode)
  BundledNodePath = if (Test-Path $bundledNode) { $bundledNode } elseif (Test-Path $installedBundledNode) { $installedBundledNode } else { $null }
  NpmFound = [bool]$npm
  NpmPath = if ($npm) { $npm.Source } else { $null }
  ChaosOnePort = if ($env:CHAOSONE_PORT) { $env:CHAOSONE_PORT } elseif ($env:NOVAOS_PORT) { $env:NOVAOS_PORT } else { "4788" }
  OpenAiKeyConfigured = [bool]$env:OPENAI_API_KEY
} | Format-List

