# Bitácora del proyecto — Relief

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

### Paso 3 — conmutador de vista Hoy/Semana/Mes

- Contrato acordado con el propietario (6 decisiones, todas opción A):
  1. Vista **Hoy fija** (no navegable): la pregunta central del MVP.
     Grupos: Atrasadas (fecha < hoy, sin estética de alarma) + Hoy + Sin fecha.
  2. Semana y Mes **navegables** con ‹ › (necesario para verificar lo
     capturado a futuro; captura y vista comparten el concepto).
  3. Semana **apilada por día** (no columnas): responsive para la v2 móvil.
  4. Mes como **lista compacta** solo con días que tienen tareas.
  5. Tareas sin fecha (null, legacy): grupo "Sin fecha" al final de Hoy.
  6. Extracción a `components/TaskList.tsx`; App.tsx queda como armador.
- Propietario pidió además transiciones smooth al cambiar de vista:
  implementado con CSS puro (keyframes `aparecer` en App.css + re-montaje
  del contenedor vía React `key` al cambiar vista/ancla). Sin dependencias nuevas.
- Detalles técnicos: filtrado todo del lado frontend (get_tasks sin filtros,
  decisión registrada); "ancla" compartida entre Semana y Mes (una fecha que
  cada vista interpreta como su semana/mes); vistas como funciones puras.
- Error aprendido: import sin usar detectado por `noUnusedLocals` de TS —
  TaskList recibe tasks como prop, no consulta el store directamente.
- Probado por el propietario con `npm run tauri dev` (lanzamiento desacoplado
  con log en %TEMP%): funciona bien.
- Commit: `efa86fd`.

### Paso 4 — el check: completar con gratificación

- Contrato acordado (todo opción A): comando **toggle** `set_task_completed(id,
  completed) -> Task`; completadas se quedan en su grupo tachadas (muro de
  victorias); contador de progreso `Hoy · 3/8 completadas` en la vista Hoy.
- Implementación: Rust idempotente (pedir lo que ya es verdad = no-op sin
  evento); eventos `completed` / `reopened` según dirección; `completed_at`
  vuelve a NULL al desmarcar; atrasadas completadas excluidas de Atrasadas
  (luego corregido, ver abajo); check verde CheckCircle2 + tachado +
  active:scale-90 (micro-victoria táctil, CSS puro).
- Corrección tras probar el propietario: una atrasada completada **no debe
  desaparecer** de Atrasadas (esconder la victoria contradice la filosofía).
  Queda tachada y atenuada en el grupo. El propietario decidió este cambio.
- Error dev aprendido (registrado para explicar en entrevistas): "TypeError:
  api.setTaskDueDate is not a function" tras una tanda de edits con la app
  corriendo — el HMR de Vite dejó la memoria del navegador con una mezcla
  de módulos viejos/nuevos. El disco estaba correcto (builds pasaban).
  Lección: sospechar del HMR antes del código; recargar/reiniciar el dev.

### Paso 5 — reorganización de atrasadas

- Contrato acordado: comando ÚNICO `set_task_due_date(id, due_date)` —
  "Mover a hoy" (un click) y "Más opciones" (picker) usan el mismo motor;
  redistribución MANUAL (opción A); la automática queda para la IA de la v2.
- Idempotencia igual que set_task_completed; evento `rescheduled` con
  payload `{ de, a }` (patrón conductual para la IA de la v2).
- Reuso clave: WeekPicker exportado desde CaptureBar con callbacks separados
  `onSelect` (elegir) vs `onMoverSemana` (flechas ‹ › solo navegan — si
  reusaran onSelect, navegar re-agendaría la tarea por accidente). Patrón:
  separar intención de navegación de intención de elección.
- UI: `AtrasadaLinea` (check + 2 acciones, solo si está pendiente); picker
  debajo de la fila, arranca en la semana de la fecha actual de la tarea,
  se cierra al elegir; cada fila tiene su picker (estado local).
- Commit: `eb05d4e`.

### Paso 6 — edición de tareas (doble motor, UI minimalista)

