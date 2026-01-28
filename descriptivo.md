# Sincronización de Expertos IA - Proyecto: Reconocimiento Facial

Este archivo es la **Fuente de Verdad** para la coordinación entre diferentes chats de IA especializados. Cada chat (o "experto") debe leer este archivo al iniciar y actualizarlo al finalizar su tarea.

## 🤖 Roles Definidos
1.  **Arquitecto / Lead**: Coordina la visión general y delega tareas.
2.  **Experto Visual (UI/UX)**: Encargado de CSS, estética, animaciones y fluidez visual.
3.  **Experto en Lógica**: Encargado de algoritmos, estado de la app, y lógica de negocio (JS/TS).
4.  **Experto Backend/Datos**: Encargado de Firebase (Firestore, Auth, Storage) y APIs.
5.  **Experto Móvil/Sistemas**: Encargado de Capacitor, compilación Android/iOS, y despliegue.
6.  **Experto en Ciberseguridad**: Encargado de encriptación, reglas de Firebase, protección de descriptores biométricos y auditoría de accesos.

---

## 📍 Estado Actual del Proyecto
- **Rama principal**: Production / Development.
- **Tecnologías**: HTML, Vanilla CSS, Vite, JavaScript, Firebase, Capacitor (Face-API.js / MediaPipe).
- **Hito Actual**: Implementación de estrategia de expertos.

## 📝 Registro de Cambios y Decisiones (Handover)

| Fecha | Experto | Acción / Decisión | Nota para otros Expertos |
| :--- | :--- | :--- | :--- |
| 2026-01-25 | Arquitecto | Creación de descriptivo.md | Se inicializa el sistema de coordinación modular. |
| 2026-01-25 | Lógica | Motor Híbrido MP + FaceAPI | Implementación de Sentinel (MediaPipe) + Deep Recognition (Face-API) para velocidad y precisión. |
| 2026-01-26 | Visual/Lógica | Optimización y Gestión Directa | **Remoción de animaciones**: Se quitaron transiciones y efectos para máxima velocidad. **Gestión en Home**: Se permite crear equipos/categorías/jugadores desde el Inicio. **Modales Modernos**: Reemplazo de prompts por modales rápidos. **Vista Previa**: Inclusión de zoom de fotos de jugadores. |

---

## 🚀 Pendientes por Área

### 🎨 Visual
- [x] Revisar consistencia de colores y tipografía. (Ajustado a premium oscuro)
- [x] Optimizar respuesta móvil en la sección de registro. (Mejorado con modales inline)
- [x] Eliminar animaciones y transiciones por performance.

### 🧠 Lógica
- [x] Refinar precisión de detección face-api vs mediapipe. (Motor Híbrido implementado)
- [x] Manejo de errores en carga de modelos. (Sistema de init unificado)
- [x] Gestión de equipos y categorías desde Inicio.
- [ ] Implementar cooldown inteligente tras match exitoso.

### ☁️ Backend
- [ ] Optimizar reglas de seguridad de Firestore.

### 📱 Sistemas
- [x] Verificar build de Android con las nuevas dependencias. (Desplegado exitosamente)

---

## 📌 Notas Críticas / Advertencias
- **Espacio en C:**: NO instalar nada en C:. Todo debe ir en el disco D: o relativo al proyecto.
- **Idioma**: Todo el código y comentarios deben ser en Español.
