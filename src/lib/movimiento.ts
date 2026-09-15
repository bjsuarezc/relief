// movimiento.ts: el estado del interruptor de animaciones, compartido.
//
// Antes vivía SOLO dentro de ToggleMovimiento (useState local). Ahora
// Motion (la librería de animación) también necesita leerlo — MotionConfig
// decide si reduce el movimiento según esta señal — así que el estado sube
// a un mini store Zustand: un solo lugar, dos consumidores.
//
// La clase .forzar-movimiento del <html> sigue siendo la fuente para el
// CSS (App.css); este store es su espejo en React.

import { create } from "zustand";

interface MovimientoState {
  // true = animaciones encendidas (aunque el sistema pida reducirlas).
  activo: boolean;
  alternar: () => void;
}

export const useMovimientoStore = create<MovimientoState>((set) => ({
  activo: localStorage.getItem("relief-movimiento") !== "off",
  alternar: () =>
    set((s) => {
      const activo = !s.activo;
      localStorage.setItem("relief-movimiento", activo ? "on" : "off");
      return { activo };
    }),
}));
