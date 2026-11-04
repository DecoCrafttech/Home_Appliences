$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $repoRoot ('deployment-artifacts/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

foreach ($appName in @('customer', 'admin', 'technician')) {
    $dist = Join-Path $repoRoot "apps/$appName-pwa/dist"
    if (!(Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
        throw "Missing build for $appName. Run npm run build first."
    }
    $stage = Join-Path $artifactRoot $appName
    New-Item -ItemType Directory -Path $stage | Out-Null
    Copy-Item -Path "$dist/*" -Destination $stage -Recurse
    Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy/pwa.htaccess') -Destination (Join-Path $stage '.htaccess')
    Compress-Archive -Path "$stage/*" -DestinationPath (Join-Path $artifactRoot "$appName-pwa.zip")
}

$apiStage = Join-Path $artifactRoot 'backend-source'
New-Item -ItemType Directory -Path $apiStage | Out-Null
# Explicit allowlist: no local environment files, credentials, node_modules or logs.
$files = @('package.json', 'package-lock.json', 'tsconfig.base.json', 'server.mjs',
    'backend/package.json', 'backend/tsconfig.json', 'backend/tsconfig.build.json', 'backend/start.mjs', 'backend/build.mjs',
    'packages/shared/package.json', 'packages/shared/tsconfig.json',
    'packages/ui/package.json', 'apps/customer-pwa/package.json',
    'apps/admin-pwa/package.json', 'apps/technician-pwa/package.json',
    'deploy/backend.env.example', 'docs/HOSTINGER_DEPLOYMENT.md')
foreach ($sourceDir in @('backend/src', 'backend/migrations', 'packages/shared/src')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $repoRoot $sourceDir) -Recurse -File |
        Where-Object { $_.Name -notmatch '\.test\.ts$' } |
        ForEach-Object { $_.FullName.Substring($repoRoot.Length + 1) }
}
foreach ($relative in $files) {
    $target = Join-Path $apiStage $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $target
}
Compress-Archive -Path "$apiStage/*" -DestinationPath (Join-Path $artifactRoot 'backend-source.zip')
Write-Output "Upload archives are in: $artifactRoot"
