param(
  [Parameter(Mandatory = $true)]
  [string]$Repository,

  [Parameter(Mandatory = $true)]
  [string]$Branch,

  [string]$DeployPath = "C:\apps\ziwei-doushu"
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing command: $Name. Please install it on the Windows Server first."
  }
}

Assert-Command git
Assert-Command node
Assert-Command npm
Assert-Command pm2

$parent = Split-Path -Parent $DeployPath
if (-not (Test-Path $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}

if (-not (Test-Path (Join-Path $DeployPath ".git"))) {
  $envContent = $null
  if (Test-Path $DeployPath) {
    $envPath = Join-Path $DeployPath ".env.local"
    if (Test-Path $envPath) {
      $envContent = Get-Content -LiteralPath $envPath -Raw
    }
    $existing = Get-ChildItem -LiteralPath $DeployPath -Force | Where-Object { $_.Name -ne ".env.local" }
    if ($existing.Count -gt 0) {
      throw "$DeployPath exists but is not a git checkout. Move existing files away, or leave only .env.local before the first deploy."
    }
    Remove-Item -LiteralPath $DeployPath -Recurse -Force
  }
  git clone --branch $Branch $Repository $DeployPath
  if ($null -ne $envContent) {
    Set-Content -LiteralPath (Join-Path $DeployPath ".env.local") -Value $envContent -NoNewline
  }
}

Set-Location $DeployPath

git fetch origin $Branch
git reset --hard "origin/$Branch"

if (-not (Test-Path ".env.local")) {
  throw "Missing .env.local in $DeployPath. Create it from deployment\env.production.example before deploying."
}

npm ci
npm run build
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save

$localOk = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000" -TimeoutSec 5
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $localOk = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $localOk) {
  throw "Deployment finished, but http://127.0.0.1:3000 did not respond."
}

Write-Host "Deployment complete: $DeployPath"
