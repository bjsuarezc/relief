// CaptureBar: la barra de captura rápida — el corazón del MVP.
// Estilo editorial: trazo de tinta, radios moderados, cobalto para la
// acción principal. Un solo panel abierto a la vez.

import { useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Flag, Plus } from "lucide-react";
import { useTasksStore } from "../lib/store";
import { usePresencia } from "../lib/usePresencia";
import type { CreateTaskInput, Priority } from "../lib/types";

// Prioridades: una sola fuente de etiquetas en la UI (la reutiliza TaskList).
export const PRIORIDADES: { valor: Priority; etiqueta: string }[] = [
  { valor: "high", etiqueta: "Alta" },
  { valor: "medium", etiqueta: "Media" },
  { valor: "low", etiqueta: "Baja" },
];

export function CaptureBar() {
  const createTask = useTasksStore((s) => s.createTask);
  const [title, setTitle] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Destino activo: la fecha elegida si hay chip; si no, hoy.
  const [captureDate, setCaptureDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [showPriority, setShowPriority] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const capturandoHoy = isSameDay(captureDate, today);

  // Presencia de los paneles: el cierre también se anima (usePresencia).
  const panelFecha = usePresencia(showDatePicker);
  const panelPrioridad = usePresencia(showPriority);

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed === "") {
      setCaptureError("Escribe una tarea antes de crearla");
      inputRef.current?.focus();
      return;
    }

    const tasksBefore = useTasksStore.getState().tasks.length;

    const pedido: CreateTaskInput = {
      title: trimmed,
      dueDate: format(captureDate, "yyyy-MM-dd"),
    };
    if (priority) pedido.priority = priority;
    await createTask(pedido);

    const created = useTasksStore.getState().tasks.length > tasksBefore;
    if (created) {
      setTitle("");
      setCaptureError(null);
    }
    inputRef.current?.focus();
  };

  return (
    // <form onSubmit>: Enter dispara la creación nativamente.
    <div className="w-full">
      {/* La captura es un RENGLÓN de papel, no una caja: una línea de tinta
          abajo, el texto escrito encima y el botón como el punto azul del
          wordmark. El foco marca la línea en azul. */}
      <div className="capture-focus border-b-2 border-line-input transition-colors duration-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex h-14 items-center gap-3"
        >
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Qué tienes que hacer?"
            autoFocus
            className="entrada-papel h-full flex-1 bg-transparent outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-normal placeholder:text-ink-faint"
          />
          <button
            type="submit"
            aria-label="Crear tarea"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink hover:opacity-90"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </form>
      </div>

      {/* Acciones de tinta: texto subrayado (no píldoras). Es el lenguaje
          del papel — se leen como anotaciones al pie del renglón. */}
      <div className="mt-4 flex items-center gap-6">
        <button
          type="button"
          onClick={() => {
            const abrir = !showDatePicker;
            setShowDatePicker(abrir);
            if (abrir) setShowPriority(false);
            if (showDatePicker) setCaptureDate(today);
          }}
          title={
            capturandoHoy
              ? "Capturar para hoy — abre el picker de semana"
              : `Capturando para ${format(captureDate, "EEE d MMM", { locale: es })}`
          }
          className={`accion-tinta relative inline-flex items-center gap-1.5 border-b pb-0.5 text-sm transition-colors duration-[140ms] ${
            showDatePicker
              ? "border-accent text-accent"
              : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
          }`}
        >
          <Plus
            size={13}
            strokeWidth={2}
            className={`transition-transform duration-[140ms] ${
              showDatePicker ? "rotate-45" : ""
            }`}
          />
          <span>
            {capturandoHoy
              ? "Fecha"
              : format(captureDate, "EEE d MMM", { locale: es })}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            const abrir = !showPriority;
            setShowPriority(abrir);
            if (abrir) setShowDatePicker(false);
            if (showPriority) setPriority(null);
          }}
          className={`accion-tinta inline-flex items-center gap-1.5 border-b pb-0.5 text-sm transition-colors duration-[140ms] ${
            showPriority
              ? "border-accent text-accent"
              : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
          }`}
        >
          <Flag
            size={13}
            strokeWidth={2}
            className={showPriority ? "text-accent" : ""}
          />
          <span>Prioridad</span>
        </button>
      </div>

      {panelFecha.montado && (
        <div className={panelFecha.saliendo ? "panel-saliendo" : "panel-animada"}>
          <WeekPicker selected={captureDate} onSelect={setCaptureDate} />
        </div>
      )}

      {panelPrioridad.montado && (
        <div
          className={`${panelPrioridad.saliendo ? "panel-saliendo" : "panel-animada mt-3"} caja-tinta mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface p-3`}
        >
          <span className="text-xs text-ink-faint">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPriority(p.valor)}
              className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm ${
                priority === p.valor
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}

      {captureError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {captureError}
        </p>
      )}
    </div>
  );
}

// WeekPicker: vista de SEMANA del picker. Presentación pura: recibe la
// fecha elegida y "onSelect"; el estado vive en CaptureBar.
export function WeekPicker({
  selected,
  onSelect,
  onMoverSemana,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  onMoverSemana?: (d: Date) => void;
}) {
  const moverSemana = onMoverSemana ?? onSelect;
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="panel-animada caja-tinta mt-3 rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => moverSemana(addDays(selected, -7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        {/* El período en manuscrita: detalle editorial secundario. */}
        <span className="etiqueta text-ink-soft">
          semana del {format(dias[0], "d", { locale: es })} al{" "}
          {format(dias[6], "d 'de' MMM", { locale: es })}
        </span>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => moverSemana(addDays(selected, 7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Los 7 días: un click = destino de captura. Borde transparente en
          reposo para que el seleccionado no mueva la grilla. */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const esSeleccionado = isSameDay(d, selected);
          const esHoy = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={`flex h-10 flex-col items-center justify-center rounded-lg border border-transparent ${
                esSeleccionado
                  ? "border-accent bg-accent-soft text-ink"
                  : "text-ink-soft hover:border-line hover:text-ink"
              }`}
            >
              <span className="text-[10px] font-medium">
                {format(d, "EEE", { locale: es })}
              </span>
              <span className="text-sm font-medium">{format(d, "d")}</span>
              {esHoy && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
