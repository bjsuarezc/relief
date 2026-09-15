// App.tsx: la página principal. La firma es el wordmark, pero no estamos
// acá para eso: estamos para tachar. La narrativa del día domina.

import { useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import "./App.css";
import { CaptureBar } from "./components/CaptureBar";
import { TaskList } from "./components/TaskList";
import { ThemeToggle } from "./components/ThemeToggle";
import { ToggleMovimiento } from "./components/ToggleMovimiento";
import { useTasksStore } from "./lib/store";

function App() {
  const { tasks, loading, error, loadTasks } = useTasksStore();

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const hoy = new Date();

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-canvas px-6 pb-16 pt-16 text-ink">
      <div className="ambiente-vivo" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col">
        {/* Hero editorial — el encabezado que deja respirar. */}
        <header className="mb-3 flex items-end justify-between">
          <div>
            <h1 className="wordmark text-ink">
              relief<span className="text-accent">.</span>
            </h1>
            <p className="etiqueta mt-3 text-ink-faint">
              {format(hoy, "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ToggleMovimiento />
            <ThemeToggle />
          </div>
        </header>

        <div className="mt-4">
          <CaptureBar />
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        {loading && <p className="mt-4 text-sm text-ink-soft">Cargando…</p>}

        {!loading && !error && <TaskList tasks={tasks} />}
      </div>
    </main>
  );
}

export default App;
