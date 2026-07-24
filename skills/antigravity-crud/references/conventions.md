# Convenciones del Proyecto antigravity

## Reglas críticas de la API

| Regla | Detalle |
|---|---|
| `uuid` en operaciones de API | PUT / DELETE / GET individual siempre usan `uuid`, **nunca** `id` |
| `id` solo en DataGrid | El campo `id` se usa únicamente como `rowId` en MUI DataGrid |
| `response.mensaje` (con j) | El mensaje de la API viene en `response.mensaje`, no `message` |
| Ruta API en singular/minúsculas | `/{entidad}` — ej. `/sede`, `/producto` |

## Reglas de estado y filtrado

| Regla | Detalle |
|---|---|
| Filtrado client-side | El `searchTerm` filtra con `useMemo` sobre la lista ya cargada — **sin llamadas al servicio** |
| Datos frescos al editar/detallar | Usar `queryClient.fetchQuery` con la `detail key` al abrir un modal de edición o detalle |
| Estado global mínimo | Solo `searchTerm` se comparte vía Context; todo lo demás es local al Board hook |
| `staleTime` del listado | 5 minutos (`1000 * 60 * 5`) |

## Reglas de validación y feedback

| Regla | Detalle |
|---|---|
| Validar antes de mutar | `handleSubmit` llama al validator **antes** de disparar la mutación |
| Alertas con `Alert.*` | Usar `Alert.success`, `Alert.error`, `Alert.confirm` de `../../utils/alerts` |
| Mensaje de confirm | Siempre incluir los 3 parámetros: título, descripción, texto del botón |

## Convenciones de nomenclatura

```
Interface:     {Entidad}            → Sede
Service:       {entidad}Service     → sedeService
Context hook:  use{Entidad}       → useSede
Board hook:    use{Entidad}Board  → useSedeBoard
Query keys:    {entidad}Keys        → sedeKeys
```

## Componentes UI disponibles

Analiza todos los archivos dentro de ../../src/components/ui y utiliza esos componentes como sistema de diseño base.
No implementes ningun componente equivalente.
Prioriza la reutilización de los componentes disponibles para mantener consistencia en la UI.

Si la entidad necesita algo especial, documentarlo aparte.