import { useEffect } from "react";
import { CaptureBar } from "./components/CaptureBar";
import { useTasksStore } from "./lib/store";
import "./App.css";

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
            <li
              key={task.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm"
            >
              <span>{task.title}</span>
              <span className="text-neutral-500">
                {task.dueDate} · {task.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
