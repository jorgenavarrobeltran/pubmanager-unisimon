---
name: rename-app
description: >
  Skill para renombrar la aplicación basándose en una URL de repositorio Git.
  Úsalo cuando el usuario pida: renombrar la app, cambiar el nombre del proyecto,
  configurar para un nuevo repositorio, o expresiones como "renómbrame la app a [URL]".
  Este skill extrae automáticamente el nombre desde la URL, actualiza el remote origin
  y modifica los archivos de configuración (package.json, vite.config.ts, Jenkinsfile, etc.).
---

# Skill: Renombrado de Aplicación — uni-base-app

Automatiza el proceso de renombrar el proyecto para su despliegue en un nuevo repositorio.

---

## Proceso de Renombrado

Antes de ejecutar los cambios:

1.  **Solicitar la URL del repositorio** si no se ha proporcionado (ej. `https://github.com/CucutaUnisimon/uni-proveedor-app.git`).
2.  **Calcular los nombres** siguiendo la lógica en `references/templates.md`:
    -   `GIT_URL`: La URL completa proporcionada.
    -   `App Name`: Nombre extraído (ej. `proveedor-app`).
    -   `Display Name`: Nombre para visualización (ej. `Proveedor App`).
3.  **Confirmar con el usuario** los nombres calculados antes de proceder.

---

## Acciones a Ejecutar

Una vez confirmado, el agente debe:

1.  **Hard Reset de Git (Recomendado)**:
    - `Remove-Item -Recurse -Force .git` (en Windows) o `rm -rf .git` (en Linux).
    - `git init`
    - `git remote add origin {GIT_URL}`
    - `git checkout master`
    - `git add .`
    - `git commit -m "Initial commit source: uni-base-app"`
2.  **Modificar Archivos de Configuración**:
    -   `package.json` → Actualizar `"name"`.
    -   `vite.config.ts` → Actualizar `base` path.
    -   `Jenkinsfile` → Actualizar `DEPLOY_PATH`.
    -   `index.html` → Actualizar `<title>`.
3.  **Verificar y Limpiar**:
    -   Validar que `npm install` (o `npm ci`) siga funcionando.
    -   Verificar que `npm run build` genere el `dist` correcto con la nueva base.

---

## Referencias

| Archivo | Contenido |
|---------|-----------|
| `references/templates.md` | Lógica de extracción y fragmentos de código para reemplazo |