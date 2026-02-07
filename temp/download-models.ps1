# Script para descargar modelos de face-api.js frescos y sobrescribir los locales
# Esto soluciona errores de corrupción o git-lfs pointers

$baseUrl = "https://github.com/justadudewhohacks/face-api.js/raw/master/weights"
$destDir = "public/models"

# Asegurar directorio
if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir }

$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

Write-Host "Iniciando descarga de modelos..." -ForegroundColor Cyan

foreach ($file in $files) {
    if ($file -match "shard") {
        # Los shards son binarios, usamos raw directamente
        # A veces GitHub raw redirige, Invoke-WebRequest maneja esto
        $url = "$baseUrl/$file"
    }
    else {
        $url = "$baseUrl/$file"
    }
    
    $outputPath = Join-Path $destDir $file
    Write-Host "Descargando: $file..." -NoNewline
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath -UseBasicParsing
        Write-Host " [OK]" -ForegroundColor Green
    }
    catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "Descarga completada." -ForegroundColor Green
