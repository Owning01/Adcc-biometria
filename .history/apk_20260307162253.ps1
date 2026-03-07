# SCRIPT DEPELEGUE TOTAL "GOD MODE"
# Autor: Octavio (via Antigravity)
# Descripción: Automatización completa de Web + Nativo + GitHub Release + Link Update

$ErrorActionPreference = "Stop"

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "       ADCC BIOMETRIC -" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# PVERIFICACIÓN PREVIA: GITHUB CLI Y CORRECCIÓN DE PATH
# Intentar añadir al PATH si no se encuentra
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    $ghPath = "C:\Program Files\GitHub CLI"
    if (Test-Path "$ghPath\gh.exe") {
        Write-Host "⚠️ GitHub CLI encontrado pero no en PATH. Agregando temporalmente..." -ForegroundColor Yellow
        $env:PATH = "$ghPath;$env:PATH"
    }
}

if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR FATAL: GitHub CLI (gh) no está instalado o en el PATH." -ForegroundColor Red
    Write-Host "Por favor instala GH CLI o reinicia VS Code." -ForegroundColor Red
    exit 1
}

# NUEVO: Verificar autenticación en GitHub
Write-Host "🔍 Verificando sesión en GitHub..." -ForegroundColor Gray
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: No estás autenticado en GitHub CLI." -ForegroundColor Red
    Write-Host "Ejecuta 'gh auth login' antes de continuar." -ForegroundColor Red
    exit 1
}

# 1. BUMP VERSION
Write-Host "[1/6] Incrementando Versión..." -ForegroundColor Yellow
npm version patch --no-git-tag-version
$NEW_VER = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "🚀 Nueva Versión: v$NEW_VER" -ForegroundColor Green

# 2. CALCULAR URL DE DESCARGA (PREDICCIÓN) Y ACTUALIZAR JSON
Write-Host "[2/6] Configurando Links de Descarga..." -ForegroundColor Yellow
$REPO = "Owning01/Adcc-biometria"
$REL_REPO = "Owning01/biometricreleases"
$APK_FILENAME = "adcc-v$NEW_VER.apk"
$DOWNLOAD_URL = "https://github.com/$REL_REPO/releases/download/v$NEW_VER/$APK_FILENAME"

$releaseData = @{
    version     = $NEW_VER
    downloadUrl = $DOWNLOAD_URL
    releaseDate = (Get-Date).ToString("yyyy-MM-dd HH:mm")
}

$releaseData | ConvertTo-Json | Set-Content "src/release.json"
Write-Host "✅ src/release.json actualizado con URL futura:" -ForegroundColor Gray
Write-Host "   $DOWNLOAD_URL" -ForegroundColor Gray

# 2.6 ACTUALIZAR PUBLIC/VERSION.JSON (Para el Check In-App)
$versionData = @{
    android = @{
        version   = $NEW_VER
        url       = $DOWNLOAD_URL
        mandatory = $true
    }
    ios     = @{
        version   = $NEW_VER
        url       = "#"
        mandatory = $true
    }
}
$versionData | ConvertTo-Json | Set-Content "public/version.json"
Write-Host "✅ public/version.json actualizado." -ForegroundColor Gray

# 2.5 Actualizar build.gradle de Android
$gradlePath = "android/app/build.gradle"
if (Test-Path $gradlePath) {
    # Cambiamos a padding de 3 dígitos para evitar colisiones entre minor versions (ej 0.0.219 vs 0.1.0)
    $vCode = ($NEW_VER.Split('.') | ForEach-Object { $_.PadLeft(3, '0') }) -join ''
    $vCode = [int64]$vCode
    (Get-Content $gradlePath) `
        -replace 'versionCode \d+', "versionCode $vCode" `
        -replace 'versionName ".*"', "versionName ""$NEW_VER""" | 
    Set-Content $gradlePath
}

# 3. BUILD WEB (Ahora incluye el JSON actualizado)
Write-Host "[3/6] Compilando Web App (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

# Copiar modelos (Renombrado a ai_models para cache busting)
if (!(Test-Path "dist/ai_models")) { New-Item -ItemType Directory -Force -Path "dist/ai_models" | Out-Null }
Copy-Item "public/ai_models/*" "dist/ai_models" -Recurse -Force

# 4. DEPLOY FIREBASE
Write-Host "[4/6] Subiendo a Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { 
    Write-Host "⚠️ Error al subir a Firebase. (Continuando con APK...)" -ForegroundColor DarkYellow 
}

# 5. BUILD NATIVO (ANDROID)
Write-Host "[5/6] Generando APK Nativo..." -ForegroundColor Yellow
npx cap sync
Push-Location android
.\gradlew assembleDebug
Pop-Location

$apkSource = "android/app/build/outputs/apk/debug/app-debug.apk"
$apkDest = "build_outputs/$APK_FILENAME"

if (!(Test-Path "build_outputs")) { New-Item -ItemType Directory "build_outputs" | Out-Null }
Copy-Item $apkSource $apkDest -Force

if (!(Test-Path $apkDest)) {
    Write-Host "❌ Error: No se generó el APK." -ForegroundColor Red
    exit 1
}

# 6. GITHUB RELEASE (SUBIDA)
Write-Host "[6/6] Publicando en GitHub Releases..." -ForegroundColor Yellow

# Commit de los cambios de versión
git add package.json src/release.json public/version.json android/app/build.gradle package-lock.json
git commit -m "chore: release v$NEW_VER [skip ci]"
git push origin main

# Crear Release y Subir APK al repositorio dedicado
# Nota: Usamos 'v$NEW_VER' como tag
gh release create "v$NEW_VER" $apkDest --repo $REL_REPO --title "v$NEW_VER" --notes "Actualización Automática desde God Mode"

if ($LASTEXITCODE -eq 0) {
    Write-Host "------------------------------------------------" -ForegroundColor Green
    Write-Host "✨ ¡GOD MODE COMPLETADO! ✨" -ForegroundColor Green
    Write-Host "------------------------------------------------" -ForegroundColor Green
    Write-Host "1. Versión Web Actualizada: https://adccbiometric.web.app" -ForegroundColor Cyan
    Write-Host "2. Release GitHub Creado: v$NEW_VER" -ForegroundColor Cyan
    Write-Host "3. APK Subido y Vinculado." -ForegroundColor Cyan
    Write-Host "------------------------------------------------" -ForegroundColor Green
}
else {
    Write-Host "❌ Error al subir a GitHub. Verifica tu login 'gh auth login'" -ForegroundColor Red
}
