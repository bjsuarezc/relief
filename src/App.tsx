// App.tsx: la página principal. Layout mobile-first (decisión del
// propietario): la captura y la navegación viven fijas al pie, como una
// app de chat — el encabezado arriba queda mínimo (wordmark + ajustes).

import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MotionConfig } from "motion/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { BotonPapelera } from "./components/BotonPapelera";
import { CaptureBar } from "./components/CaptureBar";
import {
  ORDEN_VISTAS,
  TaskList,
  VistaNav,
  type Vista,
} from "./components/TaskList";
import { MascotaActual } from "./components/MascotaActual";
import { PanelAjustes } from "./components/PanelAjustes";
import { useTasksStore } from "./lib/store";

function App() {
  const { tasks, loading, error, loadTasks } = useTasksStore();
  // Estado de navegación (vista/ancla/dirección): vivía dentro de
  // TaskList; subió acá porque ahora VistaNav (pie fijo) y TaskList (el
  // contenido, con EncabezadoVista adentro) son hermanos que necesitan el
  // mismo estado, no una jerarquía padre-hijo.
  const [vista, setVista] = useState<Vista>("hoy");
  // 1 = viaja hacia la derecha (avanzando Hoy→Semana→Mes), -1 = izquierda
  // (volviendo). TaskList se lo pasa a Motion (AnimatePresence custom).
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [ancla, setAncla] = useState<Date>(new Date());
  const [cargado, setCargado] = useState(false);
  const previo = useRef<{ hechas: number; completo: boolean } | null>(null);

  const cambiarVista = (nueva: Vista) => {
    if (nueva === vista) return;
    setDireccion(ORDEN_VISTAS[nueva] > ORDEN_VISTAS[vista] ? 1 : -1);
    setVista(nueva);
  };
  const moverSemana = (dias: number) => setAncla(addDays(ancla, dias));
  const moverMes = (meses: number) => setAncla(addMonths(ancla, meses));

  useEffect(() => {
    // Al terminar la carga inicial se arma la línea base de la mascota
    // (ver más abajo): lo que ya estaba hecho no cuenta como reacción.
    void loadTasks().then(() => {
      setCargado(true);
    });
  }, [loadTasks]);

  // Esc oculta el panel de bandeja (Rust lo vuelve a abrir con el ícono o
  // el atajo global). Fuera de Tauri no hay ventana que ocultar.
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") void getCurrentWindow().hide();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // Reacciones de la mascota: un gesto por cada tarea que se completa hoy y
  // una celebración corta cuando el día queda completo (N/N). Solo después de
  // la carga inicial: abrir la app con tareas ya hechas no debe disparar nada.
  const activas = tasks.filter((t) => t.deletedAt === null);
  const completadasHoy = activas.filter(
    (t) => t.completedAt !== null && isToday(parseISO(t.completedAt)),
  ).length;
  const deHoy = activas.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
  const diaCompleto = deHoy.length > 0 && deHoy.every((t) => t.completed);
  const [reaccion, setReaccion] = useState(0);
  const [celebrando, setCelebrando] = useState(false);
  useEffect(() => {
    if (loading || !cargado) return;
    const antes = previo.current;
    previo.current = { hechas: completadasHoy, completo: diaCompleto };
    if (!antes) return;
    if (diaCompleto && !antes.completo) setCelebrando(true);
    else if (completadasHoy > antes.hechas) setReaccion((r) => r + 1);
  }, [loading, cargado, tasks, completadasHoy, diaCompleto]);
  useEffect(() => {
    if (!celebrando) return;
    const id = window.setTimeout(() => setCelebrando(false), 5000);
    return () => window.clearTimeout(id);
  }, [celebrando]);

  const hoy = new Date();
  const cantidadPapelera = tasks.filter((t) => t.deletedAt !== null).length;

  return (
    // La app siempre anima: Windows suele traer "Mostrar animaciones"
    // apagado y el sistema reportaría reduce, lo que dejaría Relief
    // estático. Por eso ya no hay interruptor ni se consulta esa preferencia.
    <MotionConfig reducedMotion="never">
      <div className="flex h-screen flex-col bg-canvas text-ink">
        {/* Encabezado: mínimo — el wordmark y los ajustes. Nada de
            navegación acá (bajó al pie). */}
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-5">
          {/* Panel angosto (~420px, popover de bandeja): la fecha baja
              debajo del wordmark en vez de competir con los ajustes. */}
          <div className="min-w-0">
            <h1 className="wordmark text-ink">
              relief<span className="text-accent">.</span>
            </h1>
            <p className="etiqueta mt-1 text-ink-faint">
              {format(hoy, "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          {/* La mascota vive en el encabezado y reacciona a lo que pasa. Sin
              margen propio: sobresale con margen negativo para no agrandar
              la fila. */}
          <MascotaActual
            estado={celebrando ? "celebrar" : "reposo"}
            reaccion={reaccion}
            className="-my-4 ml-auto h-[88px] w-[88px] shrink-0"
          />
          <div className="-mr-2 flex shrink-0 items-center">
            <BotonPapelera
              cantidad={cantidadPapelera}
              activa={vista === "papelera"}
              onClick={() => cambiarVista(vista === "papelera" ? "hoy" : "papelera")}
            />
            <PanelAjustes />
          </div>
        </header>

        {/* Contenido: la única zona que hace scroll, entre el encabezado
            fijo y la barra fija del pie. Sin barra visible (.sin-barra):
            se desplaza con la rueda, el touchpad o el teclado. */}
        <main className="sin-barra min-h-0 flex-1 overflow-y-auto px-5">
          <div className="mx-auto w-full max-w-2xl pb-6">
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
            {loading && <p className="mb-4 text-sm text-ink-soft">Cargando…</p>}
            {!loading && !error && (
              <TaskList
                tasks={tasks}
                vista={vista}
                ancla={ancla}
                direccion={direccion}
                onMoverSemana={moverSemana}
                onMoverMes={moverMes}
              />
            )}
          </div>
        </main>

        {/* Pie fijo: captura arriba, navegación abajo — el orden que el
            pulgar recorre primero es "escribir", después "moverme". */}
        <div className="mx-auto w-full max-w-2xl shrink-0">
          <CaptureBar />
          <VistaNav vista={vista} onCambiarVista={cambiarVista} />
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
