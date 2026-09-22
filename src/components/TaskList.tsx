// TaskList: la lista de tareas con el conmutador de vista Hoy/Semana/Mes.
//
// Toda la lógica de agrupación es DEL LADO DEL FRONTEND (decisión ya
// registrada: get_tasks devuelve todo y no optimizamos antes de tiempo;
// si algún día escala, los filtros migran a Rust y la UI no cambia).
//
// Cada vista responde UNA pregunta (principio "una vista, una pregunta"):
// - Hoy: "¿qué tengo que hacer hoy?" (Atrasadas + Hoy + Sin fecha)
// - Semana: "¿qué hay esta semana?" (navegable con ‹ ›, solo días con tareas)
// - Mes: "¿qué hay en este mes?" (navegable, compacta, solo días con tareas)
//
// La sección Atrasadas (sin estética de alarma, decisión de la Sesión 1)
// vive SOLO en la vista Hoy: en Semana/Mes las tareas vencidas ya aparecen
// naturalmente en su día correspondiente.

import { useState } from "react";
import {
  addDays,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion, usePresenceData } from "motion/react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Trash2,
  Undo2,
} from "lucide-react";
import { PRIORIDADES, WeekPicker } from "./CaptureBar";
import { MascotaActual } from "./MascotaActual";
import { PanelDesplegable } from "./PanelDesplegable";
import { useTasksStore } from "../lib/store";
import type { Priority, Task, UpdateTaskInput } from "../lib/types";

export type Vista = "hoy" | "semana" | "mes" | "papelera";

// ¿Es una tarea con fecha de hoy? La usan VistaHoy (el grupo "Hoy") y la
// fila superior (el progreso "3/8 completadas"): una sola definición.
const esDeHoy = (t: Task) => Boolean(t.dueDate) && isToday(parseISO(t.dueDate!));

// Helper de PRESENTACIÓN: convierte la fecha ISO de la BD en texto humano.
function formatoFecha(iso: string | null): string {
  if (!iso) return "sin fecha";
  const fecha = parseISO(iso);
  return isToday(fecha) ? "hoy" : format(fecha, "EEE d MMM", { locale: es });
}

const ETIQUETA_PRIORIDAD: Record<Priority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

// Color de prioridad: cada nivel tiene su propio tono tierra + tinte de
// fondo (paleta "cálido con carácter") — de un vistazo, sin leer la
// palabra. Ninguno usa rojo/naranja/amarillo puros: la prioridad alta
// no es una alarma (principio de "Atrasadas sin culpa", RF-15).
const COLOR_PRIORIDAD: Record<Priority, string> = {
  high: "bg-prioridad-alta-tinte text-prioridad-alta",
  medium: "bg-prioridad-media-tinte text-prioridad-media",
  low: "bg-prioridad-baja-tinte text-prioridad-baja",
};

