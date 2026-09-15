# AGENTS.md — Modo de trabajo Relief

Instrucciones para asistentes de IA (opencode u otros) que trabajen en este
proyecto. Léelas antes de cada sesión y aplícalas en todo momento.

## Skills

Las skills del agente viven a **nivel global** (`~/.config/opencode/skills/`),
no en este repo: son capacidades genéricas (diseño, motion, tipografía,
accesibilidad, testing, auditorías) que sirven a cualquier proyecto.
El repo queda solo con código del producto.

- Diseño: `frontend-design`, `design-taste-frontend`, `impeccable`, `better-ui`
- Auditoría de UI: `improve-ui`, `improve`, `improve-react`, `web-design-guidelines`, `design-review`, `interface-review`, `web-quality-audit`
- Motion: `animate`, `improve-animations`, `micro-interaction`, `transitions-dev`, `transitions-polish`, `fixing-motion-performance`
- Tipografía / a11y / copy: `better-typography`, `better-accessibility`, `better-writing`, `better-layout`, `better-colors`
- Exploración de diseño: `variant` (variantes con selector para decidir viendo)
- **Stack (Tauri / Rust / React)**: `tauri-v2`, `tauri-build`, `rust-best-practices`, `vercel-react-best-practices`
- **Frontend (CSS/rendimiento)**: `tailwind-token-consolidation`, `prefer-container-queries`, `performance`
- **Testing**: `javascript-testing-patterns`, `rust-testing`, `browser-testing-with-devtools`
- **Datos / IA v2 / docs**: `chart-visualization`, `claude-api`, `doc-coauthoring`
- Meta: `skill-creator`, `customize-opencode`, `webapp-testing`, `find-skills`

Para descubrir e instalar skills nuevas del ecosistema: `find-skills`
(consulta el leaderboard de skills.sh y luego `npx skills find <query>`).

Skills **específicas de Relief** (si se crean) sí viven en `.opencode/skills/`
de este repo. Tras agregar/quitar skills, opencode requiere reinicio.

### Cuándo usar qué (mapa de routing)

Varias skills se solapan en tema: el mapa evita cargar la equivocada.
Regla general: **una por intención**, la más específica primero.

| Intención | Skill | Por qué esa |
|---|---|---|
| Diseñar o rediseñar una superficie | `taste-skill` | La más completa (85 KB): lee el brief → sistema → directivas |
| Pulir un detalle visual puntual | `better-ui` / `frontend-design` | Alcance chico, sin re-planificar la dirección |
| Explorar variantes para decidir viendo | `variant` | Devuelve versiones con selector, no una propuesta |
| Auditar la UI con evidencia | `improve-ui` | Exige contrato + runtime + corrección única por hallazgo |
| Criticar una pantalla/URL/captura | `design-review` | Severidades + fix concreto por hallazgo |
| Revisar un cambio o diff | `interface-review` | Entrada = el cambio, no la pantalla completa |
| Auditar el repo entero (seguridad, DX, deuda) | `improve` | Es el único que cubre Rust, SQLite y seguridad |
| Auditar React | `improve-react` | Usa el scan de React Doctor como evidencia |
| Construir motion (criterio) | `animate` | Decide en orden: ¿debe animar? ¿qué curva? |
| Motion CSS puro / `@starting-style` | `micro-interaction` | Trae el camino sin librerías (nuestro stack) |
| Snippets de transición listos | `transitions-dev` | Patrones drop-in para panels/dropdowns/listas |
| Refinar motion existente | `transitions-polish` | Calibra contra la escala de tokens de movimiento |
| Auditar motion del repo | `improve-animations` | Read-only → planes priorizados |
| Motion con stutter | `fixing-motion-performance` | Layout thrashing, propiedades del compositor |
| Tipografía / color / layout / copy / a11y | `better-*` | Cinco ejes distintos, ninguno solapa |
| Desarrollo Tauri | `tauri-v2` | Capabilities, comandos, ventana |
| Empaquetar la app | `tauri-build` | Firma y artefactos de distribución |
| Rust idiomático / tests Rust | `rust-best-practices` / `rust-testing` | Calidad vs tests |
| Performance React | `vercel-react-best-practices` | Reglas de Vercel Engineering |
| Tests JS/TS / UI en navegador | `javascript-testing-patterns` / `webapp-testing` / `browser-testing-with-devtools` | Patrones vs Playwright vs inspección DevTools |
| Tokens Tailwind / container queries / perf web | `tailwind-token-consolidation` / `prefer-container-queries` / `performance` | Cada uno, su eje |
| Gráficos / docs largos / capa IA v2 | `chart-visualization` / `doc-coauthoring` / `claude-api` | Dominios de la v2 |
| Crear o descubrir skills | `skill-creator` / `find-skills` | Autoría vs búsqueda en el ecosistema |

**Nota de mantenimiento**: no borrar skills por solapamiento de descripción sin
leer el contenido — varias se diferencian en el *proceso*, no en el tema
(lección de la sesión 17: `taste-skill` parecía un subconjunto de `impeccable`
y resultó la más completa del catálogo).

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
