// CaptureBar: la barra de captura rápida — el corazón del MVP.
// Diseño: h-12 de altura, input grande; solo un chip de mods a la vez.
// La jerarquía visual pone al input como el elemento más prominente.

import { useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTasksStore } from "../lib/store";
import type { CreateTaskInput, Priority } from "../lib/types";

// Prioridades visibles en la lógica de captura (una sola fuente de
// etiquetas de prioridad en la UI).
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
    // <form onSubmit> : Enter dispara la creación nativamente, sin
    // listeners manuales. preventDefault evita recarga de página.
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 transition-colors duration-200 focus-within:border-accent"
      >
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué tienes que hacer?"
          autoFocus
          className="h-full flex-1 bg-transparent text-lg outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          aria-label="Crear tarea"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent transition-[background-color,color,scale] duration-150 hover:bg-accent hover:text-canvas active:scale-[0.96]"
        >
          <Plus size={18} />
        </button>
      </form>

      {/* Fila de chips. Un chip abre/cierra su panel; solo uno abierto a la vez. */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const abrir = !showDatePicker;
            setShowDatePicker(abrir);
            if (abrir) setShowPriority(false);
            if (showDatePicker) setCaptureDate(today); // al cerrar: hoy
          }}
          className={`flex h-8 items-center rounded-full border px-3 text-sm transition-[background-color,color,scale] duration-150 active:scale-[0.96] ${
            showDatePicker
              ? "border-accent bg-accent-soft text-ink"
              : "border-line text-ink-soft hover:bg-ink/5"
          }`}
        >
          {capturandoHoy
            ? "+ fecha"
            : `+ fecha · ${format(captureDate, "EEE d MMM", { locale: es })}`}
        </button>

        <button
          type="button"
          onClick={() => {
            const abrir = !showPriority;
            setShowPriority(abrir);
            if (abrir) setShowDatePicker(false);
            if (showPriority) setPriority(null); // al cerrar: media
          }}
          className={`flex h-8 items-center rounded-full border px-3 text-sm transition-[background-color,color,scale] duration-150 active:scale-[0.96] ${
            showPriority
              ? "border-accent bg-accent-soft text-ink"
              : "border-line text-ink-soft hover:bg-ink/5"
          }`}
        >
          {priority
            ? `+ prioridad · ${PRIORIDADES.find((p) => p.valor === priority)?.etiqueta.toLowerCase()}`
            : "+ prioridad"}
        </button>
      </div>

      {/* Panel del picker: solo visible si el chip está activo. */}
      {showDatePicker && (
        <WeekPicker selected={captureDate} onSelect={setCaptureDate} />
      )}

      {/* Panel de prioridad: 3 pastillas; la elegida queda resaltada. */}
      {showPriority && (
        <div className="panel-animada mt-3 elevada flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <span className="text-xs text-ink-faint">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPriority(p.valor)}
              className={`flex h-8 items-center rounded-full border px-3 text-sm transition-[background-color,color,scale] duration-150 active:scale-[0.96] ${
                priority === p.valor
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-soft hover:bg-ink/5"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}

      {captureError && (
        <p className="mt-2 text-sm text-red-500">{captureError}</p>
      )}
    </div>
  );
}

// WeekPicker: vista de SEMANA del picker de captura.
// Solo recibe la fecha seleccionada y "onSelect": es un componente de
// presentación; el estado vive en CaptureBar.
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
    <div className="panel-animada mt-3 rounded-xl border border-line bg-surface p-3">
      {/* Encabezado: flechas mueven ±7 días. */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => moverSemana(addDays(selected, -7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-ink-soft">
          Semana del {format(dias[0], "d MMM", { locale: es })} al{" "}
          {format(dias[6], "d 'de' MMM", { locale: es })}
        </span>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => moverSemana(addDays(selected, 7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Los 7 días de la semana: un click = destino de captura. */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const esSeleccionado = isSameDay(d, selected);
          const esHoy = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={`flex h-10 flex-col items-center justify-center rounded-lg border border-transparent transition-colors duration-150 ${
                esSeleccionado
                  ? "border-accent bg-accent-soft text-ink"
                  : "text-ink-soft hover:bg-ink/5"
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
