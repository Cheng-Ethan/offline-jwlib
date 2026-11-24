$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Utf8 = [Text.Encoding]::UTF8
$ManifestPath = Join-Path $Root 'project.json'
if (-not (Test-Path $ManifestPath)) { throw 'Missing project.json.' }
$Manifest = Get-Content $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Manifest.appVersion) { throw 'project.json has no appVersion.' }
if ([int]$Manifest.moduleApiVersion -ne 1) { throw "Unsupported module API version: $($Manifest.moduleApiVersion)" }
$Template = [IO.File]::ReadAllText((Join-Path $Root 'src/index.template.html'), $Utf8)
$Css = [IO.File]::ReadAllText((Join-Path $Root 'src/styles.css'), $Utf8)
$JsZip = [IO.File]::ReadAllText((Join-Path $Root 'src/vendor/jszip.js'), $Utf8)
$Pako = [IO.File]::ReadAllText((Join-Path $Root 'src/vendor/pako.js'), $Utf8)
$Sqlite = [IO.File]::ReadAllText((Join-Path $Root 'src/vendor/sql-wasm.js'), $Utf8)
$Categories = [IO.File]::ReadAllText((Join-Path $Root 'src/categories.json'), $Utf8)
$Modules = foreach ($Module in ($Manifest.modules | Sort-Object order)) {
    if ([int]$Module.requiresApi -gt [int]$Manifest.moduleApiVersion) { throw "Module $($Module.file) requires a newer module API." }
    $ModulePath = Join-Path $Root ("src/modules/" + $Module.file)
    if (-not (Test-Path $ModulePath)) { throw "Missing module: $($Module.file)" }
    [IO.File]::ReadAllText($ModulePath, $Utf8)
}
$App = $Modules -join "`n"
$Output = $Template.Replace('@@CSS@@', $Css)
$Output = $Output.Replace('@@VENDOR_JSZIP@@', $JsZip)
$Output = $Output.Replace('@@VENDOR_PAKO@@', $Pako)
$Output = $Output.Replace('@@VENDOR_SQLITE@@', $Sqlite)
$Output = $Output.Replace('@@CATEGORIES_JSON@@', $Categories)
$Output = $Output.Replace('@@APP_JS@@', $App)
$Output = $Output.Replace('@@APP_VERSION@@', [string]$Manifest.appVersion)
if ($Output.Contains('@@')) { throw 'Build failed: template contains an unresolved placeholder.' }
$OutPath = Join-Path $Root 'offline_library.html'
$DistDir = Join-Path $Root 'dist'
$RollbackDir = Join-Path $Root 'rollback'
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
if (Test-Path $OutPath) {
    New-Item -ItemType Directory -Force -Path $RollbackDir | Out-Null
    $Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    Copy-Item $OutPath (Join-Path $RollbackDir "offline_library_$Stamp.html")
}
[IO.File]::WriteAllText($OutPath, $Output, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $DistDir 'offline_library.html'), $Output, [Text.UTF8Encoding]::new($false))
Write-Host "Build complete: $OutPath" -ForegroundColor Green
Write-Host "Version: $($Manifest.appVersion)"
Write-Host ("Size: {0:N0} bytes" -f ([IO.FileInfo]$OutPath).Length)
Write-Host 'Previous builds, if any, are saved in the rollback folder.'
