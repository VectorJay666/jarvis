[CmdletBinding()]
param([string]$LanAddress)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$appRoot = Join-Path $projectRoot 'app'
$logRoot = Join-Path $projectRoot 'review-artifacts'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$nodePath = (Get-Command node -ErrorAction Stop).Source
if (-not $LanAddress) {
    $network = Get-NetIPConfiguration | Where-Object {
        $_.IPv4DefaultGateway -and $_.IPv4Address.IPAddress -notmatch '^(127|169\.254)\.'
    } | Select-Object -First 1
    $LanAddress = $network.IPv4Address.IPAddress | Select-Object -First 1
}
if (-not $LanAddress -or $LanAddress -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
    throw '没有找到 Wi-Fi / 网线地址，请连接网络后重试。'
}
$backendAddress = "http://${LanAddress}:9301"
$backendPort = Get-NetTCPConnection -LocalPort 9301 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backendPort) {
    $status = Invoke-RestMethod 'http://127.0.0.1:9301/health' -TimeoutSec 5
    if ($status.service -ne 'jarvis-council') { throw '9301 被其他服务占用，未修改该服务。' }
} else {
    $backendScript = Join-Path $projectRoot 'server/council.mjs'
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $backendScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'local-backend.log') -RedirectStandardError (Join-Path $logRoot 'local-backend-error.log') | Out-Null
}
$expoPort = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($expoPort) {
    $expoProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($expoPort.OwningProcess)"
    if ($expoProcess.CommandLine -notmatch [regex]::Escape($appRoot) -or $expoProcess.CommandLine -notmatch 'expo.*start') {
        throw '8081 被其他项目占用，未停止该项目。'
    }
    Stop-Process -Id $expoPort.OwningProcess
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 250
    }
}
$expoCli = Join-Path $appRoot 'node_modules/expo/bin/cli'
if (-not (Test-Path -LiteralPath $expoCli)) {
    $lockfile = Join-Path $appRoot 'package-lock.json'
    $install = if (Test-Path -LiteralPath $lockfile) { 'npm ci' } else { 'npm install' }
    throw "请先在 app 文件夹运行 $install 安装依赖。"
}
$previousApi = $env:EXPO_PUBLIC_API_BASE
$previousHost = $env:REACT_NATIVE_PACKAGER_HOSTNAME
try {
    $env:EXPO_PUBLIC_API_BASE = $backendAddress
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanAddress
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $expoCli + '"', 'start', '--lan', '--port', '8081', '--clear') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'local-expo.log') -RedirectStandardError (Join-Path $logRoot 'local-expo-error.log') | Out-Null
} finally {
    $env:EXPO_PUBLIC_API_BASE = $previousApi
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $previousHost
}
@{ address = $LanAddress; page = "http://${LanAddress}:8081"; backend = $backendAddress; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'local-test-address.json') -Encoding UTF8
Write-Output "iPhone 与电脑连接同一 Wi-Fi，在 Safari 打开：http://${LanAddress}:8081"
Write-Output "后端检查地址：${backendAddress}/health"
Write-Output '这是浏览器测试；原生 iOS 安装仍需 Mac/Xcode 或开发者会员。'
