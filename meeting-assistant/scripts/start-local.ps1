param(
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

$AppDir = Split-Path -Parent $PSScriptRoot
$RepoDir = Split-Path -Parent $AppDir
$AsrDir = Join-Path $RepoDir 'asr-service'
$RuntimeDir = Join-Path $AppDir '.local-runtime'
$LogDir = Join-Path $AppDir 'logs'
$NodePort = 3001
$AsrPort = 8000
$OllamaPort = 11434
$OllamaModel = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { 'qwen3.5:9b' }
$OllamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'

New-Item -ItemType Directory -Force -Path $RuntimeDir, $LogDir | Out-Null

function Test-Port {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 60
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Test-Http {
  param([string]$Url)
  try {
    Invoke-RestMethod -Uri $Url -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-Ollama {
  if (Test-Http "http://127.0.0.1:$OllamaPort/api/tags") {
    Write-Host "[OK] Ollama already running on $OllamaPort"
    return
  }

  if (!(Test-Path $OllamaExe)) {
    Write-Warning "Ollama executable not found: $OllamaExe"
    Write-Warning "Start Ollama manually, then run this script again."
    return
  }

  Write-Host "[..] Starting Ollama"
  Start-Process -FilePath $OllamaExe -WindowStyle Hidden | Out-Null
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    if (Test-Http "http://127.0.0.1:$OllamaPort/api/tags") {
      Write-Host "[OK] Ollama started"
      return
    }
    Start-Sleep -Seconds 1
  }
  Write-Warning "Ollama did not respond within 30 seconds."
}

function Start-Asr {
  if (Test-Port $AsrPort) {
    Write-Host "[OK] ASR already running on $AsrPort"
    return
  }

  $stdout = Join-Path $LogDir 'asr.log'
  $stderr = Join-Path $LogDir 'asr.err.log'
  Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue

  $asrLinuxPath = '/mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service'
  $cmd = "cd $asrLinuxPath && source ../.venv-asr/bin/activate && export HF_ENDPOINT=https://hf-mirror.com && export PYTHONPATH=$asrLinuxPath && exec python -m uvicorn app.main:app --host 127.0.0.1 --port $AsrPort"
  Write-Host "[..] Starting ASR service on $AsrPort"
  $process = Start-Process `
    -FilePath 'wsl.exe' `
    -ArgumentList @('-d', 'Ubuntu-24.04', '--', 'bash', '-lc', $cmd) `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  Set-Content -LiteralPath (Join-Path $RuntimeDir 'asr.pid') -Value $process.Id

  if (Wait-Port $AsrPort 90) {
    Write-Host "[OK] ASR started on $AsrPort"
  } else {
    Write-Warning "ASR did not open port $AsrPort. Check $stderr"
  }
}

function Start-NodeAgent {
  if (Test-Port $NodePort) {
    Write-Host "[OK] Local Agent already running on $NodePort"
    return
  }

  if (!(Test-Path (Join-Path $AppDir 'dist\index.html'))) {
    Write-Host "[..] dist not found; building frontend"
    Push-Location $AppDir
    try {
      npm.cmd run build
    } finally {
      Pop-Location
    }
  }

  $stdout = Join-Path $LogDir 'node.log'
  $stderr = Join-Path $LogDir 'node.err.log'
  Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue

  $nodeCommand = @"
`$env:OLLAMA_MODEL = '$OllamaModel'
Remove-Item Env:OLLAMA_NUM_GPU -ErrorAction SilentlyContinue
Remove-Item Env:OLLAMA_KEEP_ALIVE -ErrorAction SilentlyContinue
Set-Location -LiteralPath '$AppDir'
npm.cmd start
"@

  Write-Host "[..] Starting Local Agent on $NodePort with OLLAMA_MODEL=$OllamaModel"
  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $nodeCommand) `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  Set-Content -LiteralPath (Join-Path $RuntimeDir 'node.pid') -Value $process.Id

  if (Wait-Port $NodePort 30) {
    Write-Host "[OK] Local Agent started on $NodePort"
  } else {
    Write-Warning "Local Agent did not open port $NodePort. Check $stderr"
  }
}

Start-Ollama
Start-Asr
Start-NodeAgent

$url = "http://127.0.0.1:$NodePort"
Write-Host ""
Write-Host "MeetingRecord local system is ready:"
Write-Host "  App:        $url"
Write-Host "  Local API:  http://127.0.0.1:$NodePort/api/local/health"
Write-Host "  ASR:        http://127.0.0.1:$AsrPort/health"
Write-Host "  Ollama:     http://127.0.0.1:$OllamaPort"
Write-Host "  Logs:       $LogDir"
Write-Host ""

if (!$NoOpen) {
  Start-Process $url | Out-Null
}
