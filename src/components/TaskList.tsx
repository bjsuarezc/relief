// TaskList: la lista de tareas con el conmutador de vista Hoy/Semana/Mes.
//
// Toda la lógica de agrupación es DEL LADO DEL FRONTEND (decisión ya
// registrada: get_tasks devuelve todo y no optimizamos antes de tiempo;
// si algún día escala, los filtros migran a Rust y la UI no cambia).
//
// Cada vista responde UNA pregunta (principio "una vista, una pregunta"):
// - Hoy: "¿qué tengo que hacer hoy?" (Atrasadas + Hoy + Sin fecha)
// - Semana: "¿qué hay cada día de esta semana?" (navegable con ‹ ›)
// - Mes: "¿qué hay en este mes?" (navegable, compacta, solo días con tareas)
//
// La sección Atrasadas (sin estética de alarma, decisión de la Sesión 1)
// vive SOLO en la vista Hoy: en Semana/Mes las tareas vencidas ya aparecen
// naturalmente en su día correspondiente.

import { useState } from "react";
import {
  addDays,
  addMonths,
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
import { ChevronLeft, ChevronRight, CircleDot, Trash2, Undo2 } from "lucide-react";
import { PRIORIDADES, WeekPicker } from "./CaptureBar";
import { useTasksStore } from "../lib/store";
import type { Priority, Task, UpdateTaskInput } from "../lib/types";

type Vista = "hoy" | "semana" | "mes" | "papelera";

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

// Color de prioridad (decisión del propietario tras ver la captura):
// la prioridad es METADATO, no protagonista — y "Media" es el DEFAULT,
// por eso no lleva color (el estado por defecto no colorea nada).
// Solo "Alta" tiene color; Media/Baja van neutras.
const COLOR_PRIORIDAD: Record<Priority, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-ink-soft",
  low: "text-ink-soft",
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
  const empezarEditar = () => {
    setBorradorTitulo(task.title);
    setEditandoTitulo(true);
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
      <li
        className={`tarea-fila group elevada flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm ${
          task.completed ? "completada" : ""
        }`}
      >
        {/* El check: círculo SVG personalizado. Al completar, el borde se
            enciende en acento y la marca se DIBUJA (stroke-dashoffset),
            no solo aparece. El píxel exacto donde pasa la victoria. */}
        <button
          type="button"
          onClick={() => onToggle(task.id, !task.completed)}
          aria-label={task.completed ? "Desmarcar tarea" : "Completar tarea"}
          className={`ts-check shrink-0 ${task.completed ? "completed" : ""}`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle
              cx="9"
              cy="9"
              r="7.5"
              strokeWidth="1.5"
              fill="none"
              className="ch-ring"
            />
            <path
              d="M5.6 9.3 L8 11.6 L12.6 6.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ch-mark"
            />
          </svg>
        </button>

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
            className="flex-1 rounded-md border border-accent bg-canvas px-2 py-1 text-sm text-ink outline-none"
          />
        ) : (
          <span
            onClick={empezarEditar}
            className={`flex-1 cursor-text transition-colors duration-150 hover:text-ink-soft ${
              task.completed ? "text-ink-faint line-through" : ""
            }`}
          >
            {task.title}
          </span>
        )}

        {/* Fecha: clicable → picker. Si el encabezado del grupo YA dice
            el día (fechaRedundante), solo aparece al pasar el mouse —
            mismo patrón que la papelera (hover). */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className={`shrink-0 transition-[opacity,color] duration-150 hover:text-ink ${
            fechaRedundante
              ? "text-ink-soft opacity-0 group-hover:opacity-100"
              : "text-ink-soft"
          }`}
        >
          {formatoFecha(task.dueDate)}
        </button>

        {/* Prioridad: clicable → popover con las 3 opciones. */}
        <button
          type="button"
          onClick={() => setShowPrioridad(!showPrioridad)}
          className={`shrink-0 transition-colors duration-150 hover:text-ink-soft ${COLOR_PRIORIDAD[task.priority]}`}
        >
          {ETIQUETA_PRIORIDAD[task.priority]}
        </button>

        {/* Solo en Atrasadas (decisión Sesión 1) y solo si está pendiente. */}
        {moverAHoy && !task.completed && (
          <button
            type="button"
            onClick={() => onReschedule(task.id, format(new Date(), "yyyy-MM-dd"))}
            className="shrink-0 rounded-lg border border-line-strong px-2 py-1 text-xs text-ink transition-colors duration-150 hover:bg-ink/5 active:scale-[0.96]"
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
          className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
        >
          <Trash2 size={15} />
        </button>
      </li>

      {/* Paneles debajo de la fila (fuera del <li> flex, a lo ancho).
          Solo uno a la vez: abrir uno cierra el otro (menos ruido).
          Caen desde arriba (panel-animada) — dirección de desplegable. */}
      {showPicker && (
        <div className="panel-animada mt-2">
          <WeekPicker
            selected={diaMostrado}
            onSelect={reagenda}
            onMoverSemana={setDiaMostrado}
          />
        </div>
      )}
      {showPrioridad && (
        <div className="panel-animada mt-2 elevada flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <span className="text-xs text-ink-faint">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => {
                onUpdate(task.id, { priority: p.valor });
                setShowPrioridad(false);
              }}
              className={`flex h-8 items-center rounded-full border px-3 text-sm transition-[background-color,color,scale] duration-150 active:scale-[0.96] ${
                task.priority === p.valor
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-soft hover:bg-ink/5"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}
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
  return (
    <section>
      {/* Encabezado en sentence case (corrección del propietario: las
          mayúsculas espaciadas eran "chrome de plantilla"). Peso 600 y
          color según el grupo — sin transformación tipográfica. */}
      <h3
        className={`mb-2 text-[13px] font-semibold ${
          sutil ? "text-ink-faint" : "text-ink-soft"
        }`}
      >
        {encabezado}
      </h3>
      {/* Días sin tareas: la etiqueta del día ya dice "está vacío".
          No poner nada es la respuesta, no un guión. */}
      {tareas.length > 0 && (
        <ul className="space-y-2">
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
        </ul>
      )}
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

  // Atrasadas: fecha anterior a hoy. Las COMPLETADAS SE QUEDAN (tachadas):
  // ocultarlas sería esconder la victoria — la filosofía del proyecto es
  // "tachar → ver que avanzaste" (decisión del propietario al probar:
  // una atrasada completada no debe desaparecer).
  // dueDate null (tareas viejas) NO es atrasada: va al grupo Sin fecha.
  const atrasadas = tasks.filter(
    (t) =>
      t.dueDate &&
      !isToday(parseISO(t.dueDate)) &&
      isBefore(parseISO(t.dueDate), inicioHoy),
  );
  const deHoy = tasks.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
  const sinFecha = tasks.filter((t) => !t.dueDate);

  if (atrasadas.length + deHoy.length + sinFecha.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <span className="punto-respirando text-accent">
          <CircleDot size={28} strokeWidth={1.5} />
        </span>
        <p className="text-sm text-ink-soft">Nada por acá — captura una tarea arriba</p>
        <p className="text-xs text-ink-faint">Escribe y presiona Enter: se guarda al instante.</p>
      </div>
    );
  }

  // La progresión del día (la "micro-victoria" de la visión):
  // "Hoy · 3/8 completadas" — un dato, no un dashboard.
  const completadasHoy = deHoy.filter((t) => t.completed).length;

  return (
    <div className="entrada-cascada space-y-6">
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
        <section>
          {/* El encabezado de Hoy es especial (progreso del día): se
              renderiza a mano para poner el conteo en color de acento —
              el único dato "vivo" de la vista. El resto usa GrupoDia. */}
          <h3 className="mb-2 flex items-baseline gap-1.5 text-[13px] font-medium text-ink-soft">
            Hoy
            <span className="tnum text-accent">
              {completadasHoy}/{deHoy.length}
            </span>
            completadas
          </h3>
          <ul className="space-y-2">
            {deHoy.map((task) => (
              <TareaLinea
                key={task.id}
                task={task}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onReschedule={onReschedule}
                onDelete={onDelete}
                fechaRedundante
              />
            ))}
          </ul>
        </section>
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

  return (
    <div className="entrada-cascada space-y-5">
      {dias.map((d) => (
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
        <p className="text-sm text-ink-faint">Nada en este mes</p>
      ) : (
        <div className="entrada-cascada space-y-5">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// VistaPapelera: lo que está borrado "suave" esperando decisión.
// Tres acciones (contrato del propietario): restaurar una, borrar una
// permanente, o vaciar TODO con un botón (con confirmación inline — es
// la única acción que mata varias de golpe y no tiene vuelta atrás).
// Borrar individual NO pide confirmación: llegar a la papelera ya fue
// un paso deliberado; el click aquí es el segundo y definitivo.
function VistaPapelera({
  tasks,
  onRestaurar,
  onPurgar,
  onVaciar,
}: {
  tasks: Task[];
  onRestaurar: (id: string) => void;
  onPurgar: (id: string) => void;
  onVaciar: () => void;
}) {
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  if (tasks.length === 0) {
    return <p className="text-sm text-ink-faint">La papelera está vacía</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="tarea-fila elevada flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm"
          >
            <span className="flex-1 text-ink-soft">{task.title}</span>
            {/* Cuándo entró a la papelera (el mismo formato humano). */}
            <span className="text-xs text-ink-faint">
              borrada {formatoFecha(task.deletedAt)}
            </span>
            <button
              type="button"
              onClick={() => onRestaurar(task.id)}
              className="shrink-0 rounded-lg border border-line-strong px-2 py-1 text-xs text-ink transition-colors duration-150 hover:bg-ink/5 active:scale-[0.96]"
            >
              <Undo2 size={13} className="inline" /> Restaurar
            </button>
            <button
              type="button"
              onClick={() => onPurgar(task.id)}
              aria-label="Borrar permanentemente"
              className="shrink-0 rounded-lg border border-line p-1.5 text-ink-soft transition-colors duration-150 hover:border-red-900 hover:text-red-500 active:scale-[0.96]"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      {/* Vaciar todo: dos pasos (click → confirmación inline → click). */}
      {confirmarVaciar ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-soft">
            ¿Vaciar la papelera? ({tasks.length} tarea(s) se borrarán para siempre)
          </span>
          <button
            type="button"
            onClick={() => {
              onVaciar();
              setConfirmarVaciar(false);
            }}
            className="rounded-lg border border-red-900 bg-red-950 px-3 py-1 text-sm text-red-300 hover:bg-red-900"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setConfirmarVaciar(false)}
            className="rounded-lg border border-line px-3 py-1 text-sm text-ink-soft transition-colors duration-150 hover:bg-ink/5 active:scale-[0.96]"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmarVaciar(true)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.96]"
        >
          Vaciar papelera ({tasks.length})
        </button>
      )}
    </div>
  );
}

// El conmutador: las pestañas + el "ancla" de navegación compartida.
// El ancla es UNA fecha: la semana la interpreta como "semana de esta
// fecha" y el mes como "mes de esta fecha". Al cambiar de vista se
// conserva — te mueves sin perder donde estabas.
//
// La pestaña Papelera (decisión del propietario en el paso 7):
// - SOLO se muestra si hay algo en la papelera (cero ruido si está vacía).
export function TaskList({ tasks }: { tasks: Task[] }) {
  const [vista, setVista] = useState<Vista>("hoy");
  const [ancla, setAncla] = useState<Date>(new Date());
  // Las acciones del store entran por acá y bajan como props hasta
  // cada fila. Así las vistas siguen siendo "puras" (solo reciben datos)
  // y el único punto que sabe guardar es TaskList.
  const setTaskCompleted = useTasksStore((s) => s.setTaskCompleted);
  const setTaskDueDate = useTasksStore((s) => s.setTaskDueDate);
  const updateTask = useTasksStore((s) => s.updateTask);
  const setTaskDeleted = useTasksStore((s) => s.setTaskDeleted);
  const purgeTask = useTasksStore((s) => s.purgeTask);
  const purgeAllTasks = useTasksStore((s) => s.purgeAllTasks);

  // Dos listas derivadas: activas (las 3 vistas) y papelera.
  // El filtro vive AQUÍ, una sola vez: las vistas no saben que existe
  // deletedAt — siguen recibiendo solo tareas activas, sin cambios.
  const activas = tasks.filter((t) => t.deletedAt === null);
  const enPapelera = tasks.filter((t) => t.deletedAt !== null);

  const moverSemana = (dias: number) => setAncla(addDays(ancla, dias));
  const moverMes = (meses: number) => setAncla(addMonths(ancla, meses));

  const pestañas: { id: Vista; etiqueta: string }[] = [
    { id: "hoy", etiqueta: "Hoy" },
    { id: "semana", etiqueta: "Semana" },
    { id: "mes", etiqueta: "Mes" },
  ];

  return (
    <div className="w-full max-w-2xl">
      {/* UNA sola fila de navegación (corrección de estructura del
          propietario: las dos barras pegadas leían como una sola familia):
          conmutador fit-content a la izquierda + nav del período a la
          derecha. El ancho libre del medio respira. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 elevada rounded-xl border border-line bg-surface p-1">
          {pestañas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setVista(p.id)}
              className={`flex h-8 items-center justify-center rounded-lg px-3 text-sm transition-colors duration-150 ${
                vista === p.id
                  ? "bg-accent-soft text-ink"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}

          {/* La pestaña Papelera: con contador, y SOLO si hay algo que
              purgar. Si la papelera está vacía, no existe en la UI. */}
          {enPapelera.length > 0 && (
            <button
              type="button"
              onClick={() => setVista("papelera")}
              className={`flex h-8 items-center justify-center rounded-lg px-3 text-sm transition-colors duration-150 ${
                vista === "papelera"
                  ? "bg-accent-soft text-ink"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <Trash2 size={14} className="inline" /> {enPapelera.length}
            </button>
          )}
        </div>

        {/* Nav del período: solo existe en Semana/Mes (en Hoy no hay
            nada que navegar — la vista es fija). Flechas + etiqueta. */}
        {(vista === "semana" || vista === "mes") && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"}
              onClick={() => (vista === "semana" ? moverSemana(-7) : moverMes(-1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-ink-soft">
              {vista === "semana"
                ? `Semana del ${format(startOfWeek(ancla, { weekStartsOn: 1 }), "d MMM", { locale: es })} al ${format(addDays(startOfWeek(ancla, { weekStartsOn: 1 }), 6), "d 'de' MMM", { locale: es })}`
                : format(ancla, "MMMM yyyy", { locale: es })}
            </span>
            <button
              type="button"
              aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"}
              onClick={() => (vista === "semana" ? moverSemana(7) : moverMes(1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Transición smooth (pedida por el propietario): la "key" cambia con
          cada vista/ancla → React re-monta este <div> → la animación CSS
          .vista-animada se dispara otra vez. Cambiar key = animación. */}
      <div key={`${vista}-${ancla.toISOString()}`} className="vista-animada mt-6">
        {vista === "hoy" && (
          <VistaHoy
            tasks={activas}
            onToggle={setTaskCompleted}
            onUpdate={updateTask}
            onReschedule={setTaskDueDate}
            onDelete={(id) => setTaskDeleted(id, true)}
          />
        )}
        {vista === "semana" && (
          <VistaSemana
            tasks={activas}
            ancla={ancla}
            onToggle={setTaskCompleted}
            onUpdate={updateTask}
            onReschedule={setTaskDueDate}
            onDelete={(id) => setTaskDeleted(id, true)}
          />
        )}
        {vista === "mes" && (
          <VistaMes
            tasks={activas}
            ancla={ancla}
            onToggle={setTaskCompleted}
            onUpdate={updateTask}
            onReschedule={setTaskDueDate}
            onDelete={(id) => setTaskDeleted(id, true)}
          />
        )}
        {vista === "papelera" && (
          <VistaPapelera
            tasks={enPapelera}
            onRestaurar={(id) => setTaskDeleted(id, false)}
            onPurgar={purgeTask}
            onVaciar={purgeAllTasks}
          />
        )}
      </div>
    </div>
  );
}
