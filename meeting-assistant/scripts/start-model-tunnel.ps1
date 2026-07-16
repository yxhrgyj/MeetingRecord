param(
  [string]$TunnelId = '95a4ffb7-c495-4438-92b4-7cda8223ee86',
  [string]$TunnelName = 'meeting-assistant-model',
  [string]$AccountId = '82a5c6c0310c0c1ec3cca96cc39e6ccf',
  [string]$Hostname = 'https://model.yxhrgyj.cc.cd',
  [string]$ModelHealthUrl = 'http://127.0.0.1:8789/health',
  [string]$TokenPath = (Join-Path (Split-Path -Parent $PSScriptRoot) '.model-gateway-token'),
  [string]$UrlOutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'model-tunnel-url.txt'),
  [string]$WranglerConfigPath = (Join-Path $env:APPDATA 'xdg.config\.wrangler\config\default.toml'),
  [string]$CloudflaredPath = '',
  [string]$CloudflaredDownloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  [switch]$NoStartLocalService
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalServicesScript = Join-Path $PSScriptRoot 'start-local.ps1'

Set-Content -LiteralPath $UrlOutputPath -Value $Hostname -Encoding UTF8
Write-Host "Model gateway URL: $Hostname"
Write-Host "URL written to: $UrlOutputPath"
$modelGatewayToken = ''
if (Test-Path $TokenPath) {
  Write-Host "Model gateway token file: $TokenPath"
  $modelGatewayToken = (Get-Content -Raw -LiteralPath $TokenPath).Trim()
} else {
  Write-Warning "Model gateway token file was not found at $TokenPath."
}

function Test-ModelHealth {
  try {
    $response = Invoke-WebRequest -Uri $ModelHealthUrl -Headers (Get-ModelGatewayHeaders) -UseBasicParsing -TimeoutSec 3
    Write-Host "Local model health: HTTP $($response.StatusCode)"
    return $true
  } catch {
    return $false
  }
}

function Get-ModelGatewayHeaders {
  $headers = @{}
  if ($modelGatewayToken) {
    $headers.Authorization = "Bearer $modelGatewayToken"
  }
  return $headers
}

function Test-TranscribeRoute {
  $transcribeUrl = $ModelHealthUrl -replace '/health$', '/transcribe'
  $headers = Get-ModelGatewayHeaders
  $headers['Content-Type'] = 'application/octet-stream'

  try {
    $response = Invoke-WebRequest -Method Post -Uri $transcribeUrl -Headers $headers -Body ([byte[]](1, 2, 3)) -UseBasicParsing -TimeoutSec 5
    $contentType = [string]$response.Headers['Content-Type']
    return -not $contentType.StartsWith('text/html')
  } catch {
    $statusCode = 0
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return $statusCode -gt 0 -and $statusCode -ne 404
  }
}

function Stop-LocalModelService {
  $port = ([Uri]$ModelHealthUrl).Port
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess) {
      Write-Host "Stopping stale local model service process $($connection.OwningProcess) on port $port ..."
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-LocalModelService {
  Write-Host "Starting local model service on http://127.0.0.1:8789 ..."
  $env:PORT = '8789'
  $asrHost = '127.0.0.1'
  $wslAddresses = (& wsl.exe -d 'Ubuntu-24.04' -- hostname -I 2>$null).Trim()
  $wslAddress = ($wslAddresses -split '\s+' | Where-Object { $_ }) | Select-Object -First 1
  if ($wslAddress) { $asrHost = $wslAddress }
  $env:ASR_BASE_URL = "http://${asrHost}:8000"
  if ($modelGatewayToken) {
    $env:MEETING_ACCESS_TOKEN = $modelGatewayToken
  }
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('start') -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-ModelHealth) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Warning "Local model service did not become healthy at $ModelHealthUrl. Tunnel will still start, but AI features may fail until the service is ready."
  }
}

