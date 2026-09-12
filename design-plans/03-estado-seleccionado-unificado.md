# Plan 3 — Estado "seleccionado" unificado entre componentes hermanos

**Origen**: auditoría improve-ui (commit de referencia `5c41d5a`). Finding #3, seleccionado por el propietario.

## Contexto del ejecutor

Relief (Tauri + React + TS + Tailwind v4). El selector de semana
(`WeekPicker`, en `src/components/CaptureBar.tsx`, exportado y reutilizado
por TaskList para las acciones de fecha) y el conmutador de vistas +
popover de prioridad (TaskList) son variantes hermanas: todos expresan el
mismo estado visual "seleccionado/elegido".

## Problema

El estado "seleccionado" se presenta con dos sistemas distintos:

| Componente | Clase (línea) | Presentación |
|---|---|---|
| Pestaña activa (conmutador) | `bg-neutral-800 text-neutral-50` (TaskList.tsx:~647) | fondo 800, sin borde |
| Pastilla elegida (popover prioridad / chips) | `border-neutral-500 bg-neutral-800 text-neutral-100` (CaptureBar.tsx:132,150,177) | fondo 800 + borde 500 |
| **Día elegido (WeekPicker)** | `bg-neutral-700 text-neutral-50` (CaptureBar.tsx:264) | fondo 700, sin borde |

El día elegido del picker usa un fondo más CLARO (neutral-700) que el resto
del sistema (neutral-800) y sin borde — dos sistemas para el mismo
significado en componentes que se ven a la vez (el picker vive debajo de
los chips).

## Corrección única

El día seleccionado del WeekPicker adopta el patrón de pastilla:
`border-neutral-500 bg-neutral-800 text-neutral-100`.

**Detalle obligatorio para no romper el layout**: los días NO seleccionados
deben recibir `border border-transparent`. Si solo el seleccionado ganara
borde, la caja del día crecería 1px al seleccionarlo y toda la grilla
saltaría. Con borde transparente en reposo, el cambio de estado no mueve
el layout.

## Pasos

1. Abrir `src/components/CaptureBar.tsx`, componente `WeekPicker`, bloque
   de la grilla de días (`grid grid-cols-7`).
2. En el botón de cada día, añadir borde transparente de base en la clase
   del botón (junto a `flex flex-col items-center rounded-lg py-2`):
   agregar `border border-transparent` a la base común.
3. Cambiar la rama de seleccionado (línea ~264):

```
? "bg-neutral-700 text-neutral-50"
```
   → `? "border-neutral-500 bg-neutral-800 text-neutral-100"`

4. La rama "no seleccionado" (`text-neutral-400 hover:bg-neutral-800`)
   queda igual — el borde transparente va en la clase base compartida.

## Verificación

- `npm run build` pasa.
- Prueba manual: abrir "+ fecha" en la barra de captura → click en un día
  → el día resaltado debe verse con el mismo tratamiento que las pastillas
  de prioridad (fondo 800 + borde 500), NO más claro que las pestañas.
- Prueba manual: seleccionar y deseleccionar días consecutivamente — la
  grilla NO debe saltar (sin cambio de tamaño de caja).
- El mismo picker se usa en la fila para cambiar fecha (click en la fecha
  de una tarea) — verificar allí también.

## Fuera de alcance

- Colores de los chips, pestañas o popover (ya usan el patrón 800+borde).
- La pestaña activa del conmutador en TaskList (sin borde deliberado por
  el contenedor segmented — no fue seleccionada).
