# AGENTS.md — Modo de trabajo Relief

Instrucciones para asistentes de IA (opencode u otros) que trabajen en este
proyecto. Léelas antes de cada sesión y aplícalas en todo momento.

## Skills

Las skills del agente viven a **nivel global** (`~/.config/opencode/skills/`),
no en este repo: son capacidades genéricas (diseño, motion, tipografía,
accesibilidad, testing, auditorías) que sirven a cualquier proyecto.
El repo queda solo con código del producto.

- Diseño: `frontend-design`, `design-taste-frontend`, `impeccable`, `better-ui`
- Auditoría de UI: `improve-ui`, `improve`, `improve-react`, `web-design-guidelines`
- Motion: `animate`, `improve-animations`, `micro-interaction`, `transitions-dev`, `transitions-polish`, `fixing-motion-performance`
- Tipografía / a11y: `better-typography`, `better-accessibility`
- Meta: `skill-creator`, `customize-opencode`, `brand-guidelines`, `webapp-testing`, `find-skills`

Skills **específicas de Relief** (si se crean) sí viven en `.opencode/skills/`
de este repo. Tras agregar/quitar skills, opencode requiere reinicio.

## Contexto del proyecto

La visión, requerimientos, casos de uso y arquitectura viven en `docs/`.
Esas decisiones ya están tomadas y documentadas: no las contradigas ni las
re-abras sin que el propietario lo pida. Ante una duda de diseño, la fuente
de verdad es `docs/01-vision.md`.

**Al iniciar cada sesión, lee primero `docs/05-bitacora.md`**: contiene el
historial de decisiones, el estado actual y el siguiente paso acordado.
Al terminar tu sesión, actualiza la bitácora con lo realizado y el nuevo
siguiente paso (es el mecanismo de memoria entre sesiones).

## Modo de colaboración (acordado con el propietario)

Este proyecto se desarrolla con IA, pero el propietario debe poder explicar
y defender TODO el código y las decisiones. La empleabilidad del propietario
es un objetivo explícito del proyecto. Por eso:

1. **La IA escribe el código**; el propietario lo revisa, pregunta y vetoa
   antes de que una pieza quede. Nada queda en el proyecto sin que el
   propietario lo entienda.
2. **El propietario toma las decisiones** de diseño, producto y arquitectura.
   La IA presenta opciones con trade-offs y recomienda, pero no decide.
3. **Código nuevo, con contrato previo**: antes de implementar una función o
   comando nuevo, la IA y el propietario definen juntos su firma (nombre,
   parámetros, retorno) y comportamiento esperado.
4. **El propietario es el reviewer**: presenta el trabajo como si fuera un PR
   (qué cambió, por qué, dónde revisar), no como una caja negra.
5. **Explicar antes de avanzar**: si el propietario pregunta algo, se responde
   con claridad pedagógica ANTES de continuar con la tarea. Las preguntas
   nunca son una interrupción.
6. **Nada mágico**: si un bloque de código usa una librería, patrón o API
   nueva, inclúyese una explicación breve (1-3 frases) de qué es y por qué
   se usa ahí.

## Estilo de trabajo

- Idioma del proyecto: español (código, identificadores y docs; los nombres
  de variables en inglés como convención de industria).
- Commits pequeños y frecuentes, en español, convención
  `tipo: descripción` (ej. `feat: captura rápida de tareas`).
- Documentación: toda decisión nueva de diseño se refleja en `docs/`
  (requerimientos, arquitectura o un doc nuevo) — el código no es la única
  fuente de verdad.
- Verificar siempre que el proyecto compila (`npm run build` +
  `cargo build` en `src-tauri`) antes de declarar un trabajo como terminado.
- No instalar dependencias nuevas sin justificarlas con un requisito
  concreto y obtener el visto bueno del propietario.
- Alcance: construir lo que pide el MVP (docs/02-requerimientos.md). Si una
  petición crece el alcance, advertirlo y confirmar antes de implementar.
