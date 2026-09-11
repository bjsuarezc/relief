# Visión del producto — Relief

> Nombre anterior: TaskLens. Renombrado el 2026-09-11 a **Relief** —
> el nombre es el sentimiento del final del loop: el alivio (relief)
> de tachar. Ver bitácora, Sesión 2.

## El problema

Cuando acumulamos muchas tareas en el día (o en la semana) nos sentimos abrumados.
La carga mental no está solo en hacer las tareas, sino en **recordarlas y priorizarlas**.

Las herramientas existentes (Todoist, Notion, Google Tasks) resuelven la gestión, pero
están tan llenas de features (proyectos, etiquetas, colaboradores, integraciones) que
el loop básico se pierde: **anotar una tarea, tacharla, sentir alivio**.

## La propuesta de valor

Relief devuelve el loop emocional a la gestión de tareas:

- **Capturar rápido**: anotar la tarea en segundos, sin formularios ni fricción.
- **Ver una por una**: una lista enfocada, no un tablero gigante.
- **Tachar con gratificación**: cada tarea completada es una micro-victoria visible
  (check claro, progresión del día, sensación de avance).

> El diferenciador a futuro: una capa de IA que analiza cómo gastamos nuestro tiempo
> (resúmenes semanales, patrones de procrastinación) — pero **nunca a costa de
> complicar el loop básico**.

## Usuario objetivo

Cualquier persona con tareas que hacer, tanto en el computador como en su día a día.
No es una herramienta de equipos ni de empresas: es una herramienta **personal**.

## Plataformas

- **v1 (MVP): Escritorio** (Windows — macOS/Linux son casi gratuitos con Tauri).
- **v2+: Móvil** (iOS/Android): Tauri 2 compila para móvil con la misma base de
  código. Implicación clave: el frontend se diseña **responsive desde el día
  uno** y la lógica de datos se mantiene en una capa agnóstica a la plataforma.

## MVP (definición mínima de "útil")

La app es útil cuando puedo:

1. **Ingresar tareas por adelantado** para preparar la semana.
2. **Ingresar tareas el mismo día** (captura rápida).
3. **Tachar tareas como completadas** y ver mi progreso.
4. **Asignar prioridad** (alta / media / baja): ver que no todas mis tareas
   son urgentes calma la ansiedad y me indica por cuál empezar.

La prioridad no es "otro feature de gestor de tareas": sirve directamente a la
propuesta de valor — convertir una lista gigante en un plan claro de ataque.

Todo lo demás (categorías, IA, estadísticas) se construye *después*
de que este MVP funciona y lo uso yo mismo a diario.

## Principios de diseño

1. **Fricción cero para capturar**: si crear una tarea toma más de 5 segundos, fallamos.
2. **Una vista, una pregunta**: "¿qué tengo que hacer hoy?"
3. **La gratificación es un requisito funcional**, no un detalle de UX.
