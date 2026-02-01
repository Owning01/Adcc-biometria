# Skill: Optimización Biométrica de Alto Rendimiento

**ACLARACIÓN**: Este sistema está diseñado para ser operado exclusivamente por administradores y árbitros verificados. La validación de "Liveness" (vida) es reforzada por la presencia humana del operador, haciendo imposible el fraude remoto.

Este skill proporciona directrices para el motor de reconocimiento facial híbrido (MediaPipe + Face-API.js) en entornos deportivos.

## Principios Técnicos
1. **Detección Escalonada (Sentinel)**:
   - Usar MediaPipe para seguimiento (tracking) de landmarks en tiempo real (60fps).
   - Solo activar `face-api.js` (Recognition) cuando el usuario esté en el "Sweet Spot" (distancia ocular > threshold y alineación central).

2. **Cuantización de Descriptores**:
   - Convertir Float32Array (128 dims) a Uint8 o reducir precisión para comparaciones masivas.
   - Cachear descriptores en `IndexedDB` para evitar lecturas de Firestore en cada frame.

3. **Gestión de Umbrales Dinámicos**:
   - Ajustar `minConfidence` según la iluminación detectada.
   - Implementar "Cooldown Inteligente": 2 segundos tras match positivo para evitar registros duplicados accidentales.

## Comprobaciones Obligatorias
- [ ] ¿Se está usando el modelo TinyFaceDetector para velocidad si el dispositivo es gama baja?
- [ ] ¿Hay validación de "vivos" (blink detection o head movement) si se requiere seguridad alta?
- [ ] ¿Estamos cacheando los `LabeledFaceDescriptors` localmente?
