// App.tsx: el armador de la ventana. No tiene lógica de lista ni de
// captura: solo compone las piezas (CaptureBar + TaskList) y las alimenta
// con el estado del store. Cada pieza vive en su propio archivo.

import { useEffect } from "react";
import { CaptureBar } from "./components/CaptureBar";
import { TaskList } from "./components/TaskList";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTasksStore } from "./lib/store";
import "./App.css";

function App() {
  const { tasks, loading, error, loadTasks } = useTasksStore();

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-canvas px-4 py-12 text-ink">
      {/* El ambiente respira — la app reposa cuando la vista está base. */}
      <div className="ambiente-vivo" />

      {/* El wordmark: el elemento memorable de la app (sobrio, tipográfico).
          El punto en color de acento es la firma — "hecho, alivio". */}
      <header className="flex w-full max-w-xl items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          relief<span className="text-accent">.</span>
        </h1>
        <ThemeToggle />
      </header>

      <div className="mt-10 w-full max-w-xl">
        <CaptureBar />
      </div>

      {error && <p className="mt-6 text-sm text-red-500">{error}</p>}
      {loading && <p className="mt-6 text-sm text-ink-soft">Cargando…</p>}

      {/* La lista (con conmutador Hoy/Semana/Mes) vive en TaskList.
          Cuando createTask agrega una tarea al store, esta lista se
          refresca sola (Zustand avisa a los suscritos). */}
      {!loading && !error && <TaskList tasks={tasks} />}
    </main>
  );
}

export default App;
