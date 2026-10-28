$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$packageOutput = & pnpm lan:package
if ($LASTEXITCODE -ne 0) { throw 'LAN packaging failed' }
$package = [string]($packageOutput | Select-Object -Last 1)
$package = [IO.Path]::GetFullPath($package.Trim())
if (-not $package.StartsWith((Join-Path $root 'releases') + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid package path' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler required' }
Add-Type -AssemblyName System.Drawing
$iconPath = Join-Path $package 'Brio.ico'
$bitmap = New-Object Drawing.Bitmap (Join-Path $root 'apps/web/public/favicon.png')
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconFile = [IO.File]::Create($iconPath)
try { $icon.Save($iconFile) } finally { $iconFile.Dispose(); $icon.Dispose(); $bitmap.Dispose() }
$logoPath = Join-Path $root 'apps/web/public/bolt-original.png'
$launcherSources = Get-ChildItem -LiteralPath (Join-Path $root 'apps/desktop') -Filter 'BrioLauncher*.cs' | ForEach-Object { $_.FullName }
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/win32icon:$iconPath" "/resource:$iconPath,Brio.Icon" "/resource:$logoPath,Brio.Logo" "/out:$package/Brio.exe" $launcherSources
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/win32icon:$iconPath" "/out:$package/Uninstall.exe" (Join-Path $root 'apps\desktop\BrioUninstall.cs')
if ($LASTEXITCODE -ne 0) { throw 'Uninstaller compilation failed' }
Remove-Item -LiteralPath (Join-Path $package 'Start-Brio.cmd')
Set-Content -LiteralPath (Join-Path $package 'README.txt') -Encoding utf8 -Value 'Brio LAN for Windows 10/11 x64. Open Brio.exe. Use Start, Open dashboard and Stop. Quizzes and results are in %LOCALAPPDATA%/Brio/data. Phones join the same trusted Wi-Fi by QR. This pilot application is unsigned; never bypass a security warning. Third-party licenses are included.'
$id = Split-Path -Leaf $package
$payload = Join-Path $root "releases/$id-payload.zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($package, $payload, [IO.Compression.CompressionLevel]::Optimal, $false)
$installer = Join-Path $root "releases/$id-Setup.exe"
$setupSources = Get-ChildItem -LiteralPath (Join-Path $root 'apps/desktop') -Filter 'BrioSetup*.cs' | ForEach-Object { $_.FullName }
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/win32icon:$iconPath" "/resource:$iconPath,Brio.Icon" "/resource:$logoPath,Brio.Logo" "/resource:$payload,Brio.Payload" "/out:$installer" $setupSources
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
node scripts/stage-desktop-download.mjs $installer
if ($LASTEXITCODE -ne 0) { throw 'Download staging failed' }
Write-Output "Installer: $installer"

