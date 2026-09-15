// App.tsx: la página principal. La firma es el wordmark, pero no estamos
// acá para eso: estamos para tachar. La narrativa del día domina.

import { useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MotionConfig } from "motion/react";
import "./App.css";
import { CaptureBar } from "./components/CaptureBar";
import { TaskList } from "./components/TaskList";
import { ThemeToggle } from "./components/ThemeToggle";
import { ToggleMovimiento } from "./components/ToggleMovimiento";
import { useMovimientoStore } from "./lib/movimiento";
import { useTasksStore } from "./lib/store";

function App() {
  const { tasks, loading, error, loadTasks } = useTasksStore();
  // La PoC de Motion (Sesión 20): el interruptor de animaciones gobierna
  // también a Motion. "user" = respetar prefers-reduced-motion del sistema
  // (paridad con el CSS); "never" = animar igual (equivale a la clase
  // .forzar-movimiento que pisa el reduce del sistema).
  const movimientoActivo = useMovimientoStore((s) => s.activo);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const hoy = new Date();

  return (
    <MotionConfig reducedMotion={movimientoActivo ? "never" : "user"}>
      <main className="grano relative flex min-h-screen flex-col items-center bg-canvas px-6 pb-16 pt-16 text-ink">
        <div className="relative z-10 flex w-full max-w-2xl flex-col">
          {/* Masthead: el wordmark manda y la fecha es una anotación alineada
              a su base. SIN línea de ancho completo (pedido del propietario:
              menos caja). Los ajustes viven al pie. */}
          <header className="mb-12 flex items-baseline justify-between gap-6">
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

          <footer className="mt-20 flex items-center justify-end gap-1">
            <ToggleMovimiento />
            <ThemeToggle />
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}

export default App;
