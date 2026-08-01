<#
.SYNOPSIS
  EasiTalk AI target-stack one-click deploy script for Windows PowerShell.

.DESCRIPTION
  This script deploys the new Flutter/Go/Python/MySQL/Redis/MinIO target stack using
  docker-compose.easytalk.yml. It creates .env.easytalk from .env.easytalk.example
  when missing, starts all services, waits for health endpoints, and prints service URLs.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\deploy\easitalk-deploy.ps1

.EXAMPLE
  .\scripts\deploy\easitalk-deploy.ps1 -Rebuild -Logs

.EXAMPLE
  .\scripts\deploy\easitalk-deploy.ps1 -Down
#>

[CmdletBinding()]
param(
  [switch]$Rebuild,
  [switch]$Pull,
  [switch]$Logs,
  [switch]$Down,
  [switch]$SkipHealth,
  [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'

trap {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
  param([string]$Message)
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Get-RepoRoot {
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $scriptDir '..\..')).Path
}

function Assert-Command {
  param([string]$Name, [string]$InstallHint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not in PATH. $InstallHint"
  }
}

function Invoke-Compose {
  param([string[]]$Args)
  & docker compose --env-file $script:EnvFile -f $script:ComposeFile @Args
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed with exit code $LASTEXITCODE"
  }
}

function Wait-HttpHealth {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSeconds
  )

  Write-Step "Waiting for $Name health: $Url"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Ok "$Name is healthy"
        return
      }
      $lastError = "HTTP $($response.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Seconds 3
  }

  throw "$Name did not become healthy within $TimeoutSeconds seconds. Last error: $lastError"
}

$RepoRoot = Get-RepoRoot
$script:ComposeFile = Join-Path $RepoRoot 'docker-compose.easytalk.yml'
$script:EnvFile = Join-Path $RepoRoot '.env.easytalk'
$EnvExample = Join-Path $RepoRoot '.env.easytalk.example'

Write-Step "EasiTalk deploy root: $RepoRoot"
Set-Location $RepoRoot

if (-not (Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}
if (-not (Test-Path $EnvExample)) {
  throw "Env example file not found: $EnvExample"
}

Write-Step 'Checking required tools'
Assert-Command -Name 'docker' -InstallHint 'Install Docker Desktop, then reopen PowerShell.'
$dockerVersion = (& docker --version) -join ' '
Write-Ok $dockerVersion

try {
  & docker compose version | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker compose command failed' }
  Write-Ok ((& docker compose version) -join ' ')
} catch {
  throw 'Docker Compose v2 is required. Install/update Docker Desktop.'
}

Write-Step 'Preparing environment file'
if (-not (Test-Path $EnvFile)) {
  Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
  Write-Ok "Created .env.easytalk from .env.easytalk.example"
  Write-Warn 'OPENAI_API_KEY is empty by default. The AI service will use mock responses until you fill it.'
} else {
  Write-Ok '.env.easytalk already exists; keeping your local values'
}

if ($Down) {
  Write-Step 'Stopping EasiTalk target stack'
  Invoke-Compose @('down')
  Write-Ok 'Stack stopped'
  exit 0
}

if ($Pull) {
  Write-Step 'Pulling base images'
  Invoke-Compose @('pull')
}

Write-Step 'Starting EasiTalk target stack'
$upArgs = @('up', '-d')
if ($Rebuild) {
  $upArgs += '--build'
} else {
  $upArgs += '--build'
}
Invoke-Compose $upArgs

Write-Step 'Current service status'
Invoke-Compose @('ps')

if (-not $SkipHealth) {
  Wait-HttpHealth -Name 'Go API' -Url 'http://localhost:3001/health' -TimeoutSeconds $TimeoutSeconds
  Wait-HttpHealth -Name 'Python AI Service' -Url 'http://localhost:3002/health' -TimeoutSeconds $TimeoutSeconds
} else {
  Write-Warn 'Health checks skipped by -SkipHealth'
}

Write-Step 'Deployment completed'
Write-Host 'Service URLs:' -ForegroundColor White
Write-Host '  Web App:             http://localhost:3001/web'
Write-Host '  Go API Health:       http://localhost:3001/health'
Write-Host '  AI Service Health:   http://localhost:3002/health'
Write-Host '  API Swagger/OpenAPI: http://localhost:3002/docs'
Write-Host '  MinIO API:           http://localhost:9000'
Write-Host '  MinIO Console:       http://localhost:9001'
Write-Host '  MySQL:               localhost:3306'
Write-Host '  Redis:               localhost:6379'

Write-Host "`nUseful commands:" -ForegroundColor White
Write-Host '  View logs:    docker compose --env-file .env.easytalk -f docker-compose.easytalk.yml logs -f api ai-service'
Write-Host '  Stop stack:   .\scripts\deploy\easitalk-deploy.ps1 -Down'
Write-Host '  Rebuild:      .\scripts\deploy\easitalk-deploy.ps1 -Rebuild'

if ($Logs) {
  Write-Step 'Streaming API and AI logs. Press Ctrl+C to stop log streaming.'
  Invoke-Compose @('logs', '-f', 'api', 'ai-service')
}


