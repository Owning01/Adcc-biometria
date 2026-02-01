# Skill: Sincronización Offline-First (Firestore)

Este skill asegura que los datos de los partidos no se pierdan en canchas con mala señal.

## Arquitectura de Sincronización
1. **Event Sourcing (Append-Only)**:
   - NO actualizar el documento del partido para cada gol.
   - SÍ crear un documento nuevo en una subcolección `/partidos/{id}/eventos`.
   - Firestore fusionará los eventos cuando vuelva la conexión.

2. **Identificadores Únicos Cliente (UUID)**:
   - Generar el ID del evento en el móvil antes de enviar a Firebase.
   - Previene duplicidad si la red intenta re-enviar el mismo paquete.

3. **Estimación de Tiempo**:
   - Usar `ServerTimestamp` con `localEstimates`.
   - Guardar `timestamp_inicio_real` (Date.now()) al inicio del partido para cálculos de cronómetro offline.

4. **Persistencia Web**:
   - Asegurar `enableIndexedDbPersistence()` en la inicialización de Firebase.

## Comprobaciones Obligatorias
- [ ] ¿Estamos usando UUIDs generados localmente?
- [ ] ¿La lógica de "Goles Totales" se calcula sumando eventos (Local Sum) en lugar de leer un contador del servidor?
- [ ] ¿Se muestra el indicador de "Sin Conexión / Pendiente de Sincronizar"?
