param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repoRoot 'apps/customer-pwa/dist'
foreach ($required in @('index.html', '.htaccess', '.well-known/assetlinks.json', '.well-known/.htaccess')) {
    if (!(Test-Path -LiteralPath (Join-Path $dist $required))) { throw "Missing Customer build file: $required. Run npm run build -w @home/customer first." }
}
if (!$OutputDirectory) { $OutputDirectory = Join-Path $repoRoot ('deployment-artifacts/customer-twa-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$zipPath = Join-Path $OutputDirectory 'customer-pwa.zip'
if (Test-Path -LiteralPath $zipPath) { throw "Preserving existing archive: $zipPath. Choose a new output directory." }
Add-Type -AssemblyName System.IO.Compression.FileSystem
# .NET enumerates dotfiles and hidden files; Compress-Archive can omit them on Windows.
[IO.Compression.ZipFile]::CreateFromDirectory($dist, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($required in @('index.html', '.htaccess', '.well-known/assetlinks.json', '.well-known/.htaccess')) {
        if ($entries -notcontains $required) { throw "Archive is missing required root entry: $required" }
    }
    $entry = $archive.Entries | Where-Object { $_.FullName.Replace('\', '/') -eq '.well-known/assetlinks.json' }
    $reader = New-Object IO.StreamReader($entry.Open())
    try { $json = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if (!($json | Where-Object { $_.target.package_name -eq 'in.fixbeez.customer' })) { throw 'Archive has no Customer app association.' }
} finally { $archive.Dispose() }
Write-Output "Verified Customer-only archive (including .well-known and .htaccess): $zipPath"
Write-Output 'Extract its contents directly into the document root for fixbeez.in, not into a nested dist/customer folder.'
