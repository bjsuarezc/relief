// TaskList: la lista de tareas con el conmutador de vista Hoy/Semana/Mes.
//
// Este componente reemplaza la lista provisional de App.tsx (paso 3).
// Toda la lógica de agrupación es DEL LADO DEL FRONTEND (decisión ya
// registrada: get_tasks devuelve todo y no optimizamos antes de tiempo;
// si algún día escala, los filtros migran a Rust y la UI no cambia).
//
// Cada vista responde UNA pregunta (principio "una vista, una pregunta"):
// - Hoy: "¿qué tengo que hacer hoy?" (ATRASADAS + HOY + SIN FECHA)
// - Semana: "¿qué hay cada día de esta semana?" (navegable con ‹ ›)
// - Mes: "¿qué hay en este mes?" (navegable, compacta, solo días con tareas)
//
// Las secciones ATRASADAS (sin estética de alarma, decisión de la Sesión 1)
// viven SOLO en la vista Hoy: en Semana/Mes las tareas vencidas ya aparecen
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
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Trash2, Undo2 } from "lucide-react";
import { PRIORIDADES, WeekPicker } from "./CaptureBar";
import { useTasksStore } from "../lib/store";
import type { Priority, Task, UpdateTaskInput } from "../lib/types";

type Vista = "hoy" | "semana" | "mes" | "papelera";

// Helpers de PRESENTACIÓN: convierten lo crudo de la BD (fechas ISO,
// claves en inglés) en texto/color humano. Vivían en App.tsx y se
// mudaron acá junto con la lista.
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

const COLOR_PRIORIDAD: Record<Priority, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-emerald-400",
};

