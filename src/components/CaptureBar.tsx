// CaptureBar: la barra de captura rápida — el corazón del MVP.
// Principio de la visión (docs/01-vision.md): si crear una tarea toma más
// de 5 segundos, fallamos. Por eso el flujo sin chips sigue siendo
// escribir + Enter, sin tocar nada más.
//
// Paso 2 (este archivo): chips opcionales de captura.
// - "+ fecha": abre el picker de SEMANA y queda abierto (decisión del
//   propietario: captura en lote en distintos días sin reabrir).
// - "+ prioridad": 3 pastillas (alta/media/baja); la selección persiste
//   mientras capturas, hasta cerrar el chip o cambiarla.
// - Mientras un chip está activo, un "badge" junto al chip confirma el
//   destino de captura (ej: "+ fecha · vie 12 sep") — nunca capturas
//   "a ciegas" en un día que no es el que crees.
// - Cerrar el chip devuelve el destino al default: hoy / media.
//
// La expansión del picker a vista de MES y el conmutador de vista de la
// lista (Hoy/Semana/Mes) son el paso 3, ya decidido con el propietario.

import { useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTasksStore } from "../lib/store";
import type { CreateTaskInput, Priority } from "../lib/types";

// Las 3 prioridades en orden visual (alta → media → baja), con etiqueta
// legible para las pastillas y el badge del chip.
const PRIORIDADES: { valor: Priority; etiqueta: string }[] = [
  { valor: "high", etiqueta: "Alta" },
  { valor: "medium", etiqueta: "Media" },
  { valor: "low", etiqueta: "Baja" },
];

