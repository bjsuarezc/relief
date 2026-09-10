import { useEffect } from "react";
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
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-4 text-sm text-neutral-400">Cargando…</p>}
      {!loading && !error && (
        <p className="mt-4 text-sm text-neutral-400">
          {tasks.length === 0
            ? "Sin tareas todavía — la base de datos está conectada y vacía"
            : `${tasks.length} tarea(s)`}
        </p>
      )}
    </main>
  );
}

export default App;
