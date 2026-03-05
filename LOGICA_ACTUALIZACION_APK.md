# Explicativo: Logística de Instalación y Actualización de APK (ADCC Biometric)

Este documento detalla la arquitectura y el flujo de trabajo utilizado en el proyecto **ADCC Biometric** para automatizar la generación de versiones, la subida a GitHub Releases y la detección de actualizaciones dentro de la aplicación móvil (Capacitor).

## 1. Arquitectura General

El sistema se basa en tres pilares:
1.  **Script Orquestador (PowerShell):** Automatiza el incremento de versión, compilación y despliegue.
2.  **GitHub Releases:** Repositorio central de los binarios (.apk).
3.  **Detección In-App:** Lógica en React que compara la versión local contra un metadato remoto.

---

## 2. El Script "God Mode" (`god-mode.ps1`)

Este es el motor de la automatización. Sus pasos cronológicos son:

1.  **Bump Version:** Incrementa el parche en `package.json` (`npm version patch`).
2.  **Predicción de URL:** Calcula la URL que tendrá el archivo en GitHub antes de que exista:
    `https://github.com/USUARIO/REPO/releases/download/vX.Y.Z/app-vX.Y.Z.apk`
3.  **Sincronización de Metadatos:**
    *   Escribe la nueva versión y URL en `src/release.json`.
    *   Actualiza `android/app/build.gradle` (modifica `versionCode` y `versionName` automáticamente para que Android reconozca la actualización).
4.  **Compilación Web:** Ejecuta `npm run build` para incluir los nuevos JSON en el bundle.
5.  **Compilación Nativa:**
    *   `npx cap sync`: Sincroniza los activos web con la carpeta de Android.
    *   `./gradlew assembleDebug`: Genera el archivo `.apk` físicamente.
6.  **Publicación en GitHub:**
    *   Hace un `git commit` con los cambios de versión.
    *   Usa el **GitHub CLI (`gh`)** para crear un Release oficial y subir el APK:
        ```powershell
        gh release create "v$VERSION" $PATH_APK --title "v$VERSION" --notes "Actualización"
        ```

---

## 3. Lógica en el Frontend (`App.tsx`)

Dentro de la aplicación React, la lógica de chequeo ocurre en el arranque:

### A. Definición de Versión Local
En `vite.config.ts` se define una constante global:
```typescript
define: {
  __APP_VERSION__: JSON.stringify(pkg.version), 
}
```

### B. El hook de chequeo y función de comparación

```typescript
const VERSION = __APP_VERSION__;

// Utilidad para comparar versiones semánticas (X.Y.Z)
const compareVersions = (v1: string | undefined, v2: string | undefined): number => {
  if (!v1 || !v2) return 0;
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
  }
  return 0;
};

useEffect(() => {
  const checkUpdate = async () => {
    try {
      // 1. Buscamos el JSON de versión en el servidor (Firebase Hosting)
      const res = await fetch('https://tu-app.web.app/version.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        const latest = data.android.version;
        
        // 2. Comparamos (v1 < v2)
        if (compareVersions(VERSION, latest) < 0) {
          setUpdateUrl(data.android.url);
          setUpdateRequired(true); // Disparamos la UI de aviso
        }
      }
    } catch (e) {
      console.warn("Error chequeando update", e);
    }
  };
  checkUpdate();
}, []);
```

### C. Acción de Instalación
En Android, no es trivial "autoinstalar" sin permisos de sistema, por lo que la mejor práctica es dirigir al usuario al binario:
```typescript
window.open(updateUrl, '_system'); // Abre el navegador del sistema para descargar el APK
```
Una vez descargado, el usuario simplemente toca la notificación de descarga y Android inicia el proceso de actualización sobreescribiendo la app actual.

---

## 4. Requisitos para Reutilizar

Para replicar esto en otra IA o proyecto, necesitas:

1.  **GitHub CLI instalado:** Configurado con `gh auth login`.
2.  **Estructura de Carpetas:** Tener el script `.ps1` en la raíz.
3.  **Configuración de Android:** Asegurarte de que el `build.gradle` use variables o patrones que el script pueda encontrar y reemplazar (`versionCode` y `versionName`).
4.  **Hosting del JSON:** Un lugar (como Firebase Hosting) donde resida el archivo `version.json` que la app consultará.

## 5. Archivos Clave a Copiar

1.  `god-mode.ps1`: El script de despliegue.
2.  `src/release.json`: El "espejo" local de la versión.
3.  `public/version.json`: El archivo que debe estar en el servidor web.
4.  Lógica de `compareVersions` y `checkUpdate` en `App.tsx`.

---
*Documentación generada por Antigravity para Octavio - 2026*
