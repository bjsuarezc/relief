# Bitácora del proyecto — TaskLens

Registro cronológico del trabajo y las decisiones conversadas con los
asistentes de IA. **Cualquier sesión nueva debe leer esto** para conocer el
estado y la historia antes de continuar.

## Sesión 1 — 2026-09-10

### Origen del proyecto

- Objetivo del propietario: mejorar empleabilidad construyendo proyectos de
  portfolio. Dos ideas iniciales: (1) to-do con IA, (2) app SOS para trekking.
- Decisión: empezar por la to-do + IA. Nombre del proyecto: **TaskLens**.
- Stack elegido con criterio "tecnologías que interesan a las empresas hoy":
  Tauri 2 + Rust (núcleo), React + TypeScript + Vite + Tailwind v4 (UI),
  Zustand (estado), date-fns, lucide-react, SQLite vía rusqlite.

### Entorno instalado (máquina Windows)

- Rust 1.98 + rustup/cargo (via winget)
- VS Build Tools 2022 con C++ + Windows SDK (requisito de enlazado Rust/MSVC)
- Git 2.55, VS Code 1.137, opencode CLI 1.18
- Política de ejecución PowerShell: RemoteSigned para CurrentUser

### Decisiones de producto (resumen — detalle en docs/)

- Propuesta de valor: devolver el loop emocional "capturar → tachar → alivio".
- MVP: capturar tareas + fecha + prioridad (alta/media/baja) + tachar.
  La prioridad se decidió por el usuario: reduce la ansiedad de la lista gigante.
- Tareas vencidas: sección "Atrasadas" sin estética de alarma, con "Mover a hoy"
  y "Más opciones" (redistribuir por la semana) — decisión del usuario.
- Tareas completadas NO se eliminan (historial de victorias, base de stats v2).
- Plataformas: v1 escritorio, v2+ móvil (Tauri 2 lo soporta; UI responsive
  desde v1). Teclado en MVP solo como acelerador de captura (Ctrl+N/Enter/Ctrl+D);
  toda acción también por click/touch.
- Modo de colaboración IA-owner: la IA escribe código, el propietario revisa,
  pregunta y vetoa; decisiones de diseño siempre del propietario; contratos
  previos antes de implementar; todo commiteado debe poder explicarse.
  Documentado en `AGENTS.md` (lo leen todos los agentes).

### Trabajo técnico realizado

- Scaffold Tauri (plantilla react-ts) + Tailwind v4 + deps UI.
- Primer commit `123a522`: scaffold + docs + AGENTS.md.
- Esquema SQLite: tablas `task` (8 campos, con `completed_at` desde el día uno)
  y `task_event` (log append-only para la IA v2 — captura la historia
  conductual). Justificación: "columnas nullable se agregan tarde; los
  eventos se capturan desde el día uno".
- Comando `get_tasks` (opción A: sin filtros, el frontend filtra — no
  optimizar antes de tiempo; migrar a filtros en Rust es barato si escala).
- Estructura frontend: `src/lib/{types,api,store}.ts`, App.tsx conectado al
  store. BD en `app_data/tasklens.db`.
- Commit `853ce9d`: feat esquema + get_tasks. Builds verificados (cargo + tsc/vite).

### Estado / siguiente paso

- ✅ get_tasks implementado y funcionando (BD conectada, lista vacía).
- ⏭️ Siguiente: comando `create_task` — **definir contrato previo con el
  propietario** (firma + comportamiento) antes de codificar. Recordar que
  create debe escribir el evento `created` en task_event como efecto
  secundario automático.
- Pendiente posiblemente: repo en GitHub (diferido por decisión del propietario),
  wireframes de UI (diferidos — decisión de diseño visual, no estructural).

### Aprendizajes registrados

- tauri-plugin-sql fue descartado: expone SQL a JavaScript y rompe la regla
  "la UI nunca habla directo con la DB" → rusqlite dentro de comandos Rust.
- El "contrato" UI↔Rust (comandos Tauri) permite cambiar la capa de datos sin
  tocar la UI.

## Sesión 2 — 2026-09-10

### Contrato de `create_task` (definido con el propietario antes de codificar)

- Firma: `create_task(input) -> Task` con `input = { title, dueDate?, priority? }`.
- Decisiones del propietario:
  - Retornar la **Task completa** (evita re-consultar la lista tras crear).
  - Dependencias **uuid** (id v4) y **chrono** (timestamps ISO 8601 + validación
    de fecha) aprobadas. Ya estaban declaradas en Cargo.toml.
  - Título: trim + **rechazar si queda vacío** + tope de 200 caracteres.
  - Fechas: **doble capa** decidida por el propietario — la UI usará selector
    de fecha (el usuario nunca escribe una fecha, la opción inválida no existe)
    y Rust valida igual como cinturón de seguridad (fecha imposible ⇒ error).
