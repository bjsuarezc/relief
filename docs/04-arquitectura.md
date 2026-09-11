# Arquitectura — Relief

## Principio rector

Toda decisión de arquitectura debe servir a: (1) el loop de captura-completar
sin fricción, (2) la privacidad local, (3) la futura versión móvil con la
menor reescritura posible.

## Capas

```
┌────────────────────────────────────────────┐
│ UI (React + Tailwind)                      │
│  - Vistas: Hoy / Semana                    │
│  - Componentes: lista, captura, edición    │
├────────────────────────────────────────────┤
│ Estado (Zustand)                           │
│  - Lista de tareas en memoria, filtros     │
│  - Único lugar que llama a los comandos    │
├────────────────────────────────────────────┤
│ Comandos Tauri (invoke) — el "contrato"    │
│  getTasks | createTask | updateTask        │
│  completeTask | deleteTask | moveTask      │
├────────────────────────────────────────────┤
│ Backend nativo (Rust)                      │
│  - SQLite (rusqlite, embebido en los       │
│    comandos)                               │
│  - Lógica de negocio de datos              │
└────────────────────────────────────────────┘
```

**Reglas de las capas:**
- La UI nunca habla directo con la DB: siempre Zustand → invoke → Rust.
  (Un solo camino de datos = bugs localizables.)
- Toda la lógica de datos vive en Rust; el frontend solo renderiza.
  Esto permite que cuando llegue el móvil, la lógica no se reescriba.
- Los comandos escriben en `task_event` como **efecto secundario automático**
  (invisible para la UI): la app registra su propia historia sin que el
  frontend tenga que saberlo.
- Los comandos Tauri son el **contrato** entre capas: si un día cambiamos
  SQLite u otra cosa, la UI ni se entera.

## Modelo de datos (v1)

> Punto de diseño activo — discutido y validado con el propietario del producto.

### Tabla: `task`

| Campo | Tipo | Descripción | RF que lo exige |
|---|---|---|---|
| `id` | TEXT (uuid) | Identificador único | todos |
| `title` | TEXT | Título de la tarea | RF-01 |
| `due_date` | TEXT (nullable) | Fecha límite `YYYY-MM-DD`; null = solo anotación | RF-02, RF-15 |
| `priority` | TEXT (`high`/`medium`/`low`) | Por defecto `medium` | RF-03, RF-05 |
| `completed` | INTEGER (0/1) | ¿Completada? | RF-04 |
| `completed_at` | TEXT (nullable) | Fecha/hora de completado — historial de victorias del día y base de stats v2 | RF-08b, RF-10 |
| `created_at` | TEXT | Fecha/hora de creación (trazabilidad) | RF-10 (futuro) |
| `updated_at` | TEXT | Última modificación (trazabilidad) | — |

**Notas de diseño:**
- `completed_at` es la pieza clave que la mayoría de las to-do apps olvida:
  sin él no hay "historial del día" (RF-08b) ni estadísticas ni resúmenes IA (v2).
  Se captura desde el primer día — *no* se puede retro-agregar después.
- Fechas como texto ISO (`YYYY-MM-DD`): SQLite no tiene tipo fecha nativo;
  el texto ISO ordena lexicográficamente de forma correcta.
- Sin campo de "categoría" ni "tiempo estimado": explícitamente fuera del MVP.
  La IA de v2 inferirá categorías leyendo los títulos; un campo `category`
  hoy sería fricción de captura (contra el principio 1 de 01-vision.md).

### Tabla: `task_event` (log de eventos, append-only)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | TEXT (uuid) | Identificador único del evento |
| `task_id` | TEXT (fk → task.id) | Tarea involucrada |
| `event_type` | TEXT | `created` / `completed` / `uncompleted` / `moved` / `priority_changed` / `edited` / `deleted` |
| `payload` | TEXT (JSON, nullable) | Detalles del evento (ej. `{"from":"2026-09-10","to":"2026-09-12"}` en un `moved`) |
| `happened_at` | TEXT | Fecha/hora del evento |

**Para qué existe:** cada acción del usuario escribe una fila aquí además de
actualizar `task`. Es la *línea de tiempo conductual* que la IA de v2
necesita para detectar patrones (procrastinación = reprogramaciones repetidas,
sobrecarga = volumen de creaciones vs completados por día). Es imposible de
reconstruir después: el día que la necesites, los eventos pasados ya no
existen si no se guardaron desde el día uno.

**Regla general:** lo que se puede agregar tarde son columnas nullable
(migración trivial); lo que no se puede agregar tarde son los datos que solo
se generan en el momento de la acción. Esos se capturan desde el día uno.

## Decisiones técnicas (log)

| # | Decisión | Alternativas descartadas | Razón |
|---|---|---|---|
| D-01 | Tauri 2 | Electron | Binario ~10MB vs ~150MB; soporte móvil nativo (RF-14); Rust moderno |
| D-02 | SQLite vía rusqlite (en Rust) | Postgres, archivos JSON, tauri-plugin-sql | App sin servidor y offline por diseño (RNF-03); rusqlite mantiene SQL dentro de la capa Rust (la UI nunca habla directo con la DB); tauri-plugin-sql expone SQL a JavaScript y rompería ese aislamiento |
| D-03 | Zustand | Redux, Context | Estado simple de una sola entidad; 10% del código de Redux |
| D-04 | React + TS + Tailwind | Vue/Svelte | React domina las ofertas de trabajo (objetivo del proyecto); TS reduce bugs; Tailwind da UI consistente rápida |
| D-05 | IA desde Rust (v2) | IA desde frontend | La API key nunca vive en el frontend (RNF-01); decisión a validar en v2 |

## Decisiones diferidas (al momento de construir la UI)

- [ ] Layout visual: ¿una sola columna? ¿sidebar de vistas?
  (minimalista + responsive + touch-ready) — se decide con wireframes
  cuando empecemos la UI.
- [ ] Comportamiento exacto de la vista Semana (7 columnas vs lista por día).
