param([Parameter(Mandatory=$true)][string]$PrivateDirectory)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $PrivateDirectory) { throw 'Refusing to overwrite an existing signing directory. Choose a new private directory outside the repository.' }
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$privatePath = [IO.Path]::GetFullPath($PrivateDirectory)
if ($privatePath.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Signing files must be outside the repository.' }
$config = Get-Content "$env:USERPROFILE/.bubblewrap/config.json" -Raw | ConvertFrom-Json
$keytool = Join-Path $config.jdkPath 'bin/keytool.exe'
if (!(Test-Path -LiteralPath $keytool)) { throw 'Configure Bubblewrap with a working JDK first.' }
New-Item -ItemType Directory -Path $privatePath | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $privatePath /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict signing directory permissions.' }
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$password = [Convert]::ToBase64String($bytes)
$secure = ConvertTo-SecureString $password -AsPlainText -Force
# Windows DPAPI encryption: only this Windows account on this machine can decrypt it.
$secure | Export-Clixml -LiteralPath (Join-Path $privatePath 'password.dpapi.xml')
$previousPassword = $env:FIXBEEZ_NEW_KEY_PASSWORD
try {
  $env:FIXBEEZ_NEW_KEY_PASSWORD = $password
  & $keytool -genkeypair -keystore (Join-Path $privatePath 'upload.jks') -storetype JKS -alias fixbeez-upload -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=FixBeez Upload Key' -storepass:env FIXBEEZ_NEW_KEY_PASSWORD -keypass:env FIXBEEZ_NEW_KEY_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Upload key generation failed.' }
  & $keytool -exportcert -rfc -keystore (Join-Path $privatePath 'upload.jks') -alias fixbeez-upload -storepass:env FIXBEEZ_NEW_KEY_PASSWORD -file (Join-Path $privatePath 'upload-certificate.pem')
  if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
  & $keytool -list -v -keystore (Join-Path $privatePath 'upload.jks') -alias fixbeez-upload -storepass:env FIXBEEZ_NEW_KEY_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Certificate inspection failed.' }
} finally {
  $env:FIXBEEZ_NEW_KEY_PASSWORD = $previousPassword
  $password = $null
}
Write-Output "New upload key and DPAPI encrypted password saved outside Git: $privatePath"
Write-Output 'Back up the keystore and password in your password manager. DPAPI files alone are not a portable backup.'
Write-Output 'An existing Play app requires the original upload key or an approved upload-key reset before using this new key.'
