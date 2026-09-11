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
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { WeekPicker } from "./CaptureBar";
import { useTasksStore } from "../lib/store";
import type { Priority, Task } from "../lib/types";

type Vista = "hoy" | "semana" | "mes";

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

// TareaLinea: una fila de tarea. Ahora es INTERACTIVA: el check a la
// izquierda tacha/desmarca (toggle). Al completar: tachado + atenuado.
// La tarea SE QUEDA en su grupo (decisión: las completadas son el muro
// de victorias, nunca desaparecen de la vista donde las lograste).
// onToggle viene inyectado desde TaskList (que lo toma del store) —
// la fila es presentacional y no sabe cómo se guarda el cambio.
function TareaLinea({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
      {/* El check: círculo vacío (lucide Circle) que se vuelve verde con
          marca (CheckCircle2) al completar. active:scale-90 da el
          "pop" táctil de la micro-victoria (transición CSS, sin librerías). */}
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

      <span
        className={`flex-1 ${
          task.completed ? "text-neutral-600 line-through" : ""
        }`}
      >
        {task.title}
      </span>
      <span className="text-neutral-500">
        {formatoFecha(task.dueDate)} ·{" "}
        <span className={COLOR_PRIORIDAD[task.priority]}>
          {ETIQUETA_PRIORIDAD[task.priority]}
        </span>
      </span>
    </li>
  );
}

// AtrasadaLinea: una fila de la sección Atrasadas. Además del check
// (tachar la victoria ya hecha), ofrece las dos ACCIONES DE REORGANIZACIÓN
// decididas en la Sesión 1:
// - "Mover a hoy": un click, se reagenda al día de hoy (usa el mismo
//   motor set_task_due_date con la fecha de hoy).
// - "Más opciones": abre el WeekPicker (reutilizado de CaptureBar) para
//   elegir cualquier día. Al elegir, se reagenda y el picker se cierra.
// El picker arranca en la semana de la fecha ACTUAL de la tarea (su día
// sale resaltado — sabes desde dónde la estás moviendo).
function AtrasadaLinea({
  task,
  onToggle,
  onReschedule,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onReschedule: (id: string, dueDate: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  // La semana que se está viendo en el picker. Estado LOCAL de esta fila:
  // si cada atrasada compartiera un picker global, se chocarían.
  const [diaMostrado, setDiaMostrado] = useState<Date>(
    task.dueDate ? parseISO(task.dueDate) : new Date(),
  );

  const reagenda = (d: Date) => {
    onReschedule(task.id, format(d, "yyyy-MM-dd"));
    setShowPicker(false);
  };

  return (
    <>
      <li className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
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

        <span className={task.completed ? "flex-1 text-neutral-600 line-through" : "flex-1"}>
          {task.title}
        </span>
        <span className="text-neutral-500">
          {formatoFecha(task.dueDate)} ·{" "}
          <span className={COLOR_PRIORIDAD[task.priority]}>
            {ETIQUETA_PRIORIDAD[task.priority]}
          </span>
        </span>

        {/* Acciones solo si está pendiente: una atrasada ya completada no
            necesita reorganizarse (ya está resuelta). */}
        {!task.completed && (
          <>
            <button
              type="button"
              onClick={() => reagenda(new Date())}
              className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              Mover a hoy
            </button>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              aria-expanded={showPicker}
              className="shrink-0 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <CalendarClock size={14} className="inline" /> Más opciones
            </button>
          </>
        )}
      </li>

      {/* El picker va FUERA del <li> (un picker dentro de una fila flex
          quedaría apretado): se abre debajo de la fila, a lo ancho. */}
      {showPicker && (
        <div className="vista-animada mt-2">
          <WeekPicker
            selected={diaMostrado}
            onSelect={reagenda}
            onMoverSemana={setDiaMostrado}
          />
        </div>
      )}
    </>
  );
}

// GrupoDeDia: un encabezado de día + sus tareas. Se reutiliza en las
// vistas Semana (7 grupos) y Mes (solo los días con tareas). onToggle
// se transmite hasta cada fila. La variante "atrasada" usa AtrasadaLinea
// (filas con acciones de reorganización).
function GrupoDia({
  encabezado,
  tareas,
  onToggle,
  onReschedule,
  sutil = false,
}: {
  encabezado: string;
  tareas: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onReschedule?: (id: string, dueDate: string) => void;
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
          {tareas.map((task) =>
            onReschedule ? (
              <AtrasadaLinea key={task.id} task={task} onToggle={onToggle} onReschedule={onReschedule} />
            ) : (
              <TareaLinea key={task.id} task={task} onToggle={onToggle} />
            ),
          )}
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
  onReschedule,
}: {
  tasks: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onReschedule: (id: string, dueDate: string) => void;
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
          onReschedule={onReschedule}
        />
      )}
      {deHoy.length > 0 && (
        <GrupoDia
          encabezado={`Hoy · ${completadasHoy}/${deHoy.length} completadas`}
          tareas={deHoy}
          onToggle={onToggle}
        />
      )}
      {sinFecha.length > 0 && (
        <GrupoDia encabezado="Sin fecha" tareas={sinFecha} onToggle={onToggle} sutil />
      )}
    </div>
  );
}

function VistaSemana({
  tasks,
  ancla,
  onMover,
  onToggle,
}: {
  tasks: Task[];
  ancla: Date;
  onMover: (dias: number) => void;
  onToggle: (id: string, completed: boolean) => void;
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
}: {
  tasks: Task[];
  ancla: Date;
  onMover: (meses: number) => void;
  onToggle: (id: string, completed: boolean) => void;
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// El conmutador: las 3 pestañas + el "ancla" de navegación compartida.
// El ancla es UNA fecha: la semana la interpreta como "semana de esta
// fecha" y el mes como "mes de esta fecha". Al cambiar de vista se
// conserva — te mueves sin perder donde estabas.
export function TaskList({ tasks }: { tasks: Task[] }) {
  const [vista, setVista] = useState<Vista>("hoy");
  const [ancla, setAncla] = useState<Date>(new Date());
  // La acción del store entra por acá y baja como prop (onToggle) hasta
  // cada fila. Así las vistas siguen siendo "puras" (solo reciben datos)
  // y el único punto que sabe guardar es TaskList.
  const setTaskCompleted = useTasksStore((s) => s.setTaskCompleted);
  // La acción de reorganización: solo la usa la vista Hoy (Atrasadas).
  const setTaskDueDate = useTasksStore((s) => s.setTaskDueDate);

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
      </div>

      {/* Transición smooth (pedida por el propietario): la "key" cambia con
          cada vista/ancla → React re-monta este <div> → la animación CSS
          .vista-animada se dispara otra vez. Cambiar key = animación. */}
      <div key={`${vista}-${ancla.toISOString()}`} className="vista-animada mt-6">
        {vista === "hoy" && (
          <VistaHoy tasks={tasks} onToggle={setTaskCompleted} onReschedule={setTaskDueDate} />
        )}
        {vista === "semana" && (
          <VistaSemana tasks={tasks} ancla={ancla} onMover={moverSemana} onToggle={setTaskCompleted} />
        )}
        {vista === "mes" && (
          <VistaMes tasks={tasks} ancla={ancla} onMover={moverMes} onToggle={setTaskCompleted} />
        )}
      </div>
    </div>
  );
}
