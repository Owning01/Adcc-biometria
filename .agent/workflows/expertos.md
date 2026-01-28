---
description: Cambiar el rol del Agente IA a un experto específico (Visual, Lógica, Backend, Sistemas)
---

Este workflow ayuda a reconfigurar el chat actual para trabajar en un área específica, consultando el estado en `descriptivo.md`.

### Pasos:

1. **Seleccionar Especialidad**: Indica qué experto necesitas (ej. "Activa experto Visual").
2. **Sincronización**: El agente leerá `descriptivo.md` para entender qué se ha hecho y qué falta en esa área.
3. **Foco**: El agente se compromete a no tocar otras áreas a menos que se le pida.
4. **Registro**: Al finalizar, el agente actualizará `descriptivo.md` con los avances.

// turbo
### ⚙️ Comando de Inicialización:
```powershell
# Este comando simplemente verifica la existencia de los archivos clave
Test-Path .antigravityrules; Test-Path descriptivo.md
```

### 🤖 Roles Disponibles:
- **Visual**: CSS, UI/UX, Animaciones, Dashboard.
- **Lógica**: JavaScript, Algoritmos, Integración.
- **Backend**: Firebase, Database, Auth.
- **Sistemas**: Capacitor, Android, Deployment.
- **Ciberseguridad**: Protección de datos biométricos, Reglas de Seguridad (Rules), Encriptación.