// TareaLinea: una fila de tarea, INTERACTIVA y editable — pero sin cromo
// nuevo (diseño "minimalista" acordado con el propietario): los textos
// que ya se ven SON los botones.
// - Click en el TÍTULO → se convierte en input. Enter guarda, Esc cancela.
// - Click en la FECHA → abre el WeekPicker debajo de la fila (reuso del
//   de CaptureBar) para moverla a cualquier día.
// - Click en la PRIORIDAD → mini-popover con las 3 opciones.
// - "Mover a hoy" solo existe en Atrasadas (moverAHoy: decisión Sesión 1).
// El hover sube ligeramente el color del texto para insinuar que es
// clicable — insinuación, no alarma visual.
function TareaLinea({
  task,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
  moverAHoy = false,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
  moverAHoy?: boolean;
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
      <li className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
        {/* El check de completado (micro-victoria táctil). */}
        <button
          type="button"
          onClick={() => onToggle(task.id, !task.completed)}
          aria-label={task.completed ? "Desmarcar tarea" : "Completar tarea"}
          className="shrink-0 transition-transform active:scale-90"
        >
          {task.completed ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : (
            <Circle size={18} className="text-neutral-600 hover:text-neutral-400" />
          )}
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
            className="flex-1 rounded-md border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm outline-none"
          />
        ) : (
          <span
            onClick={empezarEditar}
            className={`flex-1 cursor-text hover:text-neutral-300 ${
              task.completed ? "text-neutral-600 line-through" : ""
            }`}
          >
            {task.title}
          </span>
        )}

        {/* Fecha: clicable → picker. La fecha VISIBLE es el botón. */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="shrink-0 text-neutral-500 hover:text-neutral-200"
        >
          {formatoFecha(task.dueDate)}
        </button>

        {/* Prioridad: clicable → popover con las 3 opciones. */}
        <button
          type="button"
          onClick={() => setShowPrioridad(!showPrioridad)}
          className={`shrink-0 hover:brightness-125 ${COLOR_PRIORIDAD[task.priority]}`}
        >
          {ETIQUETA_PRIORIDAD[task.priority]}
        </button>

        {/* Solo en Atrasadas (decisión Sesión 1) y solo si está pendiente. */}
        {moverAHoy && !task.completed && (
          <button
            type="button"
            onClick={() => onReschedule(task.id, format(new Date(), "yyyy-MM-dd"))}
            className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
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
          className="shrink-0 text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </li>

      {/* Paneles debajo de la fila (fuera del <li> flex, a lo ancho).
          Solo uno a la vez: abrir uno cierra el otro (menos ruido). */}
      {showPicker && (
        <div className="vista-animada mt-2">
          <WeekPicker
            selected={diaMostrado}
            onSelect={reagenda}
            onMoverSemana={setDiaMostrado}
          />
        </div>
      )}
      {showPrioridad && (
        <div className="vista-animada mt-2 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
          <span className="text-xs text-neutral-500">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => {
                onUpdate(task.id, { priority: p.valor });
                setShowPrioridad(false);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${
                task.priority === p.valor
                  ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                  : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
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

// GrupoDeDia: un encabezado de día + sus tareas. Se reutiliza en las
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
  sutil = false,
}: {
  encabezado: string;
  tareas: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
  moverAHoy?: boolean;
  sutil?: boolean;
}) {
  return (
    <section>
      <h3
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
          sutil ? "text-neutral-600" : "text-neutral-500"
        }`}
      >
        {encabezado}
      </h3>
      {tareas.length === 0 ? (
        <p className="text-sm text-neutral-700">—</p>
      ) : (
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
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// Las tres vistas. Cada una es una función pura: tasks + ancla -> JSX.
// Funciones puras = mismo input siempre produce el mismo output, sin
// efectos: fáciles de entender, probar y reordenar.

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
    return <p className="text-sm text-neutral-600">Nada por acá — captura una tarea arriba</p>;
  }

  // La progresión del día (la "micro-victoria" de la visión):
  // "Hoy · 3/8 completadas" — un dato, no un dashboard.
  const completadasHoy = deHoy.filter((t) => t.completed).length;

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
          encabezado={`Hoy · ${completadasHoy}/${deHoy.length} completadas`}
          tareas={deHoy}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onReschedule={onReschedule}
          onDelete={onDelete}
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
  onMover,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
}: {
  tasks: Task[];
  ancla: Date;
  onMover: (dias: number) => void;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, cambios: UpdateTaskInput) => void;
  onReschedule: (id: string, dueDate: string) => void;
  onDelete: (id: string) => void;
}) {
  // La semana contiene al "ancla": la fecha de navegación compartida.
  // CaptureBar y esta vista son independientes, pero ambas hablan de
  // "días" con el mismo formato — por eso se sienten coherentes.
  const inicio = startOfWeek(ancla, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Semana anterior" onClick={() => onMover(-7)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-neutral-400">
          Semana del {format(dias[0], "d MMM", { locale: es })} al{" "}
          {format(dias[6], "d MMM", { locale: es })}
        </span>
        <button type="button" aria-label="Semana siguiente" onClick={() => onMover(7)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="space-y-5">
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
            sutil={!isToday(d)}
          />
        ))}
      </div>
    </div>
  );
}

function VistaMes({
  tasks,
  ancla,
  onMover,
  onToggle,
  onUpdate,
  onReschedule,
  onDelete,
}: {
  tasks: Task[];
  ancla: Date;
  onMover: (meses: number) => void;
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
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Mes anterior" onClick={() => onMover(-1)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-neutral-400">
          {format(ancla, "MMMM yyyy", { locale: es })}
        </span>
        <button type="button" aria-label="Mes siguiente" onClick={() => onMover(1)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
          <ChevronRight size={16} />
        </button>
      </div>

      {delMes.length === 0 ? (
        <p className="text-sm text-neutral-600">Nada en este mes</p>
      ) : (
        <div className="space-y-5">
          {diasConTareas.map((d) => (
            <GrupoDia
              key={d.toISOString()}
              encabezado={isToday(d) ? `Hoy · ${format(d, "EEE d MMM", { locale: es })}` : format(d, "EEE d MMM", { locale: es })}
              tareas={delMes.filter((t) => t.dueDate && isSameDay(parseISO(t.dueDate), d))}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onReschedule={onReschedule}
              onDelete={onDelete}
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
    return <p className="text-sm text-neutral-600">La papelera está vacía</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm"
          >
            <span className="flex-1 text-neutral-400">{task.title}</span>
            {/* Cuándo entró a la papelera (el mismo formato humano). */}
            <span className="text-xs text-neutral-600">
              borrada {formatoFecha(task.deletedAt)}
            </span>
            <button
              type="button"
              onClick={() => onRestaurar(task.id)}
              className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              <Undo2 size={13} className="inline" /> Restaurar
            </button>
            <button
              type="button"
              onClick={() => onPurgar(task.id)}
              aria-label="Borrar permanentemente"
              className="shrink-0 rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:border-red-900 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      {/* Vaciar todo: dos pasos (click → confirmación inline → click). */}
      {confirmarVaciar ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">
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
            className="rounded-lg border border-neutral-800 px-3 py-1 text-sm text-neutral-400 hover:bg-neutral-800"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmarVaciar(true)}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
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
// - VistaPapelera permite restaurar, borrar una por una o vaciar todo.
export function TaskList({ tasks }: { tasks: Task[] }) {
  const [vista, setVista] = useState<Vista>("hoy");
  const [ancla, setAncla] = useState<Date>(new Date());
  // La acción del store entra por acá y baja como prop (onToggle) hasta
  // cada fila. Así las vistas siguen siendo "puras" (solo reciben datos)
  // y el único punto que sabe guardar es TaskList.
  const setTaskCompleted = useTasksStore((s) => s.setTaskCompleted);
  // Las acciones que bajan hasta cada fila: completar, corregir
  // (título/prioridad) y reagendar (fecha / "Mover a hoy").
  const setTaskDueDate = useTasksStore((s) => s.setTaskDueDate);
  const updateTask = useTasksStore((s) => s.updateTask);
  // Papelera: mandar/restaurar, borrar permanente (una o todas).
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
    <div className="w-full max-w-xl">
      {/* Conmutador tipo "segmented control": contenedor único con las
          3 pestañas. La activa va resaltada. */}
      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        {pestañas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setVista(p.id)}
            className={`flex-1 rounded-lg py-1.5 text-sm ${
              vista === p.id
                ? "bg-neutral-800 text-neutral-50"
                : "text-neutral-400 hover:text-neutral-200"
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
            className={`flex-1 rounded-lg py-1.5 text-sm ${
              vista === "papelera"
                ? "bg-neutral-800 text-neutral-50"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Trash2 size={14} className="inline" /> {enPapelera.length}
          </button>
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
            onMover={moverSemana}
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
            onMover={moverMes}
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
