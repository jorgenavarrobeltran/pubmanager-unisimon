# Estructura de Archivos — antigravity (uni-base-app)

## Árbol completo para una entidad nueva

Ejemplo con `Sede` / `sedes`:

```
src/
├── types/
│   ├── index.ts                              ← Agregar: export * from './sede'
│   └── sede.ts                          ← NUEVO
│
├── services/
│   └── sedeService.ts                   ← NUEVO
│
├── context/
│   └── sedeContext.tsx                  ← NUEVO
│
├── utils/
│   └── validators.ts                         ← MODIFICAR: agregar proveedorValidator
│
├── hooks/
│   └── sedes/                          ← NUEVA CARPETA
│       ├── useSedeQueries.ts            ← NUEVO
│       └── useSedesBoard.ts            ← NUEVO
│
├── pages/
│   └── sedes/                          ← NUEVA CARPETA
│       ├── Sedes.tsx                   ← NUEVO
│       └── components/
│           ├── SedeList.tsx             ← NUEVO
│           ├── SedeForm.tsx             ← NUEVO
│           └── SedeDetail.tsx           ← NUEVO
│
└── router/
    └── AppRouter.tsx                         ← MODIFICAR: agregar ruta + Provider
```

## Archivos existentes que se modifican

Solo 2 archivos existentes se tocan:

1. **`src/types/index.ts`** — agregar una línea de export
2. **`src/utils/validators.ts`** — agregar el nuevo validator
3. **`src/router/AppRouter.tsx`** — agregar import, Provider y Route

Todo lo demás son archivos **completamente nuevos**.

## Verificación post-generación

Después de generar todos los archivos, confirmar con el usuario:

```
✅ src/types/sede.ts
✅ src/types/index.ts (modificado)
✅ src/services/sedeService.ts
✅ src/context/sedeContext.tsx
✅ src/utils/validators.ts (modificado)
✅ src/hooks/sedes/useSedeQueries.ts
✅ src/hooks/sedes/useSedesBoard.ts
✅ src/pages/sedes/Sedes.tsx
✅ src/pages/sedes/components/SedeList.tsx
✅ src/pages/sedes/components/SedeForm.tsx
✅ src/pages/sedes/components/SedeDetail.tsx
✅ src/router/AppRouter.tsx (modificado)
```