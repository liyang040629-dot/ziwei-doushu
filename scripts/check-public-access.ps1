param(
  [Parameter(Mandatory = $true)]
  [string]$Url
)

$ErrorActionPreference = "Stop"

$response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 20
if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 500) {
  throw "Unexpected status code from ${Url}: $($response.StatusCode)"
}

Write-Host "Public access OK: $Url returned $($response.StatusCode)"
