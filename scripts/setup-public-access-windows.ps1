param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,

  [string]$CaddyfilePath = "C:\Caddy\Caddyfile"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command caddy -ErrorAction SilentlyContinue)) {
  throw "Missing command: caddy. Install Caddy before running this script."
}

$caddyDir = Split-Path -Parent $CaddyfilePath
if (-not (Test-Path $caddyDir)) {
  New-Item -ItemType Directory -Path $caddyDir -Force | Out-Null
}

@"
$Domain {
  reverse_proxy 127.0.0.1:3000
}
"@ | Set-Content -LiteralPath $CaddyfilePath -Encoding UTF8

New-NetFirewallRule -DisplayName "Ziwei Doushu HTTP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "Ziwei Doushu HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -ErrorAction SilentlyContinue | Out-Null

caddy validate --config $CaddyfilePath

Write-Host "Public access prepared for https://$Domain"
Write-Host "Start or restart Caddy with this Caddyfile, and make sure the domain A record points to this server."