- Prioridad inválida o vacía por defecto: default `medium`, valores fuera de
  high/medium/low ⇒ error.

### Implementación

- `create_task` en `src-tauri/src/tasks.rs`: validaciones, id v4, timestamps
  RFC 3339 del lado de Rust, INSERT en `task` + INSERT del evento `created`
  en `task_event` (payload = input serializado como JSON).
- Registrado en `generate_handler` en `lib.rs`.
- Frontend: `CreateTaskInput` en `types.ts` y `api.createTask` en `api.ts`.
- El store todavía no lo usa: falta la UI de captura.
- Error aprendido: al serializar el input para el payload faltaba derivar
  `Serialize` (solo tenía `Deserialize`); serde exige ambos para cada dirección.

### UI de captura — paso 1 (barra de captura rápida)

- Decisiones de producto del propietario (captura):
  - **Sin fecha elegida = hoy**: el frontend manda la fecha de hoy en
    `dueDate` (no null) — la BD siempre guarda la verdad, el evento
    `created` captura la fecha real y "Atrasadas" no necesita lógica especial.
  - **Selector persistente para captura en lote**: al abrirse "+ fecha",
    el picker queda abierto para registrar varias tareas en distintos días
    sin reabrir. Arranca en vista de semana, expandible a mes completo.
- Implementado y probado por el propietario:
  - Acción `createTask` en el store (Zustand): agrega la Task al final
    (mismo orden que get_tasks), errores en `error` sin lanzar excepción.
  - Componente `CaptureBar` (`src/components/`): input grande + Enter/[+],
    dueDate = hoy vía date-fns, foco se conserva tras cada captura
    (captura en lote), texto no se pierde si falla, mensaje de error
    bajo el input. Validación de título vacío duplicada barra+Rust (a propósito).
  - App.tsx: barra montada + lista provisional en texto plano para
    verificar el loop. La lista real (check, prioridad, atrasadas) viene después.
- Commits: `e9b7b78` (create_task + anotaciones), `fd33773` (barra de captura).
- Nota pedagógica: `useRef` para manejar el foco sin re-render;
  `<form onSubmit>` para Enter nativo.

### UI de captura — paso 2 (chips: fecha semanal + prioridad)

- Contrato acordado con el propietario (4 decisiones, todas opción A):
  1. Picker de semana **hecho a mano** con date-fns (no calendario nativo):
     control de estilo y base para la expansión a mes.
  2. **Selección de prioridad persistente** en captura en lote (como la fecha).
  3. **Badge** junto al chip confirmando el destino (`+ fecha · vie 12 sep`) —
     el propietario condicionó este punto: tiene sentido solo si existe un
     conmutador de vista para VER las tareas del día capturado (⇒ paso 3).
  4. **Permitir fechas pasadas** (es legítimo anotar algo ya vencido).
- Implementado (solo CaptureBar.tsx + App.tsx; Rust y store sin cambios):
  - Estado de captura: `captureDate` (destino activo), `priority` (null =
    no se manda, Rust aplica medium), dos flags de panel abierto/cerrado.
  - Al cerrar un chip su selección se resetea (fecha→hoy, prioridad→media).
  - `WeekPicker`: 7 botones desde `startOfWeek(selected, {weekStartsOn:1})`
    (lunes, convención española), flechas ±7 días, hoy con puntito.
  - El pedido a Rust se arma como `CreateTaskInput` y agrega `priority`
    solo si hay selección.
- Extra solicitado por el propietario ("la lista se ve fea"): formato
  legible en la lista provisional — fecha humana (`hoy` / `vie 12 sep`,
  locale es de date-fns) y prioridad en español con color por "calor"
  (alta roja, media ámbar, baja verde). Caso borde dueDate null → "sin fecha".
- Error aprendido: definir un tipo que excluía "medium" chocó con la lista
  de 3 pastillas — la ausencia de selección se modela con `null`, no
  recortando el tipo.
- Commit: `6142dfd`.

### Alcance nuevo decidido: conmutador de vista (paso 3)

- El propietario decidió que la lista necesita vistas **día / semana / mes**.
  Advertencia de alcance hecha (MVP era hoy + atrasadas); decisión explícita
  del propietario: justificado por el flujo de planeación semanal.
- Plan acordado: paso 3 = conmutador de vista (Hoy default del MVP +
  Semana + Mes); paso 4 = lista visual real (check, prioridad, Atrasadas).

### Estado / siguiente paso

- ✅ Captura con destino activo (día + prioridad) funcionando y probada.
- ⏭️ Siguiente: **paso 3 — conmutador de vista Hoy/Semana/Mes** en la lista.
  Después: lista real con check y sección Atrasadas.