// TareaLinea: una fila de tarea, INTERACTIVA y editable — los textos que
// ya se ven SON los botones (diseño minimalista acordado con el propietario).
// - Click en el TÍTULO → se convierte en input. Enter guarda, Esc cancela.
// - Click en la FECHA → abre el WeekPicker debajo de la fila (reuso del
//   de CaptureBar) para moverla a cualquier día.
// - Click en la PRIORIDAD → mini-popover con las 3 opciones.
// - "Mover a hoy" solo existe en Atrasadas (moverAHoy: decisión Sesión 1).
function TareaLinea({
  task,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
  moverAHoy = false,
  fechaRedundante = false,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
  moverAHoy?: boolean;
  // La fecha del grupo ya dice el día (Semana/Mes/grupo Hoy): la fila no
  // la repite en reposo — pero aparece en hover, porque sigue siendo el
  // acceso al picker de cambio de fecha.
  fechaRedundante?: boolean;
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [borradorTitulo, setBorradorTitulo] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showPrioridad, setShowPrioridad] = useState(false);
  // Semana que muestra el picker: arranca en la fecha ACTUAL de la tarea.
  const [diaMostrado, setDiaMostrado] = useState<Date>(
    task.dueDate ? parseISO(task.dueDate) : new Date(),
  );

  // El input arranca con el título actual como borrador (no desde vacío).
  // Regla "un panel a la vez": empezar a editar cierra los paneles abiertos
  // de la fila (antes coexistían edición + popover = ruido doble).
  const empezarEditar = () => {
    setBorradorTitulo(task.title);
    setEditandoTitulo(true);
    setShowPrioridad(false);
    setShowPicker(false);
  };

  const guardarTitulo = () => {
    const limpio = borradorTitulo.trim();
    // Guardar solo si cambió realmente y no quedó vacío (misma regla
    // que Rust valida después — el borde doble de siempre).
    if (limpio !== "" && limpio !== task.title) {
      onUpdate(task.id, { title: limpio });
    }
    setEditandoTitulo(false);
  };

  const reagenda = (d: Date) => {
    onReschedule(task.id, format(d, "yyyy-MM-dd"));
    setShowPicker(false);
  };

  return (
    <>
      {/* motion.li: la fila participa del ciclo de presencia de la lista.
          exit = se va deslizando a la izquierda mientras se desvanece (se
          la "retira del renglón"); layout="position" = las hermanas se
          deslizan a su nuevo lugar cuando una se va — animación de
          layout real (transform), no reflow. */}
      <motion.li
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{
          opacity: { duration: 0.18, ease: "easeOut" },
          x: { duration: 0.16, ease: "easeIn" },
          layout: { type: "spring", stiffness: 500, damping: 40 },
        }}
        className={`tarea-fila group flex items-center gap-3 px-1 py-3 text-sm ${
          task.completed ? "completada" : ""
        }`}
      >
        {/* El check: círculo SVG personalizado. Es EL elemento más tocado
            de la app — resorte real de Motion en la presión y en el pop
            al completar (no una curva CSS que imita un resorte), y la
            marca se DIBUJA de verdad con pathLength (la animación nativa
            de Motion para trazos SVG), no un truco de stroke-dashoffset
            a mano. El anillo se enciende en el acento: es la recompensa,
            el único pop de color de una app que en reposo es calma. */}
        <motion.button
          type="button"
          onClick={() => onToggle(task.id, !task.completed)}
          aria-label={task.completed ? "Desmarcar tarea" : "Completar tarea"}
          animate={{ scale: task.completed ? 1 : 0.94 }}
          whileTap={{ scale: 0.78 }}
          transition={{ type: "spring", stiffness: 600, damping: 15 }}
          className="ts-check shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {/* El círculo es un TRAZO A MANO (path con vibración), no un
                <circle> perfecto: es la imperfección lo que lo hace
                sentir dibujado. */}
            <motion.path
              d="M9 1.6 C 13.2 1.4, 16.6 4.6, 16.5 8.9 C 16.4 13.1, 13.4 16.5, 9.1 16.4 C 5 16.3, 1.6 13.3, 1.7 9.1 C 1.8 4.9, 4.9 1.7, 9 1.6 Z"
              strokeWidth="1.5"
              fill="none"
              animate={{
                stroke: task.completed ? "var(--accent)" : "var(--ink-faint)",
              }}
              transition={{ duration: 0.18 }}
            />
            <motion.path
              d="M5.6 9.3 L8 11.6 L12.6 6.8"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: task.completed ? 1 : 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: task.completed ? 0.04 : 0 }}
            />
          </svg>
        </motion.button>

        {/* Título: texto normal; al click, input editable al vuelo.
            maxLength de HTML + validación Rust = doble cinturón. */}
        {editandoTitulo ? (
          <input
            autoFocus
            value={borradorTitulo}
            maxLength={200}
            onChange={(e) => setBorradorTitulo(e.target.value)}
            onBlur={guardarTitulo}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardarTitulo();
              if (e.key === "Escape") setEditandoTitulo(false);
            }}
            aria-label="Editar título"
            className="ts-editar flex-1 rounded-lg border border-accent bg-canvas px-2 py-1 text-sm text-ink outline-none"
          />
        ) : (
          <span
            onClick={empezarEditar}
            className={`titulo-tarea flex-1 cursor-text transition-colors duration-[140ms] hover:text-ink-soft ${
              task.completed ? "text-ink-faint line-through" : ""
            }`}
          >
            {task.title}
          </span>
        )}

        {/* Metadata: fecha + prioridad agrupadas (son DATOS de la tarea,
            no acciones) — grupo propio para separarlas visualmente de
            las acciones de la derecha (antes las 4 competían sueltas en
            una sola línea, sobre todo en Atrasadas). */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Fecha: clicable → picker. Si el encabezado del grupo YA dice
              el día (fechaRedundante), solo aparece al pasar el mouse —
              mismo patrón que la papelera (hover). */}
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`text-xs text-ink-soft transition-[opacity,color] duration-[140ms] hover:text-ink ${
              fechaRedundante ? "opacity-0 group-hover:opacity-100" : ""
            }`}
          >
            {formatoFecha(task.dueDate)}
          </button>

          {/* Prioridad: píldora con tinte de fondo — se lee de un vistazo,
              sin depender de leer la palabra. Clicable → popover. */}
          <button
            type="button"
            onClick={() => setShowPrioridad(!showPrioridad)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity duration-[140ms] hover:opacity-80 ${COLOR_PRIORIDAD[task.priority]}`}
          >
            {ETIQUETA_PRIORIDAD[task.priority]}
          </button>
        </div>

        {/* Acciones: agrupadas aparte, con más separación de la metadata
            (ml-2 extra sobre el gap del <li>) para que se lean como un
            grupo funcional distinto, no una cuarta columna suelta. */}
        <div className="ml-2 flex shrink-0 items-center gap-3">
          {/* Solo en Atrasadas (decisión Sesión 1) y solo si está pendiente. */}
          {moverAHoy && !task.completed && (
            <button
              type="button"
              onClick={() => onReschedule(task.id, format(new Date(), "yyyy-MM-dd"))}
              className="accion-tinta border-b border-line pb-0.5 text-xs text-ink-soft transition-colors duration-[140ms] hover:border-line-strong hover:text-ink"
            >
              Mover a hoy
            </button>
          )}

          {/* Papelera: SOLO al pasar el mouse (opacity 0 → group-hover:100,
              el "group" vive en el <li>). Mandar a papelera es reversible
              (Restaurar), por eso no pide confirmación aquí. */}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label="Mandar a la papelera"
            className="text-ink-faint opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </motion.li>

      {/* Paneles debajo de la fila (fuera del <li> flex, a lo ancho).
          Solo uno a la vez: abrir uno cierra el otro (menos ruido). */}
      <PanelDesplegable abierto={showPicker}>
        <WeekPicker
          selected={diaMostrado}
          onSelect={reagenda}
          onMoverSemana={setDiaMostrado}
        />
      </PanelDesplegable>
      <PanelDesplegable abierto={showPrioridad}>
        <div className="flex items-center gap-5">
          <span className="text-xs text-ink-faint">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => {
                onUpdate(task.id, { priority: p.valor });
                setShowPrioridad(false);
              }}
              className={`accion-tinta border-b pb-0.5 text-sm transition-colors duration-[140ms] ${
                task.priority === p.valor
                  ? "border-accent text-accent"
                  : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </PanelDesplegable>
    </>
  );
}

