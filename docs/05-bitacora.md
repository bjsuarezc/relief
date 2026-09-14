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

### Estado / siguiente paso

- ✅ Motion auditado y corregido (HIGH+MED); verificado con captura propia.
- ⏭️ Para "lista para publicar": instalador (`npm run tauri build` → .exe/.msi),
  aceleradores de teclado (Sesión 1: Ctrl+N/Enter/Ctrl+D), README para GitHub,
  ícono/branding propio de la app.
