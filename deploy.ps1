# Deploy Script for Windows
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "   ADCC BIOMETRIC - PROCESO DE DESPLIEGUE" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 1. Incrementar Version (Patch)
Write-Host "[1/4] Incrementando versión..." -ForegroundColor Yellow
npm version patch --no-git-tag-version
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error al versionar. Verifica package.json" -ForegroundColor Red
    exit 1 
}

# Obtener la nueva versión para sincronizar archivos
$NEW_VER = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "Nueva versión detectada: $NEW_VER" -ForegroundColor Gray

# Actualizar public/version.json
if (Test-Path "public/version.json") {
    $vjson = Get-Content public/version.json | ConvertFrom-Json
    $vjson.android.version = $NEW_VER
    $vjson | ConvertTo-Json -Depth 10 | Set-Content public/version.json
    Write-Host "✅ public/version.json actualizado a $NEW_VER" -ForegroundColor Gray
}

# --- NUEVO: Sincronizar Version con Android y Compilar APK ---
Write-Host "[1.5/4] Sincronizando versión con Android..." -ForegroundColor Yellow
$gradlePath = "android/app/build.gradle"
if (Test-Path $gradlePath) {
    $vCode = ($NEW_VER.Split('.') | ForEach-Object { $_.PadLeft(2, '0') }) -join ''
    $vCode = [int]$vCode
    
    (Get-Content $gradlePath) `
        -replace 'versionCode \d+', "versionCode $vCode" `
        -replace 'versionName ".*"', "versionName ""$NEW_VER""" | 
    Set-Content $gradlePath
    Write-Host "✅ Android build.gradle actualizado (Code: $vCode, Name: $NEW_VER)" -ForegroundColor Gray
}

# 2. Construir (Build)
Write-Host "[2/4] Compilando Aplicación React/Vite..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error en la compilación. Revisa errores de código." -ForegroundColor Red
    exit 1 
}

# 3. Copiar Modelos de IA (Critico para local)
Write-Host "[3/4] Asegurando modelos de IA en carpeta dist..." -ForegroundColor Yellow
if (!(Test-Path "dist/models")) { New-Item -ItemType Directory -Force -Path "dist/models" | Out-Null }
Copy-Item -Path "public/models/*" -Destination "dist/models" -Recurse -Force

# 4. Sincronizar Capacitor (Android/iOS)
Write-Host "[4/4] Sincronizando App Nativa (Capacitor)..." -ForegroundColor Yellow
npx cap sync

# --- NUEVO: Compilar APK real ---
Write-Host "[4.5/4] Generando nuevo APK (Gradle)..." -ForegroundColor Yellow

# Detectar version de Java para alertar al usuario
$javaVer = java -version 2>&1 | Out-String
if ($javaVer -like "*1.8.0*") {
    Write-Host "⚠️ ADVERTENCIA: Tienes Java 8 en esta terminal. El APK probablemente fallará." -ForegroundColor DarkYellow
    Write-Host "Te recomiendo actualizar JAVA_HOME a la ruta de 'jbr' de Android Studio." -ForegroundColor Gray
}

Push-Location android
.\gradlew assembleDebug
$gradleResult = $LASTEXITCODE
Pop-Location

if ($gradleResult -eq 0 -and (Test-Path "android/app/build/outputs/apk/debug/app-debug.apk")) {
    if (!(Test-Path "build_outputs")) { New-Item -ItemType Directory -Path "build_outputs" | Out-Null }
    Copy-Item "android/app/build/outputs/apk/debug/app-debug.apk" "build_outputs/adcc-biometric.apk" -Force
    Write-Host "✅ APK actualizado en carpeta build_outputs/" -ForegroundColor Green
}
else {
    Write-Host "❌ Error: La compilación del APK falló." -ForegroundColor Red
}

# 5. Desplegar a Firebase Hosting
Write-Host "[5/4] Subiendo cambios a la Web (Firebase)..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error fatal: No se pudo subir el Hosting." -ForegroundColor Red
    exit 1 
}

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "PROCESO FINALIZADO CON EXITO" -ForegroundColor Green
Write-Host "Web: https://recofacial-7cea1.web.app" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