// GrupoDia: un encabezado de día + sus tareas. Se reutiliza en las
// vistas Semana (7 grupos) y Mes (solo los días con tareas). El flag
// moverAHoy pasa por acá: es la única diferencia de comportamiento del
// grupo Atrasadas respecto a los demás (decisión Sesión 1).
function GrupoDia({
  encabezado,
  tareas,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
  moverAHoy = false,
  fechaRedundante = false,
  sutil = false,
}: {
  encabezado: string;
  tareas: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
  moverAHoy?: boolean;
  fechaRedundante?: boolean;
  sutil?: boolean;
}) {
  // Días sin tareas: NO se muestran (decisión del propietario — ver
  // VistaSemana). Este guard es defensivo: las vistas ya filtran.
  if (tareas.length === 0) return null;
  return (
    <section>
      {/* Encabezado en la fuente display (Sora), sin mayúsculas
          espaciadas (eran "chrome de plantilla"). */}
      <h3
        className={`mb-2 font-display text-[15px] font-semibold ${
          sutil ? "text-ink-faint" : "text-ink"
        }`}
      >
        {encabezado}
      </h3>
      <ul>
        {/* AnimatePresence: cuando una tarea se manda a la papelera o se
            reubica de día, la fila NO desaparece de golpe: ejecuta su
            exit (fade + slide) y las hermanas se acomodan con
            layout="position". mode="popLayout": la que se va no retiene
            espacio mientras sale. initial={false}: la primera carga no
            re-anima (entra ya en su lugar). */}
        <AnimatePresence initial={false} mode="popLayout">
          {tareas.map((task) => (
            <TareaLinea
              key={task.id}
              task={task}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onReschedule={onReschedule}
              onDelete={onDelete}
              moverAHoy={moverAHoy}
              fechaRedundante={fechaRedundante}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

// Las vistas son funciones puras: tasks + ancla -> JSX.
// Mismo input siempre produce el mismo output, sin efectos.

function VistaHoy({
  tasks,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
}: {
  tasks: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
}) {
  const hoy = new Date();
  const inicioHoy = startOfDay(hoy);

  // Atrasadas: fecha anterior a hoy Y todavía relevante hoy. Una atrasada
  // que completás HOY se queda tachada hasta que termina el día: ocultarla
  // al instante sería esconder la victoria ("tachar → ver que avanzaste",
  // decisión del propietario). Pero una que ya se completó OTRO día no es
  // "atrasada" ni es de hoy: es historia, y sigue visible en su día dentro
  // de Semana/Mes. (Sin este corte, todo lo vencido y completado se
  // acumulaba en Hoy para siempre, marcado como atrasado.)
  // completedAt es UTC; parseISO lo pasa a hora local para comparar el día.
  // dueDate null (tareas viejas) NO es atrasada: va al grupo Sin fecha.
  const atrasadas = tasks.filter(
    (t) =>
      t.dueDate &&
      !isToday(parseISO(t.dueDate)) &&
      isBefore(parseISO(t.dueDate), inicioHoy) &&
      (!t.completed || (t.completedAt !== null && isToday(parseISO(t.completedAt)))),
  );
  const deHoy = tasks.filter(esDeHoy);
  const sinFecha = tasks.filter((t) => !t.dueDate);

  if (atrasadas.length + deHoy.length + sinFecha.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        {/* La mascota elegida en Ajustes, dormitando: "no hay nada que
            hacer, respirá". Si se eligió "ninguna", solo queda el texto. */}
        <MascotaActual estado="dormir" className="h-44 w-44" />
        <p className="etiqueta text-ink-faint">nada por acá</p>
        <p className="text-sm text-ink-soft">
          Captura una tarea arriba y empieza a tachar.
        </p>
      </div>
    );
  }

  // La progresión del día ("hoy · 3/8 completadas", la micro-victoria) ya
  // no vive acá: sube a la fila superior de la vista (EncabezadoVista),
  // igual que el período de Semana/Mes.
  return (
    <div className="space-y-6">
      {atrasadas.length > 0 && (
        <GrupoDia
          encabezado="Atrasadas"
          tareas={atrasadas}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
          moverAHoy
        />
      )}
      {deHoy.length > 0 && (
        <GrupoDia
          encabezado="Hoy"
          tareas={deHoy}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
          fechaRedundante
        />
      )}
      {sinFecha.length > 0 && (
        <GrupoDia
          encabezado="Sin fecha"
          tareas={sinFecha}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
          sutil
        />
      )}
    </div>
  );
}

function VistaSemana({
  tasks,
  ancla,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
}: {
  tasks: Task[];
  ancla: Date;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
}) {
  // La semana contiene al "ancla": la fecha de navegación compartida.
  // La navegación del período (‹ ›) NO vive acá: subió a la fila del
  // conmutador (corrección de estructura del propietario — una sola
  // fila de navegación en la app).
  const inicio = startOfWeek(ancla, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));

  // SOLO los días con tareas (decisión del propietario): una semana con
  // 4 días vacíos no es información, es una pared de encabezados vacíos
  // que además cambia el tamaño de la vista al navegar. Mismo criterio
  // que la vista Mes desde su origen.
  const diasConTareas = dias.filter((d) =>
    tasks.some((t) => t.dueDate && isSameDay(parseISO(t.dueDate), d)),
  );

  if (diasConTareas.length === 0) {
    return <p className="text-sm text-ink-faint">No hay nada esta semana</p>;
  }

  return (
    <div className="space-y-6">
      {diasConTareas.map((d) => (
        <GrupoDia
          key={d.toISOString()}
          encabezado={
            isToday(d)
              ? `Hoy · ${format(d, "EEE d MMM", { locale: es })}`
              : format(d, "EEE d MMM", { locale: es })
          }
          tareas={tasks.filter(
            (t) => t.dueDate && isSameDay(parseISO(t.dueDate), d),
          )}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
          fechaRedundante
          sutil={!isToday(d)}
        />
      ))}
    </div>
  );
}

function VistaMes({
  tasks,
  ancla,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
}: {
  tasks: Task[];
  ancla: Date;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
}) {
  // Lista compacta: SOLO los días que tienen tareas (un mes vacío
  // completo sería una pared de guiones). El orden de días sale de
  // ordenar las fechas únicas presentes.
  const inicioMes = startOfMonth(ancla);
  const finMes = endOfMonth(ancla);

  const delMes = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const f = parseISO(t.dueDate);
    return !isBefore(f, inicioMes) && !isBefore(finMes, f);
  });

  // Fechas únicas del mes, ordenadas de menor a mayor.
  // Set() guarda fechas únicas; sort las ordena por timestamp.
  const diasConTareas = [
    ...new Set(delMes.map((t) => t.dueDate as string)),
  ]
    .sort()
    .map((iso) => parseISO(iso));

  return (
    <div>
      {delMes.length === 0 ? (
        <p className="text-sm text-ink-faint">No hay nada este mes</p>
      ) : (
        <div className="space-y-6">
          {diasConTareas.map((d) => (
            <GrupoDia
              key={d.toISOString()}
              encabezado={
                isToday(d)
                  ? `Hoy · ${format(d, "EEE d MMM", { locale: es })}`
                  : format(d, "EEE d MMM", { locale: es })
              }
              tareas={delMes.filter(
                (t) => t.dueDate && isSameDay(parseISO(t.dueDate), d),
              )}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onReschedule={onReschedule}
              onDelete={onDelete}
              fechaRedundante
              sutil={!isToday(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// VistaPapelera: lo que está borrado "suave" esperando decisión.
// Tres acciones (contrato del propietario): restaurar una, borrar una
// permanente, o vaciar TODO (AccionVaciar, en la fila superior de la vista,
// con confirmación inline — es la única acción que mata varias de golpe y
// no tiene vuelta atrás).
// Borrar individual NO pide confirmación: llegar a la papelera ya fue
// un paso deliberado; el click aquí es el segundo y definitivo.
function VistaPapelera({
  tasks,
  onRestaurar,
  onPurgar,
}: {
  tasks: Task[];
  onRestaurar: (id: string) => void;
  onPurgar: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        {/* La papelera dibujada a mano, en cobalto (misma familia que la
            mascota): una sola tinta, trazo suelto. */}
        <svg
          width="120"
          height="104"
          viewBox="0 0 96 84"
          fill="none"
          aria-hidden
          className="text-accent"
        >
          <path
            d="M24 28 C 40 25.5, 60 25.5, 74 28"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M36 26 C 36.5 22.5, 40 20.5, 48 20.5 C 56 20.5, 59.5 22.5, 60 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M30 30 C 31 42, 33 60, 34.5 68 C 42 70, 58 70, 65.5 68 C 67 60, 69 42, 70 30"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M43 40 L 43.5 60" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M52 40 L 51.5 60" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="etiqueta text-ink-faint">la papelera está vacía</p>
        <p className="text-sm text-ink-soft">
          Lo que borres queda acá hasta que lo elimines para siempre.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul>
        <AnimatePresence initial={false} mode="popLayout">
          {tasks.map((task) => (
            <motion.li
              key={task.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{
                opacity: { duration: 0.18, ease: "easeOut" },
                x: { duration: 0.16, ease: "easeIn" },
                layout: { type: "spring", stiffness: 500, damping: 40 },
              }}
              className="tarea-fila flex items-center gap-3 px-1 py-3 text-sm"
            >
              <span className="flex-1 text-ink-soft">{task.title}</span>
              {/* Cuándo entró a la papelera (el mismo formato humano). */}
              <span className="text-xs text-ink-faint">
                borrada {formatoFecha(task.deletedAt)}
              </span>
              <button
                type="button"
                onClick={() => onRestaurar(task.id)}
                className="accion-tinta shrink-0 border-b border-line pb-0.5 text-xs text-ink-soft transition-colors duration-[140ms] hover:border-line-strong hover:text-ink"
              >
                <Undo2 size={13} className="inline" /> Restaurar
              </button>
              <button
                type="button"
                onClick={() => onPurgar(task.id)}
                aria-label="Borrar permanentemente"
                className="shrink-0 rounded-lg border border-line p-1.5 text-ink-soft transition-colors duration-[140ms] hover:border-red-900 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

// AccionVaciar: "vaciar todo" de la Papelera, en la fila superior de la
// vista (a la derecha del título). Dos pasos (click → confirmación inline →
// click): es la única acción que mata varias tareas de golpe y no tiene
// vuelta atrás. AnimatePresence: la confirmación entra/sale con un fade
// corto. El texto es corto a propósito: tiene que caber junto al título en
// el panel de ~420px.
function AccionVaciar({
  cantidad,
  onVaciar,
}: {
  cantidad: number;
  onVaciar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  // Sin tareas no hay nada que vaciar (y si se vacía estando en confirmación,
  // no queda una pregunta colgada).
  if (cantidad === 0) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {confirmando ? (
        <motion.div
          key="confirmar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 text-sm"
        >
          <span className="text-ink-soft">
            ¿Borrar {cantidad === 1 ? "1" : cantidad} para siempre?
          </span>
          <button
            type="button"
            onClick={() => {
              onVaciar();
              setConfirmando(false);
            }}
            className="accion-tinta border-b border-red-800 pb-0.5 font-semibold text-red-600 transition-colors duration-[140ms] hover:border-red-600 dark:text-red-400 dark:hover:border-red-400"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="accion-tinta border-b border-line pb-0.5 text-ink-soft transition-colors duration-[140ms] hover:border-line-strong hover:text-ink"
          >
            No
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="disparador"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setConfirmando(true)}
          className="accion-tinta border-b border-line pb-0.5 text-sm text-ink-soft transition-colors duration-[140ms] hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
        >
          Vaciar ({cantidad})
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// EncabezadoVista: la fila superior de TODAS las vistas, siempre en el mismo
// lugar y con la misma altura — para que la app se sienta constante al
// cambiar de pestaña (antes solo Semana/Mes tenían fila; Hoy arrancaba con
// "Atrasadas" y la Papelera con la lista).
//   · Título a la izquierda (mismo estilo y posición en todas).
//   · Acciones a la derecha: ‹ › en Semana/Mes, "Vaciar" en la Papelera.
// El conmutador de vistas vive fijo al pie (VistaNav; layout mobile-first
// elegido por el propietario: la navegación se alcanza con el pulgar).
export function EncabezadoVista({
  vista,
  ancla,
  progresoHoy,
  cantidadPapelera,
  onMoverSemana,
  onMoverMes,
  onVaciar,
}: {
  vista: Vista;
  ancla: Date;
  progresoHoy: { hechas: number; total: number };
  cantidadPapelera: number;
  onMoverSemana: (dias: number) => void;
  onMoverMes: (meses: number) => void;
  onVaciar: () => void;
}) {
  const navegable = vista === "semana" || vista === "mes";

  return (
    <div className="mb-5 flex h-8 items-center justify-between gap-3">
      <span className="etiqueta text-ink-soft">
        {vista === "hoy" && (
          <>
            hoy
            {progresoHoy.total > 0 && (
              <>
                {" · "}
                {/* La "micro-victoria" de la visión: la key = conteo, al
                    cambiar el span se re-monta y el resorte lo hace saltar
                    una vez (real spring de Motion, no un keyframe CSS). Un
                    dato, no un dashboard. */}
                <motion.span
                  key={progresoHoy.hechas}
                  initial={{ scale: 1.28 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 12 }}
                  className="tnum inline-block text-accent"
                >
                  {progresoHoy.hechas}/{progresoHoy.total}
                </motion.span>{" "}
                completadas
              </>
            )}
          </>
        )}
        {vista === "semana" &&
          `semana del ${format(startOfWeek(ancla, { weekStartsOn: 1 }), "d", { locale: es })} al ${format(addDays(startOfWeek(ancla, { weekStartsOn: 1 }), 6), "d 'de' MMM", { locale: es })}`}
        {vista === "mes" && format(ancla, "MMMM yyyy", { locale: es })}
        {vista === "papelera" && "papelera"}
      </span>

      {navegable && (
        // -mr-2: el ícono (no el botón de 32px) queda alineado al borde
        // derecho del contenido.
        <div className="-mr-2 flex items-center">
          <motion.button
            type="button"
            aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"}
            onClick={() => (vista === "semana" ? onMoverSemana(-7) : onMoverMes(-1))}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 600, damping: 20 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-[140ms] hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft size={16} />
          </motion.button>
          <motion.button
            type="button"
            aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"}
            onClick={() => (vista === "semana" ? onMoverSemana(7) : onMoverMes(1))}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 600, damping: 20 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-[140ms] hover:bg-ink/5 hover:text-ink"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>
      )}

      {vista === "papelera" && (
        <AccionVaciar cantidad={cantidadPapelera} onVaciar={onVaciar} />
      )}
    </div>
  );
}

// VistaNav: la navegación PRINCIPAL de la app — barra fija al pie,
// iconos + etiqueta, alcanzable con el pulgar (patrón mobile-first).
// Reemplaza al conmutador de pestañas de arriba (con su píldora
// serpiente, Sesión 21): ese lenguaje de subrayado-que-viaja era para
// una fila horizontal de texto, no para una barra de iconos al pie.
// Solo las 3 vistas de trabajo, siempre fijas: la Papelera NO vive acá
// (tiene su botón en el encabezado, ver BotonPapelera.tsx).
export function VistaNav({
  vista,
  onCambiarVista,
}: {
  vista: Vista;
  onCambiarVista: (v: Vista) => void;
}) {
  const items: { id: Vista; etiqueta: string; Icono: typeof ListTodo }[] = [
    { id: "hoy", etiqueta: "Hoy", Icono: ListTodo },
    { id: "semana", etiqueta: "Semana", Icono: CalendarDays },
    { id: "mes", etiqueta: "Mes", Icono: CalendarRange },
  ];

  return (
    <nav className="flex items-center justify-around border-t border-line bg-surface px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
      {items.map(({ id, etiqueta, Icono }) => (
        <motion.button
          key={id}
          type="button"
          onClick={() => onCambiarVista(id)}
          aria-current={vista === id ? "page" : undefined}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 600, damping: 20 }}
          className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10.5px] font-medium transition-colors duration-[140ms] ${
            vista === id ? "text-accent" : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          <Icono size={19} strokeWidth={vista === id ? 2.3 : 1.8} />
          {etiqueta}
        </motion.button>
      ))}
    </nav>
  );
}

// Orden de las vistas en la "línea de tiempo" de la app: compararlo entre
// la vista vieja y la nueva dice hacia qué lado viajás (avanzar = derecha,
// volver = izquierda). Lo usa App.tsx para calcular la dirección.
export const ORDEN_VISTAS: Record<Vista, number> = {
  hoy: 0,
  semana: 1,
  mes: 2,
  papelera: 3,
};

// ContenidoVista: la vista activa COMPLETA — EncabezadoVista + la lista —
// como una sola unidad animada. usePresenceData() (API de Motion) lee
// la dirección que tenía AnimatePresence cuando ESTE elemento se montó,
// así que funciona incluso para la salida: aunque la dirección global ya
// cambió, la fila que se va sigue sabiendo hacia dónde salir.
//
// EncabezadoVista vive ACÁ ADENTRO (no afuera, como en el primer intento
// de PeriodoNav): antes aparecía/desaparecía de golpe al cambiar
// Hoy↔Semana mientras el contenido de abajo ya estaba animando — un salto
// de layout ajeno a Motion que se leía como "un segundo movimiento"
// pisando al primero. Metiéndolo en el mismo bloque, los dos entran/salen
// como una sola pieza.
function ContenidoVista({
  vista,
  ancla,
  activas,
  enPapelera,
  onMoverSemana,
  onMoverMes,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
  onRestaurar,
  onPurgar,
  onVaciar,
}: {
  vista: Vista;
  ancla: Date;
  activas: Task[];
  enPapelera: Task[];
  onMoverSemana: (dias: number) => void;
  onMoverMes: (meses: number) => void;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
  onRestaurar: (id: string) => void;
  onPurgar: (id: string) => void;
  onVaciar: () => void;
}) {
  const direccion = usePresenceData() as 1 | -1;
  return (
    // gridArea 1/1: el padre es una grilla de una sola celda, así el que
    // sale y el que entra se APILAN en el mismo lugar en vez de ir uno
    // debajo del otro. Sin esto el saliente seguía en el flujo unos ms y
    // empujaba al entrante hacia abajo; al desmontarse, este "subía" —
    // el bug de "empieza abajo y luego sube". (popLayout no servía acá:
    // exige que el hijo reenvíe ref, y ContenidoVista es un componente
    // propio.) Tampoco lleva `layout`: metía un translateY de ~218px.
    <motion.div
      style={{ gridArea: "1 / 1" }}
      initial={{ opacity: 0, x: direccion * 24 }}
      animate={{
        opacity: 1,
        x: 0,
        transition: { type: "spring", stiffness: 500, damping: 42 },
      }}
      exit={{ opacity: 0, x: direccion * -24, transition: { duration: 0.15 } }}
    >
      <EncabezadoVista
        vista={vista}
        ancla={ancla}
        progresoHoy={{
          hechas: activas.filter((t) => esDeHoy(t) && t.completed).length,
          total: activas.filter(esDeHoy).length,
        }}
        cantidadPapelera={enPapelera.length}
        onMoverSemana={onMoverSemana}
        onMoverMes={onMoverMes}
        onVaciar={onVaciar}
      />
      {vista === "hoy" && (
        <VistaHoy
          tasks={activas}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
        />
      )}
      {vista === "semana" && (
        <VistaSemana
          tasks={activas}
          ancla={ancla}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
        />
      )}
      {vista === "mes" && (
        <VistaMes
          tasks={activas}
          ancla={ancla}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
        />
      )}
      {vista === "papelera" && (
        <VistaPapelera
          tasks={enPapelera}
          onRestaurar={onRestaurar}
          onPurgar={onPurgar}
        />
      )}
    </motion.div>
  );
}

// TaskList: el CONTENIDO de la vista activa — ya no dueño del estado de
// navegación (vista/ancla/dirección bajaron a App.tsx, compartidas con
// VistaNav, que ahora es hermano suyo, no hijo).
export function TaskList({
  tasks,
  vista,
  ancla,
  direccion,
  onMoverSemana,
  onMoverMes,
}: {
  tasks: Task[];
  vista: Vista;
  ancla: Date;
  direccion: 1 | -1;
  onMoverSemana: (dias: number) => void;
  onMoverMes: (meses: number) => void;
}) {
  // Las acciones del store entran por acá y bajan como props hasta
  // cada fila. Así las vistas siguen siendo "puras" (solo reciben datos).
  const setTaskCompleted = useTasksStore((s) => s.setTaskCompleted);
  const setTaskDueDate = useTasksStore((s) => s.setTaskDueDate);
  const updateTask = useTasksStore((s) => s.updateTask);
  const setTaskDeleted = useTasksStore((s) => s.setTaskDeleted);
  const purgeTask = useTasksStore((s) => s.purgeTask);
  const purgeAllTasks = useTasksStore((s) => s.purgeAllTasks);

  // Dos listas derivadas: activas (las 3 vistas) y papelera.
  const activas = tasks.filter((t) => t.deletedAt === null);
  const enPapelera = tasks.filter((t) => t.deletedAt !== null);

  return (
    <div className="grid overflow-x-clip">
      <AnimatePresence custom={direccion} initial={false}>
        <ContenidoVista
          key={vista}
          vista={vista}
          ancla={ancla}
          activas={activas}
          enPapelera={enPapelera}
          onMoverSemana={onMoverSemana}
          onMoverMes={onMoverMes}
          onToggle={setTaskCompleted}
          onUpdate={updateTask}
          onReschedule={setTaskDueDate}
          onDelete={(id) => setTaskDeleted(id, true)}
          onRestaurar={(id) => setTaskDeleted(id, false)}
          onPurgar={purgeTask}
          onVaciar={purgeAllTasks}
        />
      </AnimatePresence>
    </div>
  );
}
