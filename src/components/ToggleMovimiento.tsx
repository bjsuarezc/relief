// ToggleMovimiento: el interruptor de animaciones de la app.
//
// Por qué existe: Windows suele traer "Mostrar animaciones" apagado y el
// sistema reporta prefers-reduced-motion: reduce — Relief (bien) apagaba
// TODO el movimiento. Este interruptor permite que la app anime igual sin
// tocar la configuración del sistema.
//
// El estado vive en el store compartido (lib/movimiento.ts): la clase
// .forzar-movimiento del <html> la lee el CSS (App.css) y el valor
// `activo` lo lee MotionConfig (App.tsx) — un solo estado, dos motores.
// Por defecto: encendido.

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useMovimientoStore } from "../lib/movimiento";

export function ToggleMovimiento() {
  const activo = useMovimientoStore((s) => s.activo);
  const alternar = useMovimientoStore((s) => s.alternar);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sin-transiciones");
    void root.offsetHeight; // reflow: aplica la supresión antes del cambio
    root.classList.toggle("forzar-movimiento", activo);
    requestAnimationFrame(() => root.classList.remove("sin-transiciones"));
  }, [activo]);

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={activo}
      aria-label={activo ? "Desactivar animaciones" : "Activar animaciones"}
      title={activo ? "Animaciones activadas" : "Animaciones desactivadas"}
      className={`rounded-lg p-2 transition-colors duration-[140ms] hover:bg-ink/5 ${
        activo ? "text-accent" : "text-ink-soft hover:text-ink"
      }`}
    >
      <Sparkles size={17} />
    </button>
  );
}
