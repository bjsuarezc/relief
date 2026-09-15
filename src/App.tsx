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
    <main className="grano relative flex min-h-screen flex-col items-center bg-canvas px-6 pb-16 pt-16 text-ink">
      <div className="relative z-10 flex w-full max-w-2xl flex-col">
        {/* Masthead: el wordmark manda y la fecha es una anotación alineada
            a su base — composición de diario, no barra de app. Los ajustes
            (tema, movimiento) viven al pie: son del documento, no del día. */}
        <header className="mb-12 flex items-baseline justify-between gap-6 border-b border-line pb-2">
          <h1 className="wordmark text-ink">
            relief<span className="text-accent">.</span>
          </h1>
          <p className="etiqueta shrink-0 text-ink-faint">
            {format(hoy, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </header>

        <CaptureBar />

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        {loading && <p className="mt-4 text-sm text-ink-soft">Cargando…</p>}

        {!loading && !error && <TaskList tasks={tasks} />}

        <footer className="mt-20 flex items-center justify-end gap-1 border-t border-line pt-3">
          <ToggleMovimiento />
          <ThemeToggle />
        </footer>
      </div>
    </main>
  );
}

export default App;
