# test-calif-opiniones.ps1
# Script para publicar un click en Calificaciones y verificar que Opiniones lo consuma y lo guarde en MongoDB (vía API)

$calificacionesUrl = "http://localhost:3003/api/calificaciones"
$opinionesApi = "http://localhost:3004/api/opiniones/usuario/testUser_script"

# Payload de prueba
$body = @{
    userId = "testUser_script"
    movieId = "testMovie_script"
    movieTitle = "Prueba desde script"
} | ConvertTo-Json

Write-Host "[1/3] Publicando mensaje a Calificaciones..." -ForegroundColor Cyan
try {
    $postResp = Invoke-RestMethod -Uri $calificacionesUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "-> Respuesta POST:" -ForegroundColor Green
    $postResp | ConvertTo-Json -Depth 4 | Write-Host
} catch {
    Write-Host "ERROR: No se pudo publicar en Calificaciones:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Esperar un momento y consultar Opiniones repetidamente
Write-Host "[2/3] Esperando a que Opiniones consuma el mensaje..." -ForegroundColor Cyan
$found = $false
$maxAttempts = 12
for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 1
    try {
        $check = Invoke-RestMethod -Uri $opinionesApi -Method GET -ErrorAction Stop
        if ($check.total -gt 0) {
            Write-Host "-> Mensaje encontrado en Opiniones (intento $i)." -ForegroundColor Green
            $check | ConvertTo-Json -Depth 6 | Write-Host
            $found = $true
            break
        } else {
            Write-Host "(intento $i) Aún no está disponible..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "(intento $i) No se pudo consultar la API de Opiniones: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $found) {
    Write-Host "[!] No se encontró el mensaje en Opiniones después de $maxAttempts intentos." -ForegroundColor Red
    Write-Host "Revisa: 1) que Opiniones esté corriendo, 2) que RabbitMQ esté disponible, 3) logs de Opiniones (docker logs o consola)." -ForegroundColor Red
    exit 2
}

# Limpieza opcional: eliminar datos de prueba
Write-Host "[3/3] Eliminando datos de prueba de Opiniones (opcional)..." -ForegroundColor Cyan
try {
    $del = Invoke-RestMethod -Uri "http://localhost:3004/api/opiniones/usuario/testUser_script" -Method DELETE -ErrorAction Stop
    Write-Host "-> Resultado eliminación:" -ForegroundColor Green
    $del | ConvertTo-Json -Depth 4 | Write-Host
} catch {
    Write-Host "No se pudo eliminar datos de prueba (pero la prueba fue completada). Mensaje: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "\nPrueba completada." -ForegroundColor Green
