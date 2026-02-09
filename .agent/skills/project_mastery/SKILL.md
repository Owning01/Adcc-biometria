---
name: Project Context Mastery
description: Una guía completa del proyecto ADCC Biometric, incluyendo arquitectura, orquestación de servicios, flujos de datos clave y estándares de UI. Invoca esta habilidad para obtener una comprensión instantánea de toda la estructura y relaciones del código.
---

# 🧠 ADCC Biometric - Dominio del Contexto del Proyecto

Esta habilidad proporciona una comprensión profunda de la aplicación ADCC Biometric, una sofisticada aplicación web **React + Firebase** para autenticación biométrica y gestión deportiva.

## 🏗️ Arquitectura Central

La aplicación es una Single Page Application (SPA) construida con React. Utiliza una **Arquitectura Híbrida** para el reconocimiento facial, combinando procesamiento del lado del cliente (MediaPipe para velocidad) con verificaciones del servidor o modelos de aprendizaje profundo locales (Face-API/TensorFlow.js) para precisión.

### Componentes Clave:

| Componente | Responsabilidad | Ubicación |
| :--- | :--- | :--- |
| **App.tsx** | **Orquestador**. Maneja el Enrutamiento, Estado de Auth Global (`userRole`), y el **Modal de Login Biométrico Global**. Actúa como el contenedor de diseño principal. | `src/App.tsx` |
| **index.css** | **Sistema de Diseño**. Define todos los estilos globales, temas (Oscuro/Claro/Dorado), utilidades de Glassmorphism y diseños responsivos. NO se deben usar otros archivos CSS a menos que estén escopados. | `src/index.css` |
| **db.ts** | **Capa de Datos**. Abstracción sobre Firebase Firestore. Maneja CRUD para Usuarios, Partidos, Equipos y Logs (`AuditLogs`). | `src/services/db.ts` |
| **Firebase** | **Backend**. Autenticación (Email/Password), Firestore (Base de Datos), Storage (Imágenes). | `src/firebase.ts` |

---

## 👁️ Motor Biométrico (La Característica Central)

El punto de venta único del proyecto es su avanzado sistema biométrico híbrido.

### 1. La Estrategia "Híbrida"
Para asegurar una UX fluida, usamos dos modelos en paralelo:
*   **MediaPipe (Rápido/Ligero)**: Usado para seguimiento en tiempo real, feedback de UI (cajas verdes/rojas) y chequeos de calidad (distancia, iluminación). Corre en `mediapipeService.ts`.
*   **Face-API / TensorFlow (Profundo/Pesado)**: Usado solo cuando la calidad es "OK". Extrae el descriptor facial único para identificación. Corre en `faceServiceLocal.ts`.

### 2. Orquestación de Servicios
La lógica de conexión está centralizada en **`hybridFaceService.ts`**:
1.  **Init**: Pre-carga ambos modelos (`initHybridEngine`).
2.  **Bucle de Detección**: La UI (ej. `App.tsx` o `AltaLocal.tsx`) corre un bucle llamando a `detectFaceMediaPipe`.
3.  **Validar**: `checkFaceQuality` analiza la detección (muy lejos/cierca).
4.  **Reconocer**: Si es válido, se llama a `getFaceDataLocal` para obtener el descriptor y comparar con la base de datos de usuarios.

### 3. Archivos Clave
*   `src/services/hybridFaceService.ts`: El pegamento entre reconocimiento rápido y profundo.
*   `src/services/mediapipeService.ts`: Implementación de Google MediaPipe.
*   `src/services/faceServiceLocal.ts`: Carga de modelos locales y extracción de descriptores.
*   `src/pages/AltaLocal.tsx`: La página principal de "Modo Kiosco" o "Consulta" donde los usuarios verifican su estado.
*   `src/App.tsx`: Implementa el **Login Biométrico Global** usando la misma lógica que AltaLocal.

---

## 🎨 UI y Estándares de Diseño (Estética Premium)

El usuario exige un factor "WOW". La filosofía de diseño es **Tecnología Deportiva Futurista Premium**.

*   **Glassmorphism**: Uso intensivo de `backdrop-filter: blur()`, fondos semi-transparentes (`rgba(255,255,255,0.05)`), y bordes delicados (`1px solid rgba(255,255,255,0.1)`).
*   **Colores**: 
    *   Primario: Dorado (`#d4af37`) o Azul (`#3b82f6`) dependiendo del contexto.
    *   Fondo: Degradados oscuros profundos (`radial-gradient`).
    *   Estado: Verde (Éxito/Seguro), Rojo (Error/Peligro), Ámbar (Advertencia/Procesando).
*   **Tipografía**: Sans-serif limpia y moderna (Outfit/Inter). Mayúsculas para encabezados (`tracking-wider`).
*   **Responsividad**: 
    *   **Escritorio**: Diseños de cuadrícula, navegación lateral.
    *   **Móvil**: Tarjetas apiladas, encabezados complejos ocultos, objetivos táctiles optimizados.
    *   **Hexágonos**: Tarjetas de equipo personalizadas son formas hexagonales definidas en `index.css`.

---

## 🔄 Flujo de Datos y Gestión de Estado

1.  **Estado de Usuario**: Gestionado en `App.tsx` (`userRole`, `currentUser`). Pasado hacia abajo o accedido vía contexto si es necesario (aunque actualmente se usan props/local storage).
2.  **Datos Faciales**: Almacenados en IndexedDB (lado del cliente) para rendimiento o obtenidos de Firebase Storage/Firestore al inicio.
3.  **Logs**: Cada acción crítica (Login, Acceso Permitido/Denegado) se registra vía `auditService.ts`.

---

## 🛠️ Flujo de Trabajo y Reglas del Desarrollador

1.  **Siempre Revisar `index.css`**: Antes de escribir nuevos estilos, revisa las clases de utilidad existentes. Mantén la consistencia.
2.  **Paridad Biométrica**: Cualquier mejora a la detección facial en `AltaLocal.tsx` **DEBE** ser replicada en `App.tsx` (Modal de Login). Comparten los mismos servicios subyacentes (`hybridFaceService`).
3.  **Móvil Primero (Mobile First)**: Siempre verifica cómo se ven las nuevas características en móvil (ancho 320px-480px).
4.  **Sin "Cadenas Mágicas"**: Usa constantes o enums donde sea posible para Roles y Estados.

---

**Invocación**:
Al trabajar en este proyecto, siempre refiere a esta habilidad para entender:
*   "¿Dónde vive esta lógica?" -> Revisa la sección de Servicios.
*   "¿Cómo debe verse esto?" -> Revisa la sección de UI/Diseño.
*   "¿Cómo funciona el login facial?" -> Revisa la sección del Motor Biométrico.
