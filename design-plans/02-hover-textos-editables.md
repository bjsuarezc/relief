# Plan 2 — Hover unificado en los textos editables de la fila

**Origen**: auditoría improve-ui (commit de referencia `5c41d5a`). Finding #2, seleccionado por el propietario.

## Contexto del ejecutor

Relief (Tauri + React + TS + Tailwind v4). Las filas de tarea viven en
`src/components/TaskList.tsx` (componente `TareaLinea`).

**Decisión que gobierna esta corrección** (bitácora Sesión 2, paso 6,
diseño minimalista acordado con el propietario): "los textos que ya se ven
SON los botones" y "el hover sube ligeramente el color del texto para
insinuar que es clicable — insinuación, no alarma visual".

## Problema

En una misma fila hay tres textos con el mismo semántico (texto editable),
pero cada uno tiene un tratamiento de hover distinto:

| Elemento | Clase de hover (línea) | Efecto |
|---|---|---|
| Título | `hover:text-neutral-300` (TaskList.tsx:151) | se ATENÚE (neutral-100 → neutral-300) |
| Fecha | `hover:text-neutral-200` (TaskList.tsx:163) | se ACLARA (neutral-500 → neutral-200) |
| Prioridad | `hover:brightness-125` (TaskList.tsx:172) | se ACLARA (filtro CSS distinto) |

Tres direcciones y dos mecanismos (clase de color vs filtro) para la misma
insinuación: inconsistencia entre variantes hermanas del mismo estado.

## Corrección única

Unificar los tres al tratamiento ya usado por el título:
`hover:text-neutral-300`. Rationale: es el de la fila principal, es una
clase de color (mismo mecanismo que los otros) y atenúa levemente —
"insinuación, no alarma". Los otros dos adoptan esa misma clase; sus
colores base no cambian.

## Pasos

1. Abrir `src/components/TaskList.tsx`, componente `TareaLinea`.
2. Línea ~163, botón de la fecha:

```
className="shrink-0 text-neutral-500 hover:text-neutral-200"
```
   → cambiar `hover:text-neutral-200` por `hover:text-neutral-300`.

3. Línea ~172, botón de la prioridad:

```
className={`shrink-0 hover:brightness-125 ${COLOR_PRIORIDAD[task.priority]}`}
```
   → cambiar `hover:brightness-125` por `hover:text-neutral-300`
   (conservando `${COLOR_PRIORIDAD[...]}` como color base).

4. No tocar el título (ya usa la clase objetivo).
5. Ajustar la anotación del bloque de hover de la fila si menciona los
   tratamientos viejos.

## Verificación

- `npm run build` pasa.
- Prueba manual: en una fila, pasar el mouse por título, fecha y prioridad:
  los tres deben atenuarse un tono igual (neutral-300) con el mismo
  mecanismo; al salir del hover, cada uno vuelve a su color base
  (neutral-100 / neutral-500 / color de prioridad).

## Fuera de alcance

- Otros hovers del proyecto (botones de icono, chips, pestañas): sus
  tratamientos son de botones, no de "texto editable", y no fueron
  seleccionados en la auditoría.
