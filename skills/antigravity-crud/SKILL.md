---
name: antigravity-crud
description: >
  Skill para generar módulos CRUD completos en el proyecto antigravity (uni-base-app).
  Úsalo SIEMPRE que el usuario pida: crear un módulo, generar un CRUD, agregar una entidad,
  crear una página nueva, generar el servicio de X, crear el contexto de X, agregar X al router,
  hacer el hook de X, o cualquier variación de "quiero el módulo de [entidad]". También actívalo
  cuando mencionen: DataTable, FormModal, react-query, TanStack Query, useBoard, Board hook,
  httpClient, validators, uni-base-app, antigravity, o cuando pidan replicar el patrón de Usuarios.
  Este skill genera TODOS los archivos necesarios en el orden correcto — nunca generes un módulo
  CRUD de antigravity sin consultarlo primero.
---

# Skill: CRUD Completo — Proyecto antigravity (uni-base-app)

Genera un módulo CRUD completo replicando el patrón del módulo de **Usuarios**.
Cada entidad nueva sigue exactamente esta arquitectura.

---

## Proceso de Generación

Antes de generar cualquier archivo:

1. **Preguntar el nombre de la entidad** si no está claro (ej. `Proveedor`, `Producto`, `Categoria`)
2. **Identificar los campos** de la entidad (además de `id`, `uuid`, `esActivo` que son obligatorios)
3. **Confirmar la ruta API** (por defecto `/{entidades}` en plural y minúsculas)
4. **Leer referencias** según lo que se necesite:
   - Estructura completa de archivos → `references/file-structure.md`
   - Convenciones y reglas del proyecto → `references/conventions.md`
   - Plantillas de cada archivo → `references/templates.md`

---

## Archivos a Generar (en este orden)

```
src/
├── types/{entidad}.ts                          ← 1. Interface + ContextType
├── services/{entidad}Service.ts                ← 2. CRUD con httpClient
├── context/{Entidad}Context.tsx                ← 3. Provider + hook de contexto
├── utils/validators.ts                         ← 4. Agregar {entidad}Validator
├── hooks/{entidades}/
│   ├── use{Entidad}Queries.ts                  ← 5. Keys + hooks de react-query
│   └── use{Entidades}Board.ts                  ← 6. Hook de orquestación
├── pages/{entidades}/
│   ├── {Entidades}.tsx                         ← 7. Página principal (presentacional)
│   └── components/
│       ├── {Entidad}List.tsx                   ← 8. DataTable con columnas y acciones
│       ├── {Entidad}Form.tsx                   ← 9. FormModal crear/editar
│       └── {Entidad}Detail.tsx                 ← 10. FormModal detalle (solo lectura)
└── router/AppRouter.tsx                        ← 11. Agregar ruta + Provider
```

> **Nota:** Siempre generar en este orden para respetar dependencias de importación.

---

## Checklist de Generación

Antes de entregar los archivos, verificar:

- [ ] `id: number` y `uuid: string` presentes en la interface
- [ ] Export agregado en `src/types/index.ts`
- [ ] Filtrado usa `uuid` para PUT/DELETE/GET individual (nunca `id`)
- [ ] `id` solo se usa como `rowId` en el DataGrid
- [ ] `response.mensaje` (con j) en todos los servicios
- [ ] `useMemo` para filtrado client-side en el Board hook
- [ ] `queryClient.fetchQuery` en `handleOpenEdit` y `handleOpenDetail`
- [ ] `{entidad}Validator.validate()` llamado en `handleSubmit` antes de mutar
- [ ] `Alert.success`, `Alert.error`, `Alert.confirm` de `../../utils/alerts`
- [ ] Ruta agregada en AppRouter con Provider envolviendo la página

---

## Personalización por Entidad

Al adaptar las plantillas, reemplazar siempre:

| Placeholder | Ejemplo real |
|---|---|
| `{Entidad}` | `Proveedor` |
| `{entidad}` | `proveedor` |
| `{Entidades}` | `Proveedores` |
| `{entidades}` | `proveedores` |
| `{IconName}` | `Building2` (ícono de lucide-react) |

Agregar campos propios de la entidad en:
- Interface en `types/{entidad}.ts`
- Filtro en `services/{entidad}Service.ts` (método `get{Entidades}`)
- Filtro en `use{Entidades}Board.ts` (useMemo)
- Columnas en `{Entidad}List.tsx`
- FormFields en `{Entidad}Form.tsx`
- InfoItems en `{Entidad}Detail.tsx`
- Validaciones en `validators.ts`

---

## Referencias

| Archivo | Cuándo leerlo |
|---------|---------------|
| `references/templates.md` | Para obtener el código completo de cada archivo — **leer siempre al generar** |
| `references/conventions.md` | Para dudas sobre convenciones, reglas o patrones del proyecto |
| `references/file-structure.md` | Para verificar la estructura de carpetas esperada |