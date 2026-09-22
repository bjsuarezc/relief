// CaptureBar: la barra de captura rápida — el corazón del MVP.
// Fija al pie, estilo píldora de chat (patrón mobile-first elegido por
// el propietario): la prioridad se ve y se toca sin abrir nada.

import { useEffect, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import { PanelDesplegable } from "./PanelDesplegable";
import { useTasksStore } from "../lib/store";
import type { CreateTaskInput, Priority } from "../lib/types";

// Prioridades: una sola fuente de etiquetas en la UI (la reutiliza TaskList).
export const PRIORIDADES: { valor: Priority; etiqueta: string }[] = [
  { valor: "high", etiqueta: "Alta" },
  { valor: "medium", etiqueta: "Media" },
  { valor: "low", etiqueta: "Baja" },
];

// Punto de color por prioridad (tono PLENO, no el tinte de fondo de las
// píldoras de la lista — acá son puntitos de 12px, necesitan el color
// entero para leerse).
const COLOR_PUNTO_PRIORIDAD: Record<Priority, string> = {
  high: "bg-prioridad-alta",
  medium: "bg-prioridad-media",
  low: "bg-prioridad-baja",
};

export function CaptureBar() {
  const createTask = useTasksStore((s) => s.createTask);
  const [title, setTitle] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Destino activo: la fecha elegida si hay picker; si no, hoy.
  const [captureDate, setCaptureDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  // null = sin elegir (Rust aplica medium). Tocar el punto ya elegido
  // lo deselecciona — no hace falta un popover para esto.
  const [priority, setPriority] = useState<Priority | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // El panel de bandeja se oculta y se vuelve a mostrar sin recargar la
  // página: cada vez que Rust lo abre (ícono o atajo global) manda este
  // evento y el cursor vuelve a la captura, listo para escribir.
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const desuscribir = listen("foco-captura", () => inputRef.current?.focus());
    return () => {
      void desuscribir.then((f) => f());
    };
  }, []);

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
    // Fija al pie (la posiciona App.tsx): píldora de captura tipo chat,
    // igual patrón que "escribir un mensaje" — cero curva de aprendizaje.
    // Banda de superficie propia, separada del contenido por una línea:
    // el mismo lenguaje que VistaNav justo debajo.
    <div className="flex flex-col border-t border-line bg-surface">
      {/* El picker de fecha se abre HACIA ARRIBA (está antes en el orden
          del flex column): aparece por encima de la píldora, nunca la tapa. */}
      <div className="px-4">
        <PanelDesplegable abierto={showDatePicker}>
          <WeekPicker
            selected={captureDate}
            onSelect={(d) => {
              setCaptureDate(d);
              setShowDatePicker(false);
            }}
          />
        </PanelDesplegable>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 px-4 py-2.5"
      >
        <div className="capture-focus flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line-input bg-surface px-3.5 py-2 transition-colors duration-200">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Qué tenés que hacer?"
            autoFocus
            className="entrada-papel min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-faint"
          />

          {/* Prioridad SIEMPRE visible — sin popover. Tocar el punto ya
              elegido lo deselecciona (vuelve a "sin elegir"). */}
          <div className="flex shrink-0 items-center gap-1.5">
            {PRIORIDADES.map((p) => (
              <motion.button
                key={p.valor}
                type="button"
                onClick={() => setPriority(priority === p.valor ? null : p.valor)}
                aria-label={`Prioridad ${p.etiqueta.toLowerCase()}`}
                aria-pressed={priority === p.valor}
                title={`Prioridad ${p.etiqueta.toLowerCase()}`}
                whileTap={{ scale: 0.7 }}
                animate={{ scale: priority === p.valor ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 15 }}
                className={`h-3 w-3 shrink-0 rounded-full transition-opacity duration-[140ms] ${
                  COLOR_PUNTO_PRIORIDAD[p.valor]
                } ${priority === p.valor ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
              />
            ))}
          </div>

          {/* Fecha: ícono de calendario. Se enciende en el acento si el
              destino no es hoy — la única señal que hace falta. */}
          <motion.button
            type="button"
            onClick={() => {
              const abrir = !showDatePicker;
              setShowDatePicker(abrir);
              if (!abrir) setCaptureDate(today);
            }}
            title={
              capturandoHoy
                ? "Elegir fecha"
                : `Capturando para ${format(captureDate, "EEE d MMM", { locale: es })}`
            }
            aria-label="Elegir fecha de la tarea"
            whileTap={{ scale: 0.85, rotate: -8 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            className={`shrink-0 transition-colors duration-[140ms] ${
              showDatePicker || !capturandoHoy
                ? "text-accent"
                : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            <Calendar size={16} />
          </motion.button>
        </div>

        <motion.button
          type="submit"
          aria-label="Crear tarea"
          whileTap={{ scale: 0.82 }}
          transition={{ type: "spring", stiffness: 600, damping: 15 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink hover:opacity-90"
        >
          <Plus size={16} strokeWidth={2.5} />
        </motion.button>
      </form>

      {captureError && (
        <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">
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

  // Sin margen/borde propio: quien lo use lo envuelve en PanelDesplegable,
  // que ya da el espacio y la línea superior — una sola fuente de ese
  // estilo, no una copia por cada panel.
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <motion.button
          type="button"
          aria-label="Semana anterior"
          onClick={() => moverSemana(addDays(selected, -7))}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 600, damping: 20 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-[140ms] hover:text-ink"
        >
          <ChevronLeft size={16} />
        </motion.button>
        {/* El período en manuscrita: detalle editorial secundario. */}
        <span className="etiqueta text-ink-soft">
          semana del {format(dias[0], "d", { locale: es })} al{" "}
          {format(dias[6], "d 'de' MMM", { locale: es })}
        </span>
        <motion.button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => moverSemana(addDays(selected, 7))}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 600, damping: 20 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-[140ms] hover:text-ink"
        >
          <ChevronRight size={16} />
        </motion.button>
      </div>

      {/* Los 7 días: un click = destino de captura. Borde transparente en
          reposo para que el seleccionado no mueva la grilla. */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const esSeleccionado = isSameDay(d, selected);
          const esHoy = isSameDay(d, new Date());
          return (
            <motion.button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              className={`flex h-10 flex-col items-center justify-center rounded-lg border border-transparent transition-colors duration-[140ms] ${
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
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
