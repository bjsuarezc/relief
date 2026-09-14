// ToggleMovimiento: el interruptor de animaciones de la app.
//
// Por qué existe: Windows suele traer "Mostrar animaciones" apagado y el
// sistema reporta prefers-reduced-motion: reduce — Relief (bien) apagaba
// TODO el movimiento. Este interruptor permite que la app anime igual sin
// tocar la configuración del sistema.
//
// Estado en la clase .forzar-movimiento del <html> (ver App.css) y en
// localStorage bajo "relief-movimiento" ("on" | "off"). El script inline
// de index.html lee esa clave antes de que React cargue (sin flash).
// Por defecto: encendido.

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type Movimiento = "on" | "off";

export function ToggleMovimiento() {
  const [movimiento, setMovimiento] = useState<Movimiento>(() =>
    localStorage.getItem("relief-movimiento") === "off" ? "off" : "on",
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sin-transiciones");
    void root.offsetHeight; // reflow: aplica la supresión antes del cambio
    root.classList.toggle("forzar-movimiento", movimiento === "on");
    localStorage.setItem("relief-movimiento", movimiento);
    requestAnimationFrame(() => root.classList.remove("sin-transiciones"));
  }, [movimiento]);

  const encendido = movimiento === "on";

  return (
    <button
      type="button"
      onClick={() => setMovimiento(encendido ? "off" : "on")}
      aria-pressed={encendido}
      aria-label={encendido ? "Desactivar animaciones" : "Activar animaciones"}
      title={encendido ? "Animaciones activadas" : "Animaciones desactivadas"}
      className={`rounded-lg p-2 transition-colors duration-150 hover:bg-ink/5 ${
        encendido ? "text-accent" : "text-ink-soft hover:text-ink"
      }`}
    >
      <Sparkles size={17} />
    </button>
  );
}