if (-not $NoStartLocalService) {
  Write-Host "Starting ASR and Ollama dependencies ..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $LocalServicesScript -NoOpen
  if ($LASTEXITCODE -ne 0) {
    throw "Local ASR and Ollama startup failed with exit code $LASTEXITCODE."
  }
}

if ($NoStartLocalService) {
  if (-not (Test-ModelHealth)) {
    Write-Warning "Local model health check failed at $ModelHealthUrl."
  }
} elseif (Test-ModelHealth) {
  if (-not (Test-TranscribeRoute)) {
    Write-Warning "Local model service is running but does not support /transcribe. Restarting it."
    Stop-LocalModelService
    Start-LocalModelService
  }
} else {
  Start-LocalModelService
}

$cloudflared = $CloudflaredPath
if (-not $cloudflared) {
  $cloudflaredCommand = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if ($cloudflaredCommand) {
    $cloudflared = $cloudflaredCommand.Source
  }
}
if (-not $cloudflared) {
  $tempCloudflared = Join-Path (Join-Path $env:TEMP 'codex-cloudflared') 'cloudflared.exe'
  if (Test-Path $tempCloudflared) {
    $cloudflared = $tempCloudflared
  }
}
if (-not $cloudflared -or -not (Test-Path $cloudflared)) {
  $binDir = Join-Path $PSScriptRoot '.bin'
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  $cloudflared = Join-Path $binDir 'cloudflared.exe'
  Write-Host "Downloading cloudflared to: $cloudflared"
  Invoke-WebRequest -Uri $CloudflaredDownloadUrl -OutFile $cloudflared
}

$tunnelRunToken = ''
try {
  $tunnelRunToken = (& $cloudflared tunnel token $TunnelName 2>$null | Select-Object -Last 1).Trim()
  if ($tunnelRunToken) {
    Write-Host "Fetched Cloudflare Tunnel token with cloudflared local credentials."
  }
} catch {
  $tunnelRunToken = ''
}

if (-not $tunnelRunToken) {
  if (-not (Test-Path $WranglerConfigPath)) {
    throw "Wrangler config was not found at $WranglerConfigPath. Run npx.cmd wrangler login or cloudflared tunnel login first."
  }

  # Wrangler refreshes a stored OAuth session when it checks the current user.
  # Refresh before reading the token because the raw value in default.toml can expire.
  $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if ($npxCommand) {
    & $npxCommand.Source --no-install wrangler whoami *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'Wrangler could not refresh its Cloudflare OAuth session. The existing token will be tried once.'
    }
  } else {
    Write-Warning 'npx.cmd was not found. The existing Wrangler OAuth token will be tried without refreshing it.'
  }

  $wranglerConfig = Get-Content -Raw -LiteralPath $WranglerConfigPath
  $oauthMatch = [regex]::Match($wranglerConfig, 'oauth_token\s*=\s*"([^"]+)"')
  if (-not $oauthMatch.Success) {
    throw 'Could not read oauth_token from Wrangler config. Run cloudflared tunnel login, then try again.'
  }

  $apiToken = $oauthMatch.Groups[1].Value
  try {
    $response = Invoke-RestMethod `
      -Method Get `
      -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/cfd_tunnel/$TunnelId/token" `
      -Headers @{ Authorization = "Bearer $apiToken" }
  } catch {
    throw 'Could not authenticate with Cloudflare to fetch the Tunnel token. Run npx.cmd wrangler login, authorize the correct Cloudflare account, then start the tunnel again.'
  }

  if (-not $response.success) {
    throw 'Cloudflare rejected the Tunnel token request. Run npx.cmd wrangler login, authorize the correct Cloudflare account, then start the tunnel again.'
  }

  $tunnelRunToken = $response.result
}

Write-Host "Starting Cloudflare Tunnel $TunnelId. Keep this window open."
& $cloudflared tunnel run --token $tunnelRunToken
