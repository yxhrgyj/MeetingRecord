param(
  [switch]$ForcePorts,
  [switch]$StopOllama
)

$ErrorActionPreference = 'Continue'

$AppDir = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $AppDir '.local-runtime'
$NodePort = 3001
$AsrPort = 8000
$OllamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'

function Stop-PidFile {
  param(
    [string]$Name,
    [string]$Path
  )
  if (!(Test-Path $Path)) {
    return
  }
  $pidValue = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pidValue -and (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Stopping $Name process $pidValue"
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Stopped $Name"
  }
  Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

function Stop-Port {
  param(
    [string]$Name,
    [int]$Port
  )
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if (Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue) {
      Write-Host "[..] Stopping $Name listener on port $Port process $($connection.OwningProcess)"
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-PidFile 'Local Agent' (Join-Path $RuntimeDir 'node.pid')
Stop-PidFile 'ASR' (Join-Path $RuntimeDir 'asr.pid')

if ($ForcePorts) {
  Stop-Port 'Local Agent' $NodePort
  Stop-Port 'ASR' $AsrPort
}

if ($StopOllama) {
  if (Test-Path $OllamaExe) {
    & $OllamaExe stop qwen3.5:9b 2>$null
  }
  Get-Process -Name 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "MeetingRecord local services stopped."
