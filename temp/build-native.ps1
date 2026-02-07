# Build Native Script (Android/iOS) - No Web Deploy
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "   ADCC BIOMETRIC - CONSTRUCCION NATIVA (OFFLINE)" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 1. Incrementar Version (Patch)
Write-Host "[1/5] Incrementando versión..." -ForegroundColor Yellow
npm version patch --no-git-tag-version
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error al versionar. Verifica package.json" -ForegroundColor Red
    exit 1 
}

# Obtener la nueva versión para sincronizar archivos
$NEW_VER = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "Nueva versión nativa: $NEW_VER" -ForegroundColor Gray

# Actualizar public/version.json
if (Test-Path "public/version.json") {
    $vjson = Get-Content public/version.json | ConvertFrom-Json
    $vjson.android.version = $NEW_VER
    $vjson | ConvertTo-Json -Depth 10 | Set-Content public/version.json
    Write-Host "✅ public/version.json actualizado" -ForegroundColor Gray
}

# 2. Sincronizar Versión Android (Gradle)
Write-Host "[2/5] Actualizando Gradle (Android)..." -ForegroundColor Yellow
$gradlePath = "android/app/build.gradle"
if (Test-Path $gradlePath) {
    $vCode = ($NEW_VER.Split('.') | ForEach-Object { $_.PadLeft(2, '0') }) -join ''
    $vCode = [int]$vCode
    
    (Get-Content $gradlePath) `
        -replace 'versionCode \d+', "versionCode $vCode" `
        -replace 'versionName ".*"', "versionName ""$NEW_VER""" | 
    Set-Content $gradlePath
    Write-Host "✅ Android Version: $NEW_VER (Code: $vCode)" -ForegroundColor Gray
}

# 3. Construir Web App (Vite Build)
Write-Host "[3/5] Compilando React/Vite..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error en la compilación web." -ForegroundColor Red
    exit 1 
}

# Copiar Modelos de IA
Write-Host "   > Copiando modelos de IA..."# Copiar modelos de IA a dist (ahora ai_models)
if (!(Test-Path "dist/ai_models")) { 
    New-Item -ItemType Directory -Force -Path "dist/ai_models" | Out-Null 
}
Copy-Item "public/ai_models/*" "dist/ai_models" -Recurse -Force

# 4. Sincronizar Capacitor (Android & iOS)
Write-Host "[4/5] Sincronizando IOS y ANDROID..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al sincronizar Capacitor." -ForegroundColor Red
    exit 1
}

# 5. Generar APK (Android)
Write-Host "[5/5] Generando APK..." -ForegroundColor Yellow

$javaVer = java -version 2>&1 | Out-String
if ($javaVer -like "*1.8.0*") {
    Write-Host "⚠️ ADVERTENCIA: Java 8 detectado. Podria fallar el build." -ForegroundColor DarkYellow
}

Push-Location android
.\gradlew assembleDebug
$gradleResult = $LASTEXITCODE
Pop-Location

if ($gradleResult -eq 0 -and (Test-Path "android/app/build/outputs/apk/debug/app-debug.apk")) {
    if (!(Test-Path "build_outputs")) { New-Item -ItemType Directory -Path "build_outputs" | Out-Null }
    
    $apkName = "adcc-v$NEW_VER.apk"
    Copy-Item "android/app/build/outputs/apk/debug/app-debug.apk" "build_outputs/$apkName" -Force
    
    Write-Host "------------------------------------------------" -ForegroundColor Green
    Write-Host "  EXITO. APK GENERADO:" -ForegroundColor Green
    Write-Host "  Ubicacion: build_outputs/$apkName" -ForegroundColor Cyan
    Write-Host "  Pasalo al celular e instala." -ForegroundColor Gray
    Write-Host "------------------------------------------------" -ForegroundColor Green
}
else {
    Write-Host "❌ Error: La compilación del APK falló." -ForegroundColor Red
}