export function CaptureBar() {
  // Suscripción fina: solo nos interesa createTask del store.
  const createTask = useTasksStore((s) => s.createTask);

  const [title, setTitle] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Estado de los chips (el "destino de captura"):
  // - captureDate: el día al que apuntan las tareas que crees AHORA.
  //   No es un estado "de filtro": es de captura (escribe→entra en ese día).
  // - showDatePicker / showPriority: paneles abiertos o cerrados.
  // - priority: null = sin selección (Rust pone "medium").
  const [captureDate, setCaptureDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [showPriority, setShowPriority] = useState(false);

  // useRef: referencia "directa" a un elemento del DOM, sin re-renderizar.
  // La usamos para devolver el foco al input después de cada captura,
  // de modo que puedas escribir la siguiente tarea sin tocar el mouse.
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  // El badge de fecha solo aparece si el destino NO es hoy (menos ruido).
  const capturandoHoy = isSameDay(captureDate, today);

  const submit = async () => {
    // Validación temprana (misma regla que Rust, mejor experiencia aquí).
    const trimmed = title.trim();
    if (trimmed === "") {
      setCaptureError("Escribe una tarea antes de crearla");
      inputRef.current?.focus();
      return;
    }

    const tasksBefore = useTasksStore.getState().tasks.length;

    // El pedido usa el DESTINO ACTIVO: el día del picker (default: hoy)
    // y la prioridad elegida (si no hay, no se manda y Rust pone medium).
    const pedido: CreateTaskInput = {
      title: trimmed,
      dueDate: format(captureDate, "yyyy-MM-dd"),
    };
    if (priority) pedido.priority = priority;
    await createTask(pedido);

    // Detectamos si la creación falló comparando la lista: si no creció,
    // el store guardó el error y no limpiamos el texto. El foco siempre
    // vuelve; el destino de captura NO se resetea (persistencia en lote).
    const created = useTasksStore.getState().tasks.length > tasksBefore;
    if (created) {
      setTitle("");
      setCaptureError(null);
    } else {
      setCaptureError(useTasksStore.getState().error);
    }
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 focus-within:border-neutral-600"
      >
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué tienes que hacer?"
          autoFocus
          className="w-full bg-transparent text-lg outline-none placeholder:text-neutral-600"
        />
        <button
          type="submit"
          aria-label="Crear tarea"
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Plus size={20} />
        </button>
      </form>

      {/* Fila de chips. Un chip es un botón que abre/cierra su panel.
          Al cerrar se resetea la selección de ESE chip (el otro no se toca). */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowDatePicker(!showDatePicker);
            if (showDatePicker) setCaptureDate(today); // al cerrar: vuelve a hoy
          }}
          className={`rounded-full border px-3 py-1 text-sm ${
            showDatePicker
              ? "border-neutral-500 bg-neutral-800 text-neutral-100"
              : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          }`}
        >
          {/* Badge: solo confirma si capturas a otro día que no es hoy */}
          {capturandoHoy
            ? "+ fecha"
            : `+ fecha · ${format(captureDate, "EEE d MMM", { locale: es })}`}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowPriority(!showPriority);
            if (showPriority) setPriority(null); // al cerrar: vuelve a media
          }}
          className={`rounded-full border px-3 py-1 text-sm ${
            showPriority
              ? "border-neutral-500 bg-neutral-800 text-neutral-100"
              : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          }`}
        >
          {priority
            ? `+ prioridad · ${PRIORIDADES.find((p) => p.valor === priority)?.etiqueta.toLowerCase()}`
            : "+ prioridad"}
        </button>
      </div>

      {/* Panel del picker de semana: vive acá abajo, bajo los chips.
          "Persistente" = no se cierra al crear una tarea; solo con el chip. */}
      {showDatePicker && (
        <WeekPicker selected={captureDate} onSelect={setCaptureDate} />
      )}

      {/* Panel de prioridad: 3 pastillas; la elegida queda resaltada. */}
      {showPriority && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
          <span className="text-xs text-neutral-500">Prioridad:</span>
          {PRIORIDADES.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPriority(p.valor)}
              className={`rounded-full border px-3 py-1 text-sm ${
                priority === p.valor
                  ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                  : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}

      {captureError && <p className="mt-2 text-sm text-red-400">{captureError}</p>}
    </div>
  );
}

// WeekPicker: vista de SEMANA del picker (opción A del propietario: hecho a
// mano con date-fns, no calendario nativo — control del estilo y base directa
// de la expansión a mes del paso 3).
//
// Exportado: lo reutiliza TaskList para las acciones de reorganización
// ("Más opciones" en Atrasadas) — un solo selector de semana en la app.
//
// Dos callbacks separados (lección de reuso):
// - onSelect: click en un día (ELEGIR destino).
// - onMoverSemana: flechas ‹ › (SOLO navegar la vista). En la captura son
//   lo mismo, pero al reorganizar una tarea las flechas NO deben mover la
//   tarea: si no existiera este segundo callback, tocar ‹ › re-agendaría
//   la tarea de inmediato. En CaptureBar no se pasa → las flechas usan
//   onSelect y el comportamiento queda igual que antes.
export function WeekPicker({
  selected,
  onSelect,
  onMoverSemana,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  onMoverSemana?: (d: Date) => void;
}) {
  // ?? (coalescencia nula): "si no me pasaron onMoverSemana, uso onSelect".
  const moverSemana = onMoverSemana ?? onSelect;
  // Semana que "contiene" al día seleccionado, empezando en LUNES
  // (weekStartsOn: 1 — convención española; el default de date-fns es domingo).
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      {/* Encabezado: flechas mueven ±7 días (misma posición en la semana).
          Cuando no es hoy, el badge del chip siempre lo dice — permitir
          fechas pasadas es una decisión tomada (anotar cosas ya vencidas). */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => moverSemana(addDays(selected, -7))}
          className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-neutral-400">
          Semana del {format(dias[0], "d MMM", { locale: es })} al{" "}
          {format(dias[6], "d MMM", { locale: es })}
        </span>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => moverSemana(addDays(selected, 7))}
          className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Los 7 días de la semana: un click = destino de captura.
          El día seleccionado va resaltado; "hoy" lleva un puntito para
          ubicarte sin abrir nada. */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const esSeleccionado = isSameDay(d, selected);
          const esHoy = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={`flex flex-col items-center rounded-lg py-2 ${
                esSeleccionado
                  ? "bg-neutral-700 text-neutral-50"
                  : "text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              <span className="text-[10px] uppercase">
                {format(d, "EEE", { locale: es })}
              </span>
              <span className="text-sm font-medium">{format(d, "d")}</span>
              {esHoy && <span className="mt-0.5 h-1 w-1 rounded-full bg-neutral-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
