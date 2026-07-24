# Templates y Lógica de Renombrado

Este archivo contiene la lógica específica para renombrar el proyecto `uni-base-app` a un nuevo nombre basado en la URL de un repositorio Git.

## 1. Extracción del Nombre

Dada una URL de Git (ej. `https://github.com/CucutaUnisimon/uni-proveedor-app.git`):

1.  **Repo Name**: Extraer la parte final de la URL antes del `.git` (ej. `uni-proveedor-app`).
2.  **App Name**: Eliminar el prefijo `uni-` si existe (ej. `proveedor-app`).
3.  **Display Name**: Convertir el **App Name** a capitalizado (ej. `Proveedor App`).

## 2. Reemplazos por Archivo

Cuando se ejecute el renombrado, se deben aplicar los siguientes cambios utilizando el **App Name** extraído:

### package.json
```json
// Buscar:
"name": "unisimon-app",
// Reemplazar por:
"name": "{app-name}",
```

### vite.config.ts
```typescript
// Buscar (en la línea de 'base'):
base: command === 'build' ? '/usuario/' : '/',
// Reemplazar por:
base: command === 'build' ? '/{app-name}/' : '/',
```

### Jenkinsfile
```groovy
// Buscar:
DEPLOY_PATH = '/var/www/base-app'
// Reemplazar por:
DEPLOY_PATH = '/var/www/{app-name}'
```

### index.html (Opcional)
```html
<!-- Buscar: -->
<title>Portal Académico USB</title>
<!-- Reemplazar por: -->
<title>{Display Name} - Universidad Simón Bolívar</title>
```

### 3. Reinicio de Repositorio Git

Ejecuta los siguientes comandos en la raíz del proyecto:

```powershell
# Eliminar el histórico actual
Remove-Item -Recurse -Force .git

# Iniciar nuevo repositorio
git init

# Vincular al nuevo remoto
git remote add origin {URL_NUEVO_REPO}

# Primer commit
git add .
git commit -m "Initial commit: Proyecto refactorizado desde proveedor-app"
```