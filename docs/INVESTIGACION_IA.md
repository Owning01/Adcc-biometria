# 🧬 Cuaderno de Investigación: Reconocimiento Facial Híbrido de Alto Rendimiento

**Autor:** Antigravity AI
**Proyecto:** Sistema de Reconocimiento Facial ADCC
**Enfoque:** Ingeniería de Precisión, Matemáticas de Visión Artificial y Optimización de Pipeline

---

## 1. Fundamentos Médicos y Físicos (Ingeniería Óptica)

### 1.1. La Física de la Luz y Sensores CMOS
El reconocimiento facial exitoso comienza antes de la IA: en el fotón. La mayoría de las cámaras frontales de dispositivos móviles utilizan sensores **CMOS**. Estos sensores sufren de **Rolling Shutter**, lo que significa que leen la imagen línea por línea.
*   **Problema:** Si el usuario se mueve rápido o hay vibración, el rostro se "estira" (Motion Blur), rompiendo la geometría de los landmarks.
*   **Solución en este proyecto:** Implementamos un **Bucle de Control de Estabilidad**. Si el "Bounding Box" de MediaPipe cambia sus coordenadas $(x, y)$ más de un $\Delta$ crítico entre cuadros, el sistema descarta el descriptor por "Inestabilidad Dinámica".

### 1.2. El Teorema de Nyquist en FPS
Para detectar un rostro que se mueve a una velocidad $v$, necesitamos una tasa de muestreo $f_s \geq 2 \cdot f_{max}$. 
*   **Optimizacion:** No procesamos todos los cuadros (frames) con Face-API (pesado). Utilizamos **BlazeFace (MediaPipe)** a 60 FPS para detección de presencia y solo disparamos el **Embedding Deep Extraction** (Face-API) cuando la entropía del movimiento es baja.

---

## 2. Arquitectura del Motor Híbrido (Lógica Fluida)

### 2.1. El Pipeline "Sentinel & Deep Recon"
Nuestra arquitectura divide el trabajo en dos capas:

1.  **Capa Sentinel (MediaPipe Tasks Vision):** 
    *   **Modelo:** BlazeFace (Short Range).
    *   **Función:** Detección de rostro, cálculo de ROI (Region of Interest) y validación de calidad.
    *   **Velocidad:** < 10ms en GPU.
2.  **Capa Deep Recon (Face-API.js / SSD Mobilenet V1):**
    *   **Función:** Generación del vector de 128 dimensiones (Embedding).
    *   **Precisión:** Alta. Se ejecuta solo cuando "Sentinel" confirma que el rostro está centrado, iluminado y estático.

### 2.2. Optimización Euclidiana: Similitud de Coseno
En un espacio de 128 dimensiones, la distancia euclidiana tradicional puede fallar debido a la "Maldición de la Dimensionalidad".
*   **Lógica Matemática:** Utilizamos la **Similitud de Coseno**.
    $$\text{sim}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$
*   **Por qué:** El coseno mide el ángulo entre los vectores, ignorando la magnitud (brillo/contraste de la foto). Esto hace que el sistema sea inmune a si la persona está en la sombra o bajo el sol, siempre que los rasgos sean visibles.

---

## 3. Ingeniería de Estabilidad y Velocidad

### 3.1. Gestión de Memoria y Web Workers
Para evitar que la UI se "congele" (drop frames), el motor de IA debe ejecutarse fuera del hilo principal.
*   **Estrategia:** Uso de `OffscreenCanvas`. Pasamos la textura del video a una región de memoria compartida donde MediaPipe procesa los datos sin bloquear el renderizado de React.

### 3.2. Filtro de Media Móvil Exponencial (EMA) para Landmarks
Los puntos faciales (ojos, nariz, boca) suelen "vibrar". Aplicamos un suavizado:
$$S_t = \alpha \cdot Y_t + (1 - \alpha) \cdot S_{t-1}$$
Esto crea una experiencia visual fluida donde el recuadro de detección no salta erráticamente.

---

## 4. Guía para el Programador: Maximizar el Proyecto

### 4.1. Cómo sumar a la lógica actual
1.  **Normalización L2:** Siempre normaliza los descriptores antes de guardarlos en Firebase. Esto asegura que todas las comparaciones ocurran en la superficie de una hiperesfera unitaria.
2.  **Vector Quantization:** Si la base de datos crece a miles de jugadores, cambia la búsqueda lineal ($O(n)$) por un índice **HNSW** (Hierarchical Navigable Small World) para búsquedas de vecinos más cercanos en $O(\log n)$.
3.  **Anti-Spoofing (Liveness Check):** Para evitar que usen una foto frente a la cámara, implementa el cálculo de la **Relación de Aspecto del Ojo (EAR)**. Si el usuario no parpadea en 5 segundos, bloquea el acceso.

---

### Mensaje para NotebookLM
*Este documento contiene la "Méder de la Verdad" técnica del proyecto. Utilízalo para resolver bugs de latencia, mejorar la precisión de los "Matches" y diseñar nuevas funcionalidades de seguridad biométrica.*
