# Requerimientos — TaskLens

## Requerimientos Funcionales (RF)

### MVP v1

- **RF-01 Captura rápida**: El usuario puede crear una tarea ingresando solo un
  título (y opcionalmente fecha y prioridad). Crear una tarea no debe requerir
  más de 3 interacciones.
- **RF-02 Fecha**: Toda tarea puede tener una fecha asociada (por defecto: hoy).
  Puede dejarse sin fecha (solo anotación).
- **RF-03 Prioridad**: Toda tarea tiene prioridad alta / media / baja
  (por defecto: media).
- **RF-04 Completar / desmarcar**: El usuario puede marcar/desmarcar una tarea
  como completada con un click. Desmarcar es una acción sin culpa (el reverso
  de la gratificación: reconocer que no se terminó y seguir). Las completadas
  quedan visibles pero de forma diferenciada (tachadas/atenuadas) como
  historial de victorias del día.
- **RF-05 Vista "Hoy"**: El usuario puede ver las tareas de hoy, con las de
  prioridad alta primero.
- **RF-06 Vista "Semana"**: El usuario puede ver las tareas de los próximos
  días para planificar por adelantado.
- **RF-07 Edición**: El usuario puede editar título, fecha y prioridad de una
  tarea ya creada.
- **RF-08a Eliminar pendientes**: El usuario puede eliminar una tarea pendiente
  (accesible desde la edición / menú contextual).
- **RF-08b Historial de completadas**: Las tareas completadas no se eliminan en
  v1; quedan como historial del día (alimenta las estadísticas de v2 y
  preserva el registro de victorias del usuario).
- **RF-15 Tareas atrasadas sin culpa**: Las tareas vencidas se agrupan en una
  sección "Atrasadas" al tope de la vista Hoy, sin estética de alarma, con dos
  acciones de redistribución:
  - **"Mover a hoy"**: un click trae la tarea a la lista de hoy.
  - **"Más opciones"**: permite mover la tarea a un día específico de la
    semana (redistribuir la carga) o quitarle la fecha.
  El mensaje es control, no retraso/culpa.
- **RF-09 Persistencia**: Las tareas sobreviven al cerrar y reabrir la app
  (almacenamiento local, sin conexión a internet).

### Fuera del MVP v1 (roadmap)

- **RF-10 (v2)** Estadísticas: completadas por día, racha, tiempo dedicado.
- **RF-11 (v2)** Resumen semanal con IA: qué hice, en qué gasté más tiempo.
- **RF-12 (v2)** Detección de patrones con IA (procrastinación, sobrecarga).
- **RF-13 (v3)** Subtareas / descomposición de tareas con IA.
- **RF-14 (v3)** Versión móvil (iOS/Android) con sincronización de datos —
  el diseño de UI debe ser responsive desde v1 para no bloquear esto.

## Requerimientos No Funcionales (RNF)

- **RNF-01 Privacidad**: Todo el contenido de tareas permanece local. En v2,
  la IA solo enviará datos a la nube con consentimiento explícito del usuario.
- **RNF-02 Performance**: Abrir la app < 1s; cada acción (crear, completar,
  mover) responde < 100ms percibidos.
- **RNF-03 Disponibilidad offline**: La app funciona sin internet por diseño
  (deriva de la arquitectura local con SQLite).
- **RNF-04 Entrada por teclado y touch (multiplataforma)**:
  - **MVP**: captura y completado por teclado como *aceleradores*
    (`Ctrl+N` → foco en captura, `Enter` guarda, `Ctrl+D` completa la
    seleccionada). Toda acción también accesible por click.
  - **v2**: navegación completa por teclado (flechas, cambio de vistas).
  - **Transversal**: toda interacción debe ser usable por touch (targets
    generosos, sin dependencias de hover) para no bloquear la versión móvil.
