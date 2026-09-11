// App.tsx: el armador de la ventana. No tiene lógica de lista ni de
// captura: solo compone las piezas (CaptureBar + TaskList) y las alimenta
// con el estado del store. Cada pieza vive en su propio archivo.

import { useEffect } from "react";
import { CaptureBar } from "./components/CaptureBar";
import { TaskList } from "./components/TaskList";
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

      <div className="mt-8 w-full max-w-xl">
        <CaptureBar />
      </div>

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-6 text-sm text-neutral-400">Cargando…</p>}

      {/* La lista (con conmutador Hoy/Semana/Mes) vive en TaskList.
          Cuando createTask agrega una tarea al store, esta lista se
          refresca sola (Zustand avisa a los suscritos). */}
      {!loading && !error && <TaskList tasks={tasks} />}
    </main>
  );
}

export default App;