- Origen: dogfooding del propietario ("cuando me equivoco de fecha no puedo
  modificarla"). Fricción real detectada por uso diario, como preveía la visión.
- Decisión del propietario: opción **B completa en una tanda** (título +
  prioridad + fecha), con UI "clever y minimalista" — sin ruido visual.
- Diseño acordado: los textos visibles SON los botones (cero cromo nuevo).
  Click en título → input (Enter/Esc/click fuera); click en fecha → WeekPicker
  debajo de la fila; click en prioridad → mini-popover. Un panel a la vez.
  Hover sutil como insinuación. "Mover a hoy" solo en Atrasadas; el botón
  "Más opciones" desapareció (reemplazado por el click en la fecha).
- Rust: `update_task(id, {title?, priority?})` — idempotente (solo cambios
  reales), evento `updated` POR CAMPO con payload {campo, de, a}.
  La fecha sigue por `set_task_due_date` (evento `rescheduled`): semántica
  separada para la IA v2 — "corregir typo" ≠ "posponer tarea".
- Refactor: `AtrasadaLinea` eliminada (redundante con TareaLinea
  generalizada); `PRIORIDADES` exportada de CaptureBar como única fuente
  de etiquetas de prioridad (TaskList la reutiliza).
- Error del build aprendido: `PRIORIDADES` no exportada → TS2459; la
  solución fue exportarla (una fuente de verdad), no duplicarla.
- Commit: `ee9d680`.

### Paso 7 — papelera de reciclaje

- Origen: propietario detectó que no había opción de borrar ("ahora no
  tenemos la opcion para borrar las tareas").
- Decisión de producto del propietario (argumento de privacidad, citable):
  guardar data que el usuario quiso borrar invade su privacidad ⇒ papelera
  VISIBLE con borrado permanente desde ahí; "borrarlas todas con un solo
  botón o una por una". Soft delete solo como sala de espera visible,
  no archivo oculto.
- Contrato acordado:
  - Migración idempotente de BD (primera del proyecto): ALTER TABLE ADD
    COLUMN deleted_at; corre cada arranque; "duplicate column name" = ya
    aplicada, se ignora.
  - Comandos: set_task_deleted(id, deleted) toggle (eventos
    trashed/restored), purge_task(id) (fila + su task_event: sin rastro),
    purge_all_tasks() (vacía papelera; sub-SELECT de eventos primero —
    orden correcto si algún día se activan las FK de SQLite).
  - Evento NO existe para purge: el borrado es el fin del historial,
    no otro capítulo. Prioridad en el argumento de privacidad.
- UI: pestaña Papelera con contador SOLO si hay algo (cero ruido vacía);
  filas con Restaurar / Borrar (directos: llegar a la papelera ya fue
  deliberado) y Vaciar papelera con confirmación inline ¿Sí/No (roja).
  Basura en hover (opacity-0 + group-hover) SIN confirmación (reversible).
- Refactor: helper task_de_fila en Rust (el mapeo fila→Task ya no se
  repite en 4 comandos — misma filosofía que PRIORIDADES: no duplicar).
- Error TS aprendido: pasar setTaskDeleted (2 params) donde onDelete
  espera (id) => void → TS2322; solución: envolver en arrow con la
  dirección fija (true).
- El filtro deletedAt vive UNA vez (TaskList): las vistas siguen
  recibiendo solo tareas activas — no se enteran de la papelera.
- Commit: `29b2b87`.

### Renombre del producto: TaskLens → Relief (2026-09-11)

- Decisión del propietario: el nombre era lo más flojo del proyecto y lo
  dijo explícito ("quiero cambiarle el nombre... uno mejor"). Proceso:
  opciones en español (Alivio, Listo, Ya., Tacha, Hoy) → decisión de ir a
  inglés ("como relieve") → opciones (Relief, Exhale, Sigh, Clear, Offload)
  → **Relief**. Es el sentimiento del final del loop: el alivio de tachar.
- Alcance: renombre completo punta a punta (elección del propietario,
  opción B de datos):
  - Nivel 1 visible: título de ventana, h1 de la UI, title de index.html,
    package.json, encabezados de docs y AGENTS.md.
  - Nivel 2 técnico: package Cargo `relief`, lib `relief_lib` (+ main.rs),
    identificador Tauri `com.benja.relief`, productName `Relief`,
    BD `relief.db`.
  - **Opción B (BD fresca)**: la BD vieja `tasklens.db` queda huérfana en
    el directorio del identificador anterior; se arranca sin datos. El
    historial corto se sacrifica a cambio de coherencia total.
  - Bitácora histórica: las menciones a TaskLens en entradas pasadas SE
    MANTIENEN (registro cronológico, no se falsifica). Solo encabezados
    y visión reflejan el nombre actual.
- Pendiente: README del proyecto (para GitHub), ícono/branding de la app.

### Skills de diseño instaladas (2026-09-11)

- Propietario aprobó instalar 5 skills de UI Skills (ui-skills.com, de
  ibelick) en `.opencode/skills/` — archivos de texto con instrucciones de
  diseño para agentes, NO dependencias del proyecto:
  - `improve-ui` (ibelick): auditoría read-only con plan de implementación.
  - `frontend-design` (Anthropic): rediseño distintivo anti-genérico.
  - `improve-animations` (emilkowalski): auditoría de movimiento.
  - `better-ui` (jakubkrehel): pulido fino (hover, sombras, radios).
  - `web-design-guidelines` (vercel/antfu): revisión final + a11y.
- **Plan de rediseño visual acordado** (para la próxima sesión):
  1. `improve-ui`: auditoría honesta de la UI actual.
  2. Dirección visual: propietario decide tema (claro/oscuro por decidir,
     NO asumimos dark) con el prompt de diseño ya preparado (sin paleta:
     la IA describe ROLES de color, valores los elige el propietario).
  3. `frontend-design` + `better-ui`: aplicar el rediseño.
  4. `improve-animations`: motion.
  5. `web-design-guidelines`: control final.
- Nota: prompt de diseño (para otra IA o para estas skills) quedó listo
  con las funcionalidades actuales de Relief, incluida la papelera.

### Sesión 3 — Rediseño visual "Alivio" (2026-09-11)

- Propietario tocó la app tras días de dogfooding y entregó hallazgos
  críticos: fondo monotoroco, texto sordo, sin vida, chips y flechas de
  tamaños distintos, rectángulo feo al foco del input, la vista Semana
  una pared de "—" que no aportaba. Todo válido, todo visual.
- Cierre temático acordado: **Sereno/pineta** — tema claro y oscuro con
  acento pino (hue ~158), grises tintados con ese matiz, superficies
  neutras (no gris), sin estética de alerta. Paleta curada a mano.
- **Tokens semánticos**: en App.css con `@theme inline` y un sistema
  de variables por tema (`.dark)` — el común sería escribir border-
  line, bg-surface, text-ink directamente, y los dos temos comparten
  componentes sin tocarlos. Cambio mental: diseño → variables.
- Jefatura h-8 (32px) consistente en chips, tabs, flechas y botón
  de prioridad — nada se sale de ese trimestre. El input h-12, el check
  h-10, los días l-10. La regla es: si es clicable e independiente,
  tiene h-8 y texto.
- Chips exclusivos: abrir fecha cierra prioridad (ya no se pisa).
- La navegación del período se pasó a la misma fila que el conmutador
  (una sola línea en lugar de toolbar secundaria) — mejor AAA local.
- El check respira con un pop-chave (keyframes), el interior de la Aguila
  se anima con CircleDot, la banca vacía guarda un punto pulsonante
  (punto-respirando) donde antes había "—" (frío). Y `capture-focus`
  para el input: cuando usas el teclado, aparece un ring verde suave.
- El texto "Semana del 7 al 13 sep" ahora incluye el fin "…de sep".
- Elimina ruido: no más pared *"—"*, no más letras en mayúsculas en
  el picker, pestañas en sentence-case. Todavía no entiendo el color
  combo el tema profesional pero se quedó.

### Sesión 4 — auditoría visual con pruebas propias (2026-09-14)

- Método nuevo: el propietario exigió que la auditoría la hiciera la IA
  (no delegando verificaciones). Se tomó screenshot de la app en vivo con
  Chrome headless contra localhost:1420 — la IA ve lo mismo que el usuario.
- Diagnóstico real confirmado: los cambios SÍ estaban en el bundle, pero
  (a) varios quedaban como CSS huérfano sin consumirse, (b) el check
  dibujado tenía un bug real: .ch-mark sin stroke → la marca era invisible,
  (c) el outline:focus-visible del input encimaba un segundo rectángulo
  sobre el halo del contenedor (el "rectángulo feo" que reportó el propietario).
- Corregido y verificado:
  - ch-mark con stroke/w2/linecap/linejoin + check-pop spring al completar.
  - Filas: clase tarea-fila (hover: lift -1px + borde + sombra con brillo
    de acento; completada: pincelada de acento al 7%).
  - Stagger (entrada-cascada) conectado en las 3 vistas.
  - Contenedor de captura único: capture-focus input → outline:none.
  - Empty state con 2 líneas (acción + guía) y punto que respira más grande.
  - Layout ensanchado max-w-xl → max-w-2xl.
- Tipografía Inter Variable instalada vía @fontsource-variable/inter con
  features OpenType (ss01, cv01-cv04).
- Lección de encoding crítica: PowerShell Set-Content corrompió 93 líneas
  de comentarios UTF-8 (mojibake doble-encoding). TaskList.tsx y App.tsx
  reescritos completos con Write tool (UTF-8 limpio). REGRA: nunca escribir
  archivos con Set-Content en este proyecto — usar Write/Edit.
- Error rojo "Cannot read properties of undefined (reading 'invoke')":
  artefacto de Chrome headless (sin IPC Tauri), NO existe en la ventana real.
- Commit: `b521177`.

### Sesión 5 — auditoría de movimiento (improve-animations)

- Se usó por fin la skill `improve-animations` (instalada y nunca corrida).
  Método: recon → auditoría por categorías → vetado → corrección de los
  HIGH/MED → presentación del resto al propietario.
- Recon: CSS puro (sin librería de motion); 6 keyframes y 10 clases en
  App.css + transiciones inline de Tailwind; 8 duraciones y 4 curvas
  hardcodeadas; frecuencia: check/hover/navegación = altísima.
- Corregidos:
  - HIGH a11y: `check-pop` NO se suprimía con `prefers-reduced-motion`
    (la animación vive en `.ts-check.completed svg`, el bloque apuntaba a
    `.ts-check`). Agregado + `.tarea-fila` y `transform: none`.
  - HIGH propósito/frecuencia: la cascada se REPETÍA en cada navegación
    (flechas semana/mes) retrasando el contenido y duplicándose con el
    fade. Ahora la key de la vista es solo `vista` (navegar es
    instantáneo; cambiar de pestaña sí anima) y los delays bajaron a 30ms.
  - MED cohesión: tokens de movimiento (`--dur-fast/base/slow`,
    `--ease-out-ui/out-soft/spring`) — una sola fuente de verdad.
  - MED fisicalidad: `transform-origin: top` en `.panel-animada` (antes el
    panel se "inflaba" desde el centro en vez de desplegarse).
  - MED performance: sin transición de `box-shadow` en `.tarea-fila`.
  - MED duración: el dibujo del check bajó de ~380ms a ~220ms, manteniendo
    el trazo (es el momento firma del producto).
- Pendientes presentados (LOW + oportunidades): hover del check 1.15→1.08,
  check-pop interrumpible, animaciones de salida, indicador deslizante de
  pestañas, pulso del contador al completar.
- Commits: `e998ee9` (HIGH), `a1ca87b` (MED).

### Sesión 5 — motion suave, las 5 pendientes implementadas

- El propietario pidió las 5 pendientes del audit con "mientras más smooth
  mejor". Implementado:
  1. Hover del check 1.15 → 1.08 (menos agresivo).
  2. Pop del check **interrumpible**: se dejó de usar keyframe; el icono
     vive en scale(0.94) y transiciona a 1 con curva de resorte —
     destildar a mitad revierte suave.
  3. **Salida animada de paneles**: hook `usePresencia`
     (src/lib/usePresencia.ts) que retiene el montaje ~140ms mientras corre
     `panel-saliendo`; CSS no puede animar lo que React desmonta.
  4. **Píldora deslizante** en el conmutador: un solo objeto viaja entre
     pestañas (translateX + width medidos con refs/useLayoutEffect, re-medidos
     en resize); se eliminó el fondo por-pestaña.
  5. **Pulso del contador** "n/m": el span se re-monta con key = conteo y
     late una vez al cambiar (la micro-victoria se siente).
- Hallazgos propios al VER la app (no solo código): encabezados de día en
  Mes sin `sutil` (incoherente con Semana) y copy "del 7 sep al 13 de sep"
  → corregidos ("del 7 al 13 de sep").
- Método de verificación nuevo: mock del puente Tauri
  (`window.__TAURI_INTERNALS__.invoke`) inyectado con `initScript` vía
  chrome-devtools MCP → la app completa se renderiza en el navegador y se
  puede auditar/interactuar con capturas propias (antes el error de
  `invoke` ocultaba la lista).
- Commit: `6da2973`.

### Sesión 6 — presión de botones y la causa raíz del "no anima"

- Queja del propietario: "no veo animaciones smooth al presionar los botones".
- **CAUSA RAÍZ encontrada (no era el código)**: la máquina tiene las
  animaciones de Windows apagadas — `MinAnimate = 0` y
  `SPI_GETCLIENTAREAANIMATION = 0` → el sistema reporta
  `prefers-reduced-motion: reduce` → Relief (correctamente) suprimía TODO
  el movimiento. Verificado en el navegador: `transitionDuration: 0.01ms`.
- Solución: **interruptor de animaciones en la cabecera** (ícono Sparkles,
  encendido por defecto) que agrega `.forzar-movimiento` al `<html>`; el
  bloque de reduced-motion ahora se aplica con
  `html:not(.forzar-movimiento)` — la app anima aunque el OS diga lo
  contrario, y quien no quiera movimiento lo apaga ahí. Persiste en
  localStorage (`relief-movimiento`) y se aplica en el script inline de
  index.html (sin flash).
- Lenguaje de presión universal: regla única
  `button:not([data-presion="off"])` (especificidad justa para ganarle a
  Tailwind sin !important) → todos los botones hunden a `scale(0.96)` con
  **curva de resorte** (`--ease-spring`) en el scale y curva nítida en los
  colores, 140ms, interruptible, `touch-action: manipulation`.
- Limpieza según las skills (micro-interaction + transitions-dev):
  - Eliminados los 2 `transition-all` que quedaban (chips) y el
    `active:scale-90` del botón [+].
  - `.ts-check` pasó de `transform` a la propiedad `scale` (no pisa el
    scale del icono ni la presión global).
  - `--ease-out-soft` actualizado a `cubic-bezier(0.22, 1, 0.36, 1)`
    (expo-out de transitions.dev) — entradas notablemente más suaves.
  - Nuevo token `--ease-standard` para salidas; la salida de paneles usa
    duración corta + curva estándar ("salir es más rápido que entrar").
- Verificación en navegador con mock del puente Tauri: `reduceActivo: true`
  + `claseForzar: true` → todos los botones con `0.14s` y resorte.
- Commit: `1968cd0`.

### Sesión 7 — rediseño editorial retro-moderno

- Brief del propietario (aplicado a Relief, manteniendo estructura y
  funcionalidad intactas): estética de tinta sobre papel, editorial
  retro-moderna, minimalista, con trazo ilustrado.
- Paleta (fiel al brief): canvas crema `#F7F4EE`, superficie `#efe9df`,
  tinta `#1a1a1a`, cobalto `#1b49b6` como acento interactivo. **Sin
  sombras difusas**: `--sombra: none` y toda la jerarquía pasa a trazos
  (bordes de 1px). Modo oscuro reinterpretado como "tinta nocturna"
  (`#14161b` + cobalto claro) para no romper el toggle existente.
- Tipografía (fuentes locales vía fontsource, sin depender de internet):
  - **Fraunces Variable** (display): wordmark y encabezados de grupo.
  - **Inter Variable** (cuerpo).
  - **Caveat Variable** (manuscrita): fechas y detalles secundarios
    ("jue 10 sep", "borrada…", "semana del 7 al 13", dateline).
- Componentes: radios moderados (8px chips/pills/botón +, 12px tarjetas),
  botón primario en cobalto sólido, chips y pestañas con trazo de tinta
  (activo en cobalto suave), check dibujado en cobalto.
- Ilustraciones de línea a una sola tinta (SVG a mano) para los dos estados
  vacíos: hoja con casilla marcada y lápiz (vista Hoy); papelera.
- Prioridad: "Alta" pasa a cobalto semibold (antes rojo) — la paleta del
  brief no incluye rojo; el rojo queda SOLO para errores (semántica).
- Bug encontrado verificando en vivo: al vaciar la papelera desde su propia
  vista, la píldora del conmutador quedaba huérfana (la pestaña desaparece
  pero la píldora conservaba posición). Corregido: sin pestaña activa, la
  píldora se oculta.
- Verificado con capturas propias (claro, oscuro, vacío, papelera) y con el
  flujo real de vaciado (regresión de funcionalidad OK).
- Nota de proceso: se rompió momentáneamente la regla de encoding usando
  Set-Content en CaptureBar (15 líneas con mojibake); el archivo se
  reescribió completo con la herramienta correcta. Regla vigente: nunca
  Set-Content.
- Commit: `97cc12d`.

### Sesión 8 — arquitectura de skills (genéricas a global)

- Pregunta del propietario: "¿no deberíamos cargarlas todas a nivel global?".
  Análisis y decisión (Opción A): las skills que usamos son **capacidades
  genéricas** (diseño, motion, tipografía, a11y, testing, auditorías), no
  activos de Relief → viven en `~/.config/opencode/skills/` y sirven a
  todos los proyectos. El repo de Relief queda solo con código del producto.
- Instaladas 8 nuevas en global:
  - **Anthropic** (clonadas del repo oficial `anthropics/skills`, con sus
    `scripts/` y `examples/`): `webapp-testing`, `brand-guidelines`,
    `skill-creator`.
  - **Registro ui-skills** (CLI): `better-typography`, `better-accessibility`,
    `improve` (shadcn), `improve-react` (millionco),
    `fixing-motion-performance` (ibelick).
- Migradas las 11 existentes del proyecto a global (copia con Copy-Item —
  binaria, segura) y `git rm -r .opencode/skills` en el repo.
- Catálogo global final: **19 skills nuestras + `contabilidad-jw` del
  propietario = 20** (todas con SKILL.md válido).
- AGENTS.md actualizado: documenta que las skills viven globalmente, el
  catálogo por área, y que las skills **específicas de Relief** (si se
  crean, ej: "convenciones Relief") sí vivirán en `.opencode/skills/`.
- Pendientes anotados: `webapp-testing` corre con Playwright al usarse
  (deps cuando la usemos, con visto bueno); las skills de Anthropic
  mencionan herramientas de Claude Code en su texto — se adaptan al usarlas.
- **Requiere reinicio de opencode** para cargar el catálogo completo.
- Commits: `ecb030d` (migración) + el de AGENTS.md/bitácora.

### Sesión 9 — auditoría visual exhaustiva y corrección de hallazgos

- El propietario pidió auditoría visual completa con protocolo: explorar
  el 100% de los elementos accionables, forzar todos los estados, medir
  (no adivinar) y reportar en formato estructurado.
- Método: inventario de código (grep de radios/alturas/textos/pesos/
  transiciones) + tour interactivo en el navegador con el mock del puente
  + medición de estilos computados de ~15 elementos por vista.
- **Puntaje de consistencia: 93/100.** Hallazgos corregidos:
  1. MED — doble contorno en el input de edición de título (borde cobalto
     + outline focus-visible encimado; el mismo defecto ya corregido en
     la captura, pero los inputs de fila no estaban cubiertos). Fix:
     regla `input.ts-editar:focus-visible { outline: none }`.
  2. MED — popover de prioridad + edición de título coexistían en la
     misma fila. Fix: `empezarEditar` cierra los paneles abiertos.
  3. LOW — el span del título transicionaba a 150ms vs token 140ms
     (los spans no son botones y no heredan la regla global). Fix:
     todas las `duration-150` (16 en 4 archivos) → `duration-[140ms]`.
  4. LOW — `rounded-md` (6px) en el input de edición rompía la escala
     8/12. Fix: `rounded-lg`.
  5. LOW — layout shift al abrir paneles inline: **decisión deliberada**
     (comportamiento estándar; la alternativa —posición absoluta—
     taparía la lista). Documentada, no se corrige.
- **Verificación en vivo de cada fix** (requisito del propietario):
  popover true→false al editar (coordinación OK); input de edición con
  radius 8px y outline "3px none" (captura en pantalla: un solo borde
  cobalto); span del título computed `0.14s`; cero `duration-150` y
  cero `rounded-md` en el código.
- Nota de proceso: volví a romper la regla de encoding con Set-Content en
  TaskList (mojibake en "pestañas"); el archivo se reescribió completo y
  limpio, y el stash de seguridad se descartó tras verificar.
- Commits: `8d61115` (fixes de auditoría).

### Sesión 10 — identidad editorial reforzada (con las referencias del propietario)

- El propietario reportó "no veo mejoras visuales significativas". Dos
  causas reales encontradas:
  1. **La app abría en modo oscuro** (el tema oscuro del rediseño es
     sutil: tinta nocturna vs el verde viejo se parecen a primera vista).
     Fix: el tema por defecto pasa a ser **claro** (la identidad "papel");
     el oscuro se recuerda solo si el usuario lo elige. Antes dependía de
     la preferencia del sistema (su Windows reporta oscuro).
  2. **Faltaba lo que definen sus referencias** (`Inspiracion/`, 3 JPGs):
     - **Miette**: wordmark ultra-gordo con regla decorativa debajo y
       etiquetas en MAYÚSCULAS espaciadas.
     - **Beaver con taza**: personaje ilustrado a mano en tinta cobalto.
     - **Stay Cool**: grabado con gran presencia + caps espaciadas.
- Cambios aplicados:
  - Wordmark: Fraunces **900** (antes 800), 40px, tracking -0.045em, con
    **regla corta debajo** (el detalle de bistro de la referencia).
  - **Etiquetas en mayúsculas + tracking** (`.etiqueta`: uppercase,
    0.16em, 10px) reemplazan la manuscrita Caveat en: fecha del
    encabezado, fechas de fila, "borrada…", período de semana/mes y el
    label del picker. **Caveat se desinstaló** (no estaba en las
    referencias; menos peso muerto).
  - **Mascota ilustrada**: un gato contento con su taza, dibujado a mano
    en tinta cobalto (SVG a mano, trazo suelto, sin relleno) en el estado
    vacío de Hoy; la papelera también pasa a cobalto. Verificada en
    aislamiento con captura antes de integrarla.
  - Copy normalizado a español neutro (se me escapó voseo: "empezá").
- Verificación: captura del encabezado en la app (wordmark + regla +
  caps) y captura aislada de la mascota y la papelera (HTML temporal).
- Commit: `0285259`.

### Sesión 11 — afinado de paleta

- El propietario preguntó si la paleta era la mejor. Evaluación honesta:
  sólida pero con 3 desvíos respecto a las referencias de `Inspiracion/`.
- Cambios aplicados:
  - `--canvas` `#f7f4ee` → **`#f6f1e6`** (papel más cálido/amarillento,
    como la referencia "Stay Cool").
  - `--surface` `#efe9df` → **`#ede5d6`** (contraste real con el papel:
    antes las tarjetas dependían solo del borde).
  - `--accent` `#1b49b6` → **`#1f4291`** (azul TINTA: más profundo y
    apagado; el anterior leía como "azul web"/link).
  - `--accent-soft` `#dde5f7` → **`#dde2ee`** (tinte de selección apagado).
  - `--line` `#d3c9b8` → **`#d1c6b2`** (coherente con el papel nuevo).
  - Dark: accent `#7fa3f5` → **`#6e8fe0`** (menos neón).
  - **Prioridad Alta pasa de azul a TINTA PLENA** (`font-semibold text-ink`):
    el azul queda reservado para lo interactivo/seleccionado.
- Commit: `eff11b6`.

### Flujo de trabajo acordado: verificar en el navegador, no abrir/cerrar la app

- El propietario pidió dejar de abrir y cerrar la app durante el proceso.
- Nuevo método: **Vite sirve la app con recarga en caliente** → la ventana
  de la app se actualiza sola; la verificación se hace en el navegador.
- Para ver la app COMPLETA (con datos) sin el puente Tauri se agregó un
  harness local **`dev-mock.html`** (en `.gitignore`, no va al repo): la
  misma app + un mock de `invoke` con datos de ejemplo. Params:
  `?tema=dark` y `?vacio=1`. Capturas con Chrome headless
  (`--virtual-time-budget` para que asienten las animaciones).
- Regla operativa: **no matar/relanzar `relief.exe`** para verificar.

### Sesión 12 — calidad y primeros tests (proyecto pasa de 0 a 21 tests)

- Punto de partida del análisis: el proyecto tenía **cero tests y cero
  linting**. Se instalaron skills de testing/calidad (sesión anterior).
- **Clippy: cero warnings** (ya venía limpio) — verificado con
  `cargo clippy --all-targets`, incluidos los tests.
- **Refactor de testabilidad** (patrón enseñable): la lógica de cada caso
  de uso se extrajo a funciones que reciben `&Connection`
  (`crear_tarea`, `completar_tarea`, `mover_tarea`, `actualizar_tarea`,
  `marcar_borrada`, `purgar_tarea`, `vaciar_papelera`, `listar_tareas`).
  Los `#[tauri::command]` quedaron como **envoltorios finos** (lock + delegar).
  Es inversión de dependencia: la lógica no depende del framework → testeable.
  - Bonus: se eliminó la repetición del `query_row` (4 copias) con
    `leer_tarea`, y el INSERT del log con `registrar_evento`.
  - `db::crear_esquema` se separó de `init_db` para que los tests levanten
    una BD **en memoria** con exactamente el mismo esquema que la app.
- **21 tests** (`cargo test`, todos verdes) que cubren los 8 comandos:
  validaciones del borde (título vacío/largo, prioridad, fecha imposible),
  idempotencia (completar/mover/papelera dos veces = un solo evento),
  eventos correctos por acción (`created`, `completed`, `reopened`,
  `rescheduled` con {de,a}, `updated` por campo, `trashed`, `restored`),
  purga sin rastro en el log, vaciado selectivo y listado sin filtros.
- Error de compilación aprendido: `stmt does not live long enough` — el
  iterador de `query_map` presta el statement; hay que **recoger en un Vec
  antes de retornar** (el borrow no puede sobrevivir a la función).
- Commit: `09c05d2`.

### Sesión 13 — revisión de diseño con skills (design-review + better-colors)

- Se usó la skill `design-review` sobre la UI actual (evidencia: capturas de
  `dev-mock.html` + medición real de contraste, no impresiones).
- **Nota de privacidad**: se omitió el ping anónimo de telemetría que trae la
  skill (envía datos a un servicio externo; va contra el criterio de
  privacidad del propietario y no aporta a la revisión).
- Hallazgos y correcciones:
  1. 🔴 **`--ink-faint` fallaba WCAG AA** (3.03–3.37:1) y se usa en texto
     real: fecha del encabezado, encabezados de día en Semana/Mes,
     "borrada…", placeholder y "Prioridad:". Fix: `#8a8275` → **`#6a6353`**
     (5.29:1 sobre papel, 4.76:1 sobre tarjeta); en oscuro `#6f6a5e` →
     **`#8f8877`** (4.68:1).
  2. 🟠 **El borde del campo de captura no cumplía 3:1** para límites de
     control (1.50:1). Fix: token nuevo `--line-input` (`#8a8275` claro /
     `#6f6a5e` oscuro) → 3.37:1 / 3.06:1. Los bordes de tarjeta quedan
     sutiles a propósito (decorativos, no delimitan controles).
  3. 🟡 **Etiquetas de 10px en mayúsculas espaciadas** eran ilegibles.
     Fix: 11px con tracking 0.14em.
  4. 🟡 **Áreas táctiles de 32px** (h-8) — insuficientes para la v2 móvil.
     Fix: `@media (pointer: coarse) { min-height/width: 44px }` (crece el
     área de toque sin cambiar el layout de escritorio).
- Verificación: script de contraste propio antes/después (todos los pares
  ≥4.5 en texto, ≥3:1 en límites de control) + captura confirmando que la
  estética editorial se mantiene.
- Commit: `7364dcd`.

### Sesión 14 — segunda pasada de correcciones con las skills de frontend

- Con las skills nuevas (`tailwind-token-consolidation`, `better-writing`,
  `better-layout`, `performance`) se corrigieron hallazgos del código real:
  1. **Código muerto eliminado**: `.ambiente-vivo` (el glow quedó en
     `display:none` tras el rediseño plano), `.elevada` + token `--sombra`
     (no-op desde el sistema sin sombras) y sus referencias en componentes.
  2. **Assets del scaffold eliminados**: `public/vite.svg` (¡era el
     favicon!), `public/tauri.svg`, `src/assets/react.svg` — se
     empaquetaban en el binario sin uso.
  3. **Favicon propio**: `public/relief.svg` (la marca "r." en la paleta).
  4. **Íconos reales de la app** (pendiente de "publicar", resuelto): se
     generó un PNG 1024×1024 desde la marca (render con Chrome headless) y
     `npm run tauri icon` produjo **escritorio (ico/icns/png) y móvil
     (Android mipmaps + iOS)** — adiós al ícono por defecto de Tauri.
  5. **Copy**: `"{n} tarea(s) se borrarán"` (plural lazy) → singular/plural
     reales; "Nada en este mes" → **"No hay nada este mes"**.
  6. **Ritmo de espaciado**: los contenedores de vista mezclaban
     `space-y-5`/`space-y-6` → unificados a `space-y-6` (8px entre filas,
     24px entre grupos: dos ritmos, cada uno con propósito).
- Verificado: build OK, captura propia de la app sin regresiones visuales.
- Commit: `97899f6`.

### Sesión 15 — pasada orgánica (quitar el "feel de IA")

- Queja del propietario: "la app tiene un feel de IA, no se siente orgánico".
  Diagnóstico honesto (coincide con los tells que lista la skill
  `frontend-design`): el diseño era coherente pero estaba armado con **dos
  clichés de diseño generado**:
  1. **El "kit SaaS"**: cada fila era LA MISMA tarjeta redondeada con el
     mismo radio y borde que todo lo demás.
  2. **El "eyebrow" de plantilla**: etiquetas en MAYÚSCULAS espaciadas
     repetidas en todo texto secundario.
  Y encima: papel de color plano (sin textura) y bordes/radios perfectos.
- Cambios aplicados (marco: skill `impeccable`):
  1. **La lista es un cuaderno, no tarjetas**: las filas son renglones
     separados por líneas de tinta (la fila es la unidad de lectura).
  2. **Grano de papel**: ruido SVG embebido (feTurbulence) al 5 % en
     multiply (claro) / screen (oscuro) → el papel es material, no un hex.
  3. **La regla del wordmark es un trazo a mano** (path SVG con vibración).
  4. **El check es un círculo dibujado a mano**: dejó de ser un `<circle>`
     perfecto — es un path irregular; es el elemento más tocado.
  5. **Cajas "cortadas a mano"**: radios levemente distintos por esquina.
  6. **Menos mayúsculas espaciadas**: reservadas para la fecha del
     encabezado y los períodos; fechas de fila y "borrada…" volvieron a
     minúscula → se fue el tell del eyebrow repetido.
- Verificado con capturas propias en claro y oscuro.
- Commit: `b5bc4d9`.

### Sesión 16 — pasada editorial profunda (tipografía y composición)

- Crítica del propietario: la pasada anterior "solo cambió la forma de las
  tareas, nada más". Correcto: el resto seguía con lenguaje de kit de UI.
  Esta vez se cambiaron **tipografía y composición**, no solo formas:
  1. **El contenido va en serif**: los títulos de tarea (y el texto de la
     captura) usan Fraunces con su **eje óptico en tamaño de lectura**
     (`opsz 20`) — la lista se lee como un documento escrito, no como filas
     de app. La interfaz (botones, etiquetas, fechas) sigue en Inter: dos
     voces, cada una con su trabajo.
  2. **La captura es un RENGLÓN, no una caja**: línea de tinta abajo, texto
     escrito encima, y el botón de crear es un **punto azul** que repite el
     punto del wordmark. Sin caja, sin fondo, sin radio.
  3. **Acciones de tinta**: los chips ("+ Fecha", "Prioridad") dejaron de ser
     píldoras con borde → texto subrayado, como anotaciones al pie.
  4. **Pestañas de texto subrayado**: se fue el "segmented control" con
     píldora; el subrayado del activo es un **trazo a mano que viaja**
     (misma firma que la regla del wordmark). Se conserva la animación.
  5. **Masthead compuesto**: wordmark a 52px con su regla, fecha como
     anotación alineada a la base, y línea de tinta separando cabecera del
     cuerpo (composición de diario, no barra de app).
  6. **Ajustes al pie**: tema y movimiento bajaron al pie del documento:
     son ajustes del documento, no del día.
- Áreas de toque: la regla de 44px en punteros gruesos excluye las acciones
  de tinta (crecen en padding vertical sin mover el subrayado).
- Verificado con capturas propias en claro y oscuro.
- Commit: `eec19c2`.

### Sesión 17 — poda de skills y mapa de routing

- El propietario preguntó qué skills eran redundantes. Primera recomendación
  (juzgando por descripciones): borrar 5. **El propietario preguntó el porqué
  y la evidencia lo desmintió**:
  - `taste-skill` pesa **85 KB** (la más grande del catálogo) y cubre brief
    inference, dials, map al design system y guardrails — `impeccable`
    (11.6 KB) es un *router* cuyas `reference/*.md` **no se descargaron**.
    Sugerir borrarla fue un error.
  - `improve` (repo completo: seguridad, perf, tests, DX) **no** duplica a
    `improve-ui` (solo superficie) ni a `improve-react` (solo React): es el
    único que audita Rust, SQLite y seguridad.
  - En las auditorías web el criterio estaba invertido: la que sobra es la
    chica (`web-design-guidelines`, 1.2 KB), no la grande
    (`web-quality-audit`, 10.2 KB).
- Lección de método registrada: **el costo de tener skills no es contexto**
  (se cargan on demand), es la **ambigüedad de routing**. La solución
  correcta no es podar capacidades sino documentar cuándo usar cada una.
- Acciones:
  1. **Eliminada solo `brand-guidelines`**: su contenido son las guías de
     marca de Anthropic (colores y tipos de ellos) — inaplicable a Relief.
     Catálogo: 41 → 40.
  2. **Mapa de routing en AGENTS.md**: tabla "cuándo usar qué" por intención
     (diseño, auditoría, motion, testing, stack, v2) + nota de mantenimiento:
     *no borrar skills por solapamiento de descripción sin leer el contenido*.
- Commit: `5ca6987`.

### Sesión 18 — minimalismo y navegación horizontal

- Pedido del propietario: app "mucho más minimalista y sencilla", animaciones
  **horizontales** al cambiar de vista, y fuera el subrayado de ancho completo
  y el de la palabra "relief".
- Cambios:
  1. **Fuera las reglas de ancho completo**: la línea bajo el masthead, la del
     pie y la que cerraba la lista por arriba. Quedan solo las líneas *entre*
     renglones (que son lo que hace legible la lista).
  2. **Fuera la regla del wordmark** (`::after`): queda solo el wordmark con
     su punto azul como única firma.
  3. **Animación horizontal al cambiar de vista**: la vista nueva entra
     desplazándose desde el lado hacia el que viajas — derecha al avanzar
     (Hoy → Semana → Mes), izquierda al volver. Implementado con
     `ORDEN_VISTAS` (posición en la línea de tiempo) + `cambiarVista()` como
     único punto de cambio, y dos keyframes (`entrar-derecha` /
     `entrar-izquierda`). Reemplaza al fade vertical anterior.
  4. **Botones con borde → acciones de tinta**: "Mover a hoy", "Restaurar",
     "Vaciar papelera" y el "No" de la confirmación perdieron borde y fondo;
     ahora son texto subrayado (el "Vaciar" se pone rojo al hover).
- Verificado: build OK, clases de animación presentes en el bundle, capturas
  en claro/oscuro sin regresiones.
- Commit: `8ab19dd`.

### Sesión 19 — el "movimiento innecesario" entre vistas (bug de layout)

- Reporte del propietario: al cambiar de vista (Hoy/Semana/Mes) "la pantalla
  se mueve innecesariamente".
- **Diagnóstico medido, no supuesto**: al harness local (`dev-mock.html`,
  gitignored) se le agregó un badge de diagnóstico que imprime la posición X
  del wordmark, el ancho disponible y si hay scrollbar, más un parámetro
  `?tareas=N` para simular pantallas cortas (Hoy) y largas (Semana/Mes).
  - Medición ANTES: 1 tarea → `X=156 scroll=false`; 25 tareas →
    `X=149 scroll=true`.
  - **Causa**: al crecer el contenido aparece la barra de scroll, se angosta
    el ancho disponible y todo el contenido centrado se corre **7px**. Es el
    clásico *scrollbar jump*.
- **Fix**: `html { scrollbar-gutter: stable }` — el canal de la barra queda
  reservado siempre, haya barra o no.
- Verificación DESPUÉS: 1 tarea → `X=149`; 25 tareas → `X=149` → el
  contenido ya no se mueve ✓.
- **Segunda ronda** (el propietario reportó que "el tamaño" seguía
  cambiando al presionar Hoy/Semana/Mes, y que no había razón para ver
  días vacíos):
  - Nuevo diagnóstico en el harness (`?ciclo=1`): presiona
    Hoy → Semana → Mes → Hoy muestreando cada 16ms (posición del
    wordmark, overflow horizontal, scrollTop). Resultado a 1000×700 y
    1000×1100: el layout horizontal YA estaba estable (x fijo, sin
    overflow). Lección: la verificación anterior se hizo a 1100 de alto;
    la ventana real es 700 — siempre hay scrollbar, el fix del canal
    aplica siempre.
  - **Causa real del "cambio de tamaño"**: Semana renderizaba 7
    encabezados de día aunque estuvieran vacíos → la vista crecía/decrecía
    drasticamente al navegar, además de mostrar días sin información.
  - **Fix**: `VistaSemana` ahora filtra a los días con tareas (mismo
    criterio que Mes desde su origen) y muestra "No hay nada esta
    semana" si la semana está vacía. `GrupoDia` no renderiza grupos
    vacíos (guard defensivo). Con esto el tamaño de la vista depende de
    las tareas reales, no del calendario.
  - Verificado: Semana con tareas en 2 días → solo 2 encabezados;
    semana y mes vacíos → mensaje; ciclo completo sin movimiento.
- Commits: `6b0a3ff` (canal de scroll) + el de días vacíos.

### Sesión 20 — Motion: decisión, PoC y las que no se instalaron

- El propietario preguntó qué tecnologías mejorarían visuales/animaciones.
  Presenté 4 con trade-offs honestos: **Motion** (resortes, animación de
  layout, AnimatePresence, interrupción), **View Transitions API** (nativa,
  0 KB, pero se solapa con Motion), **Rive/Lottie** (requiere dibujar el
  asset en su editor — inversión de diseño, el runtime solo no hace nada)
  y **rough.js** (genera trazos a mano; sin sitio de uso hoy sería peso
  muerto). Aclaración de concepto registrada: la app es de escritorio y
  móvil, pero su *pincel* es el motor web del sistema (WebView2 /
  WKWebView / System WebView) — por eso la tecnología web aplica directo.
- El propietario pidió inicialmente "las 4"; tras la aclaración de que dos
  no son instalables como paquetes y una quedaría inerte, decidió:
  **solo Motion + PoC**. Las otras tres quedan documentadas con su
  disparador (Rive: cuando exista el .riv del gato; rough.js: nuevo
  elemento dibujado; View Transitions: solo si una superficie lo pide y
  no choque con Motion).
- Ajuste honesto del alcance del PoC: "tachar" no reordena la lista (las
  filas no se mueven al completar), así que el superpower se demuestra
  donde sí ocurre: **una fila que se va** (a papelera o reubicada de día)
  sale con fade+slide y las hermanas se deslizan a su lugar.
- Implementación:
  1. `motion` instalada (+129 KB raw, ~41 KB gzip en el bundle).
  2. `lib/movimiento.ts`: el estado del interruptor de animaciones sube a
     un mini store Zustand compartido (antes era useState local del botón;
     `MotionConfig` necesita leerlo).
  3. `<MotionConfig reducedMotion>` en App con paridad de reglas: activo →
     "never" (equivale a `.forzar-movimiento`), inactivo → "user".
  4. Píldora de pestañas → `motion.span` con spring (500/40). El ancho se
     anima directo (no con scale) para no estirar el trazo ondulado del
     SVG; a 6px de alto el costo es despreciable.
  5. Filas → `motion.li` con `layout="position"` + `AnimatePresence
     mode="popLayout"` en las tres listas (Hoy, GrupoDia, Papelera):
     exit = fade + slide a la izquierda (160ms), enter = fade (solo filas
     agregadas a un grupo ya montado; la primera carga la salta
     `initial={false}` para no duplicar la cascada).
  6. CSS: fuera la `transition` de `.pestana-pill` (dos motores sobre el
     mismo transform pelearían) y fuera del bloque reduced-motion (lo
     resuelve MotionConfig, no el `!important` del CSS — que habría
     clavado la píldora en x=0).
- Harness: el mock de `invoke` ahora implementa TODOS los comandos con
  mutación en memoria — la app es completamente funcional en el navegador
  (crear, tachar, reubicar, papelera) para probar animaciones sin Tauri.
- **Lección de verificación**: Chrome headless con `--virtual-time-budget`
  no produce frames → el frameloop de Motion (rAF) no corre → las
  animaciones quedan congeladas a mitad de camino en los dumps. El
  headless sirve para verificar ESTRUCTURA (filas renderizadas, píldora
  posicionada, ciclo sin regresión de layout: Δ=0 en todo) pero no el
  movimiento mismo — ese lo juzga el propietario en la app viva.
- Estado: **PoC a la espera de revisión del propietario** (HMR ya la
  sirve en la ventana abierta). Si aprueba: extender a los paneles
  (AnimatePresence reemplazando `usePresencia`) y a la transición entre
  vistas (con interrupción elegante). Commit: `b4395cb`.

### Sesión 21 — píldora serpiente (fase exploratoria)

- Al propietario le gustó la inercia de resorte de la píldora y pidió un
  efecto más "movimiento de serpiente" entre Hoy/Semana/Mes.
- Aprobado el plan: V1 (estirón) + V2 (estirón + ondulación) con selector
  para decidir viendo, intensidad sutil, sin rebote.
- Implementación (`27cfcc7`):
  1. `PildoraSerpiente` (TaskList.tsx) con 3 estrategias: `spring`
     (bloque rígido, la aprobada — baseline), `v1` (cabeza-llega-primera:
     el borde que lidera viaja en la fase 1 con el origen anclado y el
     cuerpo extendido `distancia + ancho`, la cola alcanza en la fase 2;
     espejo exacto al viajar a la izquierda; 0.3s total, 150ms por fase)
     y `v2` (v1 + el trazo fluye: `backgroundPositionX` animada en la
     dirección del viaje).
  2. Estado de medición ampliado a actual + anterior (la coreografía
     necesita de dónde partió; la primera medición pone anterior = actual
     para no arrastrar desde x=0).
  3. CSS `.pestana-pill-ondula`: tile ondulado de 44×6
     PERFECTAMENTE repetible (el SVG suelto no cerraba el ciclo:
     arrancaba en y=3 y terminaba en y≈2.2) en claro y oscuro, tamaño
     fijo + repeat-x (el trazo no se deforma con el estirón; fluye).
  4. Selección con `?variante=spring|v1|v2` leído SOLO en el harness: la
     app real de Tauri (sin query) sigue en `spring` hasta la decisión.
- Verificado en headless: las 3 variantes renderizan sin crash
  (píldora posicionada, filas con opacity 1), ciclo de layout estable
  (Δ=0). El movimiento en sí solo se juzga en navegador vivo — headless
  congela Motion sin frames (la píldora queda a mitad de viaje en los
  dumps: artefacto conocido, no bug).
- Estado: **Fase 2 pendiente — el propietario compara en vivo** y elige.
  Fase 3: productionizar la ganadora y borrar el resto.

### Sesión 21 (cont.) — decisión v1 + productionización

- El propietario eligió **v1** y pidió pulirla (la de 0.3s era casi
  imperceptible).
- Productionización (`5c44f18`):
  1. Duración 0.3s → **0.42s** (210ms por fase): se lee la coreografía
     sin volverse lenta.
  2. Fuera v2, spring-baseline, `?variante=`, `VARIANTE_PILDORA` y el CSS
     `.pestana-pill-ondula`: la ganadora es la única implementación.
  3. Guard honesto de reduced motion: `useReducedMotion()` + estado del
     interruptor propio. Si el sistema pide reducir Y la app no fuerza
     movimiento, la píldora aparece en su lugar sin keyframes (MotionConfig
     anula transforms, pero el `width` se anima directo y había que
     cortarlo a mano).
- Verificado: `npm run build` OK, `tsc --noEmit` limpio, ciclo de layout
  estable (Δ=0). El movimiento en vivo lo juzga el propietario (HMR ya lo
  sirve en su ventana).

### Sesión 22 — Relief como utilidad de bandeja

- Motivo: al propietario no le gustaba una app dentro de una ventana
  clásica de Windows; pidió acceso instantáneo desde los íconos ocultos.
- Nota de plataforma: Windows no deja poner un botón propio junto a la
  flecha `^`; el mecanismo es el **ícono de bandeja** (el usuario lo
  arrastra a la barra para dejarlo siempre visible).
- Decisiones del propietario: popover sin marco, atajo global, iniciar con
  Windows, cerrar = ocultar a bandeja.
- Backend (`src-tauri/src/bandeja.rs`, nuevo; `lib.rs` solo cablea):
  1. Ícono con clic izquierdo = alternar panel (anclado sobre el ícono con
     `tauri-plugin-positioner`, empujado hacia adentro si se sale del
     monitor) y clic derecho = menú Abrir / Salir.
  2. Ventana 420×640 sin marco, fuera de la barra de tareas, siempre
     arriba, oculta al arrancar. La X oculta; perder el foco oculta.
  3. Ventana de gracia de 250 ms tras el blur: sin ella, el clic en el
     ícono con el panel abierto lo cerraba (blur) y lo reabría al instante.
  4. Atajo global **Ctrl+Shift+Espacio** (`tauri-plugin-global-shortcut`).
     Ctrl+Alt+Espacio falló con ERROR_HOTKEY_ALREADY_REGISTERED (otra app
     lo tenía) y además Ctrl+Alt es AltGr en teclados en español. Si el
     registro falla, la app sigue por la bandeja y avisa por consola.
  5. Inicio con Windows (`tauri-plugin-autostart`): por defecto, solo en
     release (en dev no toca el registro). Ver "Limpieza" abajo.
- Frontend: evento `foco-captura` enfoca la captura al abrir el panel; `Esc`
  oculta; encabezado reordenado (fecha bajo el wordmark) para el ancho de
  420 px. Todo lo que usa Tauri se protege con `__TAURI_INTERNALS__` para no
  romper navegador/dev-mock.
- Dependencias nuevas: 3 crates (positioner, global-shortcut, autostart).
- Verificado: el propietario probó la app en vivo y quedó bien.

#### Limpieza (misma sesión, tras probarla)

- **Fuera el botón de encendido** (`ToggleInicio`): el ícono parecía "apagar
  la app" y no daba señal de qué hacía. Relief ahora inicia con Windows **por
  defecto**, sin interruptor: en release se registra si no lo está (así
  también sigue apuntando al .exe correcto tras reinstalar). Se fue el JS de
  `@tauri-apps/plugin-autostart` y sus permisos. Para no iniciar con
  Windows: Administrador de tareas → Inicio (Windows lo guarda aparte y no
  lo pisa este registro).
- **Fuera el botón de animaciones** (`ToggleMovimiento` + store
  `lib/movimiento.ts`). Ese botón era quien ponía `.forzar-movimiento`, así
  que se decidió: **la app siempre anima** (`MotionConfig reducedMotion=
  "never"`) y se borró el bloque CSS de `prefers-reduced-motion`.
  Consecuencia asumida: Relief ya no respeta esa preferencia del sistema.
- **Scroll sin barra visible** (`.sin-barra` en el `<main>`): se desplaza con
  rueda/touchpad/teclado. Costo: no hay pista visual de que hay más tareas
  abajo (si estorba, un desvanecido sutil al pie).
- **Desalineado tras ocultar la barra**: el `scrollbar-gutter: stable` de
  `<html>` (Sesión 19) seguía reservando ~15px a la derecha para una barra
  que ya no existe → márgenes 20px izq / 35px der y nav/captura cortadas
  antes del borde. Se quitó; medido en captura (Edge headless a 600px):
  ahora 20px a cada lado. Ojo al medir: Edge headless impone un ancho mínimo
  (~480px) y recorta la captura, así que un `--window-size=420` engaña.
- Verificado: `tsc --noEmit` y `cargo check` limpios, sin referencias
  huérfanas. El aspecto del scroll y el encabezado los juzga el propietario
  en vivo.

#### Vistas constantes (misma sesión)

- **Fila superior estándar** (`EncabezadoVista`, reemplaza a `PeriodoNav`):
  las 4 vistas arrancan con la misma fila (`h-8`), título a la izquierda y
  acciones a la derecha. Antes solo Semana/Mes la tenían; Hoy arrancaba con
  "Atrasadas" y la Papelera con la lista.
  Hoy → `hoy · 3/8 completadas` (la micro-victoria con resorte subió del
  grupo "Hoy" a la fila; sin tareas de hoy, solo `hoy`) · Semana/Mes →
  período + `‹ ›` (las flechas pasan a la derecha para que el título quede
  siempre en el mismo sitio) · Papelera → `papelera` + `Vaciar (n)`.
  "Atrasadas" es ahora un grupo más bajo la fila; el grupo "Hoy" usa
  `GrupoDia` como el resto. `esDeHoy` es la definición única compartida.
- **Barra inferior fija**: al borrar la primera tarea aparecía el botón de
  Papelera y `justify-around` pasaba de 3 a 4 columnas → Hoy/Semana/Mes se
  corrían a la izquierda. Se probaron (en la conversación) dejarla siempre
  visible o reservar el hueco; el propietario rechazó ambas: la Papelera "no
  corresponde" en esa barra. Ahora `VistaNav` solo tiene Hoy/Semana/Mes y la
  Papelera vive en el encabezado (`BotonPapelera`, junto al tema): siempre
  visible, conteo como insignia superpuesta (el botón mide lo mismo vacío o
  lleno), clic la abre y estando dentro vuelve a Hoy.
- "Vaciar" subió de `VistaPapelera` a la fila (`AccionVaciar`); la
  confirmación se acortó a `¿Borrar N para siempre? Sí · No` para que quepa
  junto al título a 420px.
- **Atrasadas ya no acumula lo completado en otros días**: el propietario
  vio en Hoy, como "atrasadas", tareas que había completado días antes. La
  regla anterior (Sesión 1: las completadas se quedan tachadas) dejaba todo
  lo vencido y completado en Hoy para siempre. Ahora una atrasada completada
  se queda tachada **solo si se completó hoy** (`completedAt`, UTC → día
  local); si se completó otro día desaparece de Hoy y sigue visible en su
  día dentro de Semana/Mes. Mantiene la "victoria" del momento sin ensuciar
  Hoy al día siguiente. Pendiente por decidir: "Sin fecha" tiene el mismo
  patrón (completadas sin fecha se acumulan) y no se tocó.
- Verificado: `tsc --noEmit` limpio; captura headless (600px) de Hoy con la
  fila, 3 íconos abajo y papelera arriba; con el caso "completada el 14 sep"
  del mock, ya no sale en Atrasadas. Semana/Mes/Papelera y el
  comportamiento al borrar los juzga el propietario en vivo.
- Pendiente: los plugins y `bandeja.rs` son solo de escritorio; para móvil
  (v2+) habrá que ponerlos detrás de `cfg(desktop)`. El instalador
  (`tauri build`) y el inicio con Windows no se probaron en release.

### Estado / siguiente paso

- ✅ 21 tests del backend, clippy limpio, refactor de testabilidad.
- ✅ Revisión de diseño aplicada: contraste AA y límites de control 3:1.
- ✅ Código muerto fuera, assets limpios e **íconos propios** (escritorio + móvil).
- ✅ Pasada orgánica (renglones, grano, trazos a mano) y **editorial profunda**
  (serif en el contenido, captura-renglón, pestañas y acciones de tinta,
  masthead compuesto, ajustes al pie).
- ✅ Catálogo de skills podado (40) con **mapa de routing** en AGENTS.md.
- ✅ Minimalismo (sin reglas de ancho completo) y navegación **horizontal**
  entre vistas según la dirección.
- ✅ Layout estable entre vistas: canal de scroll reservado (se corría 7px)
  y Semana sin días vacíos (el tamaño de la vista ya no salta).
- ⏳ **PoC de Motion a revisión del propietario**: si aprueba, extender a
  paneles y transición de vistas; Rive / rough.js / View Transitions
  quedan aplazados con su disparador (ver Sesión 20).
- ✅ **Serpiente elegida y productionizada (v1 a 0.42s)** con guard de
  reduced motion; v2 y variantes eliminadas.
- ⏭️ Pendientes para "lista para publicar": instalador
  (`npm run tauri build` → .exe/.msi), aceleradores de teclado
  (Sesión 1: Ctrl+N/Enter/Ctrl+D), README para GitHub.
- ⏭️ Calidad pendiente: ESLint/Prettier en el frontend (requiere aprobar
  dependencias de desarrollo), tests de los componentes React,
  CI en GitHub Actions (lint + tests + build).

### Sesión 23 — desde cero: rediseño D2, mascotas animadas, panel de ajustes y distribución (2026-09-19 a 2026-09-22)

Sesión larga, sin cortes registrados en la bitácora hasta ahora: todo lo de
abajo quedó en un solo commit (`0993120`), sin pasar por `docs/` en el
camino. El disparador fue el propietario sintiendo que se estaba
trabajando "sobre una mala base" y pidiendo empezar de cero — layout,
componentes y concepto visual, no solo retocar lo de las Sesiones 1–22.

#### Decisión de empezar de cero + validación de stack

- Antes de tocar diseño, el propietario preguntó si Tauri/React/SQLite
  seguía siendo el stack correcto pensando en llevar Relief a **móvil** y
  en **sincronizar notas entre PC y celular**. Se confirmó que sí (Tauri 2
  tiene target móvil), pero ambas cosas quedaron explícitamente
  **aplazadas** ("después lo vemos"): el foco de la sesión fue solo diseño.
  Turso/libSQL quedó anotado como candidato para la sync futura, sin
  empezar nada de eso.
- Se probaron 3 mockups de dirección visual (A "precisión", B "vívido", C)
  en un Artifact de tipo canvas, primero en desktop y luego repetidos en
  móvil a pedido del propietario ("no pareciera que está orientada a
  dispositivos móviles"). Veredicto: B era el más atractivo pero "poco
  serio"; A "sencillo" pero aburrido; C "muy IA" pero no feo. De ahí salió
  **D "cálido con carácter"** y su variante **D2 "cálido, acento en
  calma"** (mismo layout, acento verde salvia en vez de coral) — D2 fue la
  elegida.

#### Layout mobile-first (decisión de estructura, no solo de estilo)

- El propietario pidió que el layout **móvil sea el layout principal**, no
  una adaptación aparte: captura y navegación fijas al pie, como una app de
  chat (su comparación explícita), encabezado arriba reducido a lo mínimo.
  Esto llevó el estado de navegación (`vista`/`ancla`/`direccion`) de
  `TaskList` a `App.tsx`, porque el pie (`VistaNav`) y el contenido ya no
  son padre-hijo sino hermanos que comparten el mismo estado.
- `App.css` reescrito con los tokens D2 (`--canvas`, `--accent` salvia,
  `--prioridad-*` con tinte, dark set) y fuentes Sora/Work Sans
  (`@fontsource-variable`), reemplazando Fraunces/Inter.

#### Motion: reconstrucción completa de las transiciones de vista

- Pedido explícito: sacar **todo** el movimiento heredado de sesiones
  anteriores y empezar de cero para evitar solapamientos, y después
  "aprovechar Motion al máximo".
- Bug recurrente ("las tareas empiezan desde abajo y después suben"),
  reportado tres veces antes de quedar resuelto. Causas encadenadas:
  (a) solapamiento de *stagger* en CSS, (b) `mode="popLayout"` de
  `AnimatePresence` no aplicaba porque los componentes propios no
  reenvían `ref`, (c) el prop `layout` sumaba un `translateY` extra.
  Arreglo final: apilar las vistas en la misma celda de un grid CSS
  (`gridArea: "1 / 1"`) en vez de depender de `popLayout`. Verificado por
  medición de DOM (no por captura de pantalla, que resultó poco confiable
  para esto): 0 desviación vertical en 5 transiciones de vista.
- Resultado: `AnimatePresence custom={direccion}` con `usePresenceData`
  desliza el contenido izquierda/derecha según si se avanza o se retrocede
  en Hoy→Semana→Mes; filas de tarea, check, pestañas y paneles
  desplegables con resortes de Motion en vez de transiciones CSS sueltas.
- Lección de método: el tablero de pruebas (`dev-mock.html`, no se commitea)
  tenía una insignia de diagnóstico en la esquina que tapaba el botón
  "Hoy" durante las pruebas — parecía un bug de la app y era del arnés. Se
  quitó la insignia.

#### Mascotas: de la idea a un rig animado en capas

- Origen: el propietario vio unas referencias en `Inspiracion/` (nutria,
  oso) y quiso integrar animales con personalidad — estados vacíos, al
  completar una tarea, al completar el día — **eligiendo la mejor calidad
  posible**, no solo lo que el stack ya traía puesto.
- Pipeline decidido en conjunto: arte a tinta generado por IA (prompts
  armados a medida, con el bloque de estilo integrado) → vectorizado con
  **potrace** (gratis, sin Python disponible en la máquina: se resolvió
  con los paquetes npm `potrace` + `pngjs`) → separado en capas → animado
  con Motion, recoloreable por variables CSS.
- El propietario generó él mismo los 3 dibujos finales (nutria con taza,
  oso con gorro/bufanda/lista, gato con suéter) y los puso en
  `Inspiracion/{nutria,oso,gato}.png`.
- Vectorización (script en el scratchpad, no versionado): umbral de tinta
  por luminancia, silueta por *flood fill* desde el borde, trazo con
  `potrace`; salida a `src/lib/mascotas-datos.ts` (paths SVG + regiones de
  recorte por capa, generado, no se edita a mano).
- Rig (`src/components/Mascota.tsx`): capas cuerpo/cabeza/brazo/cola/ojos
  con `clipPath`, cada capa dibujada ~15px más adentro de su región de
  recorte (los "huecos" en `mascotas-datos.ts`) para que un giro nunca deje
  un hueco visible entre capas — este fue el fix a "el brazo y la cabeza se
  cortan del torso" que el propietario reportó. Estados: reposo (respira,
  parpadea), `celebrar` (salta con anticipación y rebote, chispas, ojos
  cerrados en arco feliz durante el salto), `dormir` (cabeza caída, ojos en
  arco cerrado, "z" subiendo), y una reacción corta (`reaccion++`) al
  completar una tarea.
- Ojos: 3 iteraciones a pedido del propietario. Primero muy chicos y sin
  vida → se agrandaron y se les puso doble brillo → "muy grandes, se ven
  falsos, muy redondos, se sienten muertos" → forma ovalada e inclinada,
  un solo brillo pequeño, más chicos que el original.
- Color de pelaje en tema oscuro: primero se invertía (cara/suéter oscuros,
  pelaje claro) y el oso se perdía contra el fondo. Se cambió a un
  **contorno claro tipo calcomanía** que se activa según la **luminancia
  real del `--canvas`** (no según el modo claro/oscuro), así un tema con
  fondo intermedio tampoco pierde el contorno.
- Paletas de pelaje: se probó una paleta distinta de 5 colores por animal,
  el propietario pidió reducirla ("tantas opciones desordena la app") y
  unificarla en **una sola paleta de 3 colores, en el mismo orden, para
  los 3 animales** — Chocolate, Grafito y un tercero que pasó por dos
  vueltas: "Canela" (`#a5733f`) se reportó como "se ve terrible, muy
  naranjo" y se reemplazó por **Piedra** (`#6b5d52`), un gris pardo neutro
  que combina con los 4 temas de color.

#### Panel de ajustes (`PanelAjustes.tsx`, botón de engranaje)

- Reemplaza al `ThemeToggle` suelto del encabezado. Reúne tema de color,
  modo claro/oscuro/auto y elección de mascota + su color de pelaje, todo
  aplicado al instante (sin botón "guardar") y persistido en
  `localStorage` (`relief-ajustes`, store `src/lib/ajustes.ts`).
- 4 temas de color, ortogonales al modo: salvia (base), terracota, tinta,
  neutro. Se probó reducir a 3 (sacando neutro) y el propietario lo pidió
  de vuelta ("quedaba muy bien") — quedaron los 4.
- El contorno de las mascotas y el atributo `data-fondo` se calculan a
  partir de la luminancia de `--canvas` ya renderizado, no de una tabla
  fija por tema, para que sigan funcionando si se agrega un tema nuevo.
- `MascotaActual.tsx` centraliza "qué mascota y qué color mostrar" (o nada,
  si se eligió "ninguna") para no repetir la lógica en cada pantalla donde
  aparece.

#### Mascotas en la app

- Estado vacío de Hoy: el gato dibujado a mano (línea suelta, cobalto) se
  reemplazó por la mascota elegida, dormida.
- `App.tsx`: nuevo estado (`cargado`, `previo`) que arma una línea base
  después de la carga inicial — completar tareas que ya estaban hechas
  al abrir la app no dispara ninguna reacción; solo lo que se completa
  después de esa línea base. Dispara `reaccion++` al completar una tarea
  de hoy, y `celebrando` (5 s) cuando las tareas de hoy quedan todas
  completas (N/N).
- La papelera vacía conserva su propio dibujo a mano (el mensaje ahí es
  distinto: "no hay nada que restaurar", no "no tenés nada que hacer").

#### Empaquetado y distribución

- Motivo: el propietario quiso instalar Relief en otra PC sin que pida
  permisos de administrador, y poder actualizarla fácil después.
- `tauri.conf.json`: `bundle.targets` pasó de `"all"` a **solo `["nsis"]`**
  (el `.msi` de Windows siempre pide admin, sin excepción) con
  `windows.nsis.installMode: "currentUser"` — instala en `%LOCALAPPDATA%`,
  sin UAC. Instalación silenciosa por terminal: `Relief_x64-setup.exe /S`.
- Repositorio público nuevo: **github.com/bjsuarezc/relief**. `gh` no
  estaba instalado (el MSI de `winget` falló por falta de permisos); se
  usó una copia portable descargada del zip de releases, autenticada con
  `gh auth login --web` (flujo de código de un solo uso, requiere que la
  persona lo apruebe a mano en el navegador — no se puede automatizar del
  lado del agente). `gh auth refresh -s workflow` (el scope que hubiera
  hecho falta para pushear workflows de GitHub Actions) falló repetido con
  "context deadline exceeded"; no se insistió más y se descartó CI
  automático por ahora — el release es manual (`gh release create`).
- Windows Defender bloqueó el instalador sin firmar en una segunda PC
  ("el archivo contiene un virus", falso positivo típico de heurística en
  NSIS sin firmar — confirmado con una instalación silenciosa exitosa en
  la PC de desarrollo antes de que apareciera el bloqueo en la otra
  máquina). Se investigó **SignPath Foundation** (firma real y gratuita
  para proyectos open source) y se descartó por ahora: exige licencia OSI
  en el repo, 2FA en GitHub, README y "política de firma" documentados,
  aprobación manual de **cada release** en su panel, y la revisión inicial
  del proyecto tarda de días a semanas — mucho más compromiso del que
  pedía el problema puntual. En su lugar: un **certificado autofirmado**
  (`New-SelfSignedCertificate`, sin costo, sin admin, sin espera), firmado
  con `signtool` (viene con el Windows SDK). Probado en la segunda PC:
  **funcionó**, instaló sin bloqueo.
- Detalle del certificado y el flujo de publicar una versión nueva
  quedaron en la memoria del proyecto (`distribucion-relief.md`), no acá,
  porque son datos operativos que cambian con cada release, no decisiones
  de diseño.
- Comando para instalar o actualizar Relief desde cualquier PC (PowerShell,
  sin admin, siempre la versión más nueva publicada):
  ```powershell
  $rel = Invoke-RestMethod "https://api.github.com/repos/bjsuarezc/relief/releases/latest"
  $asset = $rel.assets | Where-Object { $_.name -like "*setup.exe" } | Select-Object -First 1
  Invoke-WebRequest $asset.browser_download_url -OutFile "$env:TEMP\$($asset.name)"
  Start-Process "$env:TEMP\$($asset.name)" -ArgumentList "/S" -Wait
  ```

#### Verificación y sus límites (honesto)

- Todo lo de Motion y el rig de las mascotas se verificó con medición de
  DOM/`getComputedStyle` y capturas de una página de pruebas
  (`dev-mascotas.html`, no se commitea), nunca viendo el movimiento real a
  60 fps — eso lo juzgó el propietario en la ventana de Tauri.
  `tsc --noEmit` limpio en cada paso.
- La instalación silenciosa y el certificado autofirmado sí se probaron de
  punta a punta en dos PCs distintas (no solo en teoría).
- No se tocó: aceleradores de teclado, tests de componentes React,
  ESLint/Prettier, CI. `AGENTS.md` no se actualizó con los módulos nuevos
  (`lib/ajustes.ts`, `components/Mascota*.tsx`).

### Estado / siguiente paso

- ✅ Rediseño D2 completo (mobile-first, tokens, tipografía) y transiciones
  de vista reconstruidas con Motion, sin el bug de layout de antes.
- ✅ Mascotas (nutria/oso/gato) vectorizadas desde arte propio, en rig
  animado por capas, integradas en estado vacío y reacciones de Hoy.
- ✅ Panel de ajustes: 4 temas de color, modo claro/oscuro/auto, mascota y
  color de pelaje (paleta compartida de 3), todo persistido.
- ✅ Instalador NSIS sin admin, repo público y distribución por terminal
  funcionando y probada en 2 PCs (incluido el bloqueo de Defender resuelto
  con firma autofirmada).
- ⏭️ Pendiente de antes, sigue pendiente: aceleradores de teclado, tests
  de componentes, ESLint/Prettier, CI.
- ⏭️ Nuevo pendiente: README real para el repo público (sigue siendo la
  plantilla de Tauri) y `AGENTS.md` sin los módulos de ajustes/mascotas.
- ⏭️ Aplazado explícitamente por el propietario: sync entre dispositivos
  (candidato: Turso/libSQL) y build móvil.
