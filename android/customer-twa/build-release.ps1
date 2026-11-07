param([Parameter(Mandatory=$true)][string]$PasswordFile)
$ErrorActionPreference = 'Stop'
$oldStore = $env:BUBBLEWRAP_KEYSTORE_PASSWORD
$oldKey = $env:BUBBLEWRAP_KEY_PASSWORD
$oldJavaHome = $env:JAVA_HOME
$oldPath = $env:PATH
Push-Location $PSScriptRoot
try {
  $config = Get-Content "$env:USERPROFILE/.bubblewrap/config.json" -Raw | ConvertFrom-Json
  $env:JAVA_HOME = $config.jdkPath
  $env:PATH = (Join-Path $config.jdkPath 'bin') + ';' + $oldPath
  $secret = Import-Clixml -LiteralPath $PasswordFile
  $credential = New-Object System.Management.Automation.PSCredential('fixbeez-upload', $secret)
  $password = $credential.GetNetworkCredential().Password
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $password
  $env:BUBBLEWRAP_KEY_PASSWORD = $password
  # Redact any command diagnostics emitted by the CLI before displaying them.
  $ErrorActionPreference = 'Continue'
  & bubblewrap build 2>&1 | ForEach-Object { Write-Output (($_ | Out-String).Replace($password, '[REDACTED]').TrimEnd()) }
  $buildExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($buildExit -ne 0) { throw 'Bubblewrap release build failed.' }
  if (!(Test-Path -LiteralPath 'app-release-bundle.aab')) { throw 'Bubblewrap did not produce the signed bundle.' }
  $verification = & (Join-Path $config.jdkPath 'bin/jarsigner.exe') '-J-Duser.language=en' -verify 'app-release-bundle.aab'
  $verificationExit = $LASTEXITCODE
  $verification | Write-Output
  if ($verificationExit -ne 0 -or ($verification -join "`n") -notmatch 'jar verified\.') { throw 'Bundle signature verification failed or the bundle is unsigned.' }
  Get-FileHash 'app-release-bundle.aab' -Algorithm SHA256
} finally {
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $oldStore
  $env:BUBBLEWRAP_KEY_PASSWORD = $oldKey
  $env:JAVA_HOME = $oldJavaHome
  $env:PATH = $oldPath
  $password = $null
  Pop-Location
}
