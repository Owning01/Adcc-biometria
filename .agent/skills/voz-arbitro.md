# Skill: Interacción por Voz (Ref-Voice)

Optimización para arbitraje "Manos Libres" en campo.

## Implementación de Web Speech API
1. **Comandos Clave**:
   - "Gol Equipo A", "Tarjeta Amarilla 10", "Cambio Salida 5".
   - Usar `SpeechRecognition` con `continuous: true` e `interimResults: true`.

2. **Filtro de Ruido Ambiental**:
   - Ignorar resultados con `confidence < 0.7`.
   - Implementar un "Hotword" para activar el escucha (ej: "Ref-Check").

3. **Confirmación de Voz (Speech Synthesis)**:
   - El sistema debe confirmar por audio: "Registrado Gol Local".
   - Esto permite al árbitro no mirar el celular durante el juego.

## Comprobaciones Obligatorias
- [ ] ¿El micrófono tiene permiso persistente en el navegador?
- [ ] ¿La lógica de parseo maneja sinónimos (ej: "Amonestación" = "Tarjeta Amarilla")?
- [ ] ¿Se usa una voz clara y neutral para el feedback?
