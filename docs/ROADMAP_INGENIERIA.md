# 🚀 Hoja de Ruta de Ingeniería: Próxima Generación

Este documento contiene ideas avanzadas basadas en matemática pura y física para llevar el sistema de reconocimiento facial de ADCC al siguiente nivel de fluidez y estabilidad.

---

## 1. Detección de Vida (Liveness Detection) mediante EAR
El mayor riesgo de un sistema de reconocimiento es que un usuario presente una fotografía o un video en un iPad frente a la cámara.
*   **Fundamento:** El parpadeo humano es un proceso fisiológico con una frecuencia de 15-20 veces por minuto.
*   **Matemática:** Calculamos el **Eye Aspect Ratio (EAR)**:
    $$EAR = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2\|p_1 - p_4\|}$$
    Donde $p_1, \dots, p_6$ son landmarks del ojo. 
    *   **Implementación:** Si el EAR cae por debajo de un umbral (ojo cerrado) y luego sube (ojo abierto) en menos de 300ms, confirmamos que es un humano vivo.

## 2. Optimización Óptica: Balance de Blancos Adaptativo
Las cámaras móviles suelen sobrexponer los rostros bajo luz solar directa, "lavando" los rasgos.
*   **Propuesta:** Implementar un shader simple en WebGL o un filtro en el Canvas de pre-procesamiento que realice un **Histogram Equalization** solo dentro del Bounding Box del rostro.
*   **Efecto:** Aumenta el contraste de las sombras (ojos, pómulos) mejorando la precisión del descriptor en un 15-20%.

## 3. Lógica de "Gating" Probabilístico
En lugar de aceptar un "Match" al primer cuadro positivo, implementamos una ventana de tiempo de **Votos de Confianza**.
*   **Algoritmo:**
    1.  Mantenemos una cola de los últimos 5 descriptores detectados.
    2.  Calculamos la **Similitud Promedio** entre ellos.
    3.  Solo si la varianza es baja (el rostro es el mismo) y la similitud con el usuario en la DB es $> 0.85$, damos el acceso.
*   **Resultado:** Eliminamos los falsos positivos instantáneos por ruido visual.

## 4. Ingeniería de Red: Cuantización de Embeddings
Actualmente guardamos 128 floats (512 bytes por usuario).
*   **Optimización:** Usar **Cuantización de Punto Fijo** de 8 bits.
*   **Beneficio:** Reducimos el peso de la base de datos a la cuarta parte y permitimos que la comparación vectorial se haga mediante instrucciones **SIMD** (Single Instruction, Multiple Data) en el procesador, lo que es órdenes de magnitud más rápido en móviles.

## 5. Detección de "Head Pose" (3D)
Usando los landmarks de MediaPipe, podemos construir una matriz de rotación para saber si el usuario está mirando hacia arriba, abajo o a los lados.
*   **Filtro Ingenieril:** El sistema debería rechazar cualquier intento de reconocimiento si el ángulo de guiñada (yaw) es superior a 30 grados, ya que la distorsión de la perspectiva de la nariz y orejas hace que el modelo falle.

---

*Estas ideas están diseñadas para ser implementadas de forma incremental, manteniendo la fluidez actual del sistema.*
