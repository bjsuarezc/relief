import { useEffect } from "react";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CaptureBar } from "./components/CaptureBar";
import { useTasksStore } from "./lib/store";
import type { Priority, Task } from "./lib/types";
import "./App.css";

// Helpers de PRESENTACIÓN (no de datos): convierten lo crudo que guarda la
// BD (fechas ISO, claves en inglés) en texto humano. Viven acá porque son
// solo para esta lista provisional; la lista real del paso 4 decidirá
// dónde vive su formato definitivo.

// "2026-09-10" -> "hoy" | "vie 12 sep". parseISO convierte el string de
// la BD a Date para que date-fns pueda trabajar con él.
// Si es null (tareas viejas sin fecha), mostramos "sin fecha" — caso
// borde: la captura actual siempre manda fecha (decisión del propietario).
function formatoFecha(iso: string | null): string {
  if (!iso) return "sin fecha";
  const fecha = parseISO(iso);
  return isToday(fecha)
    ? "hoy"
    : format(fecha, "EEE d MMM", { locale: es });
}

// La clave de la BD (high/medium/low) -> etiqueta en español + color.
// Los colores siguen una lógica de "calor": alta = caliente (rojo),
// media = tibia (ámbar), baja = fría (verde). Nada de alarmas para
// atrasadas/prioridad (decisión de producto de la Sesión 1).
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

function TareaLinea({ task }: { task: Task }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
      <span>{task.title}</span>
      <span className="text-neutral-500">
        {formatoFecha(task.dueDate)} ·{" "}
        <span className={COLOR_PRIORIDAD[task.priority]}>
          {ETIQUETA_PRIORIDAD[task.priority]}
        </span>
      </span>
    </li>
  );
}

function App() {
  const { tasks, loading, error, loadTasks } = useTasksStore();

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-4 py-10 text-neutral-100">
      <h1 className="text-3xl font-bold tracking-tight">TaskLens</h1>

      {/* Pieza nueva de este paso: la barra de captura.
          La lista de abajo es provisional (texto plano): solo existe para
          VERIFICAR que el loop capturar->guardar->mostrar funciona.
          El diseño real de la lista viene en el siguiente paso. */}
      <div className="mt-8 w-full max-w-xl">
        <CaptureBar />
      </div>

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-6 text-sm text-neutral-400">Cargando…</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="mt-6 text-sm text-neutral-400">
          Sin tareas todavía — escribe una arriba y presiona Enter
        </p>
      )}

      {/* Lista provisional: cada tarea como una línea simple.
          Se lee directo del store: cuando createTask agrega la tarea,
          esta lista se refresca sola (Zustand avisa a los suscritos). */}
      {tasks.length > 0 && (
        <ul className="mt-6 w-full max-w-xl space-y-2">
          {tasks.map((task) => (
            <TareaLinea key={task.id} task={task} />
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
