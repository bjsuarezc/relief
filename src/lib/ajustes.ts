// ajustes.ts: preferencias de la persona (tema de color, modo claro/oscuro,
// mascota). Viven en un store de Zustand y se guardan en localStorage bajo
// "relief-ajustes". El script inline de index.html lee esa misma clave antes
// de que React cargue (sin flash del tema equivocado).
//
// Color de tema y modo son ortogonales: el tema fija la paleta (App.css,
// html[data-tema=…]) y el modo decide claro/oscuro (clase .dark en <html>).

import { create } from "zustand";
import type { Animal } from "../components/Mascota";

export type TemaColor = "salvia" | "terracota" | "tinta" | "neutro";
export type Modo = "claro" | "oscuro" | "auto";
export type MascotaElegida = Animal | "ninguna";

export const TEMAS: { id: TemaColor; nombre: string }[] = [
  { id: "salvia", nombre: "Salvia" },
  { id: "terracota", nombre: "Terracota" },
  { id: "tinta", nombre: "Tinta" },
  { id: "neutro", nombre: "Neutro" },
];

interface Ajustes {
  tema: TemaColor;
  modo: Modo;
  mascota: MascotaElegida;
  /** Índice de la paleta de pelaje elegido, por animal. */
  colores: Record<Animal, number>;
}

const CLAVE = "relief-ajustes";
const POR_DEFECTO: Ajustes = { tema: "salvia", modo: "claro", mascota: "nutria", colores: { nutria: 0, oso: 1, gato: 1 } };

function leer(): Ajustes {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const g = JSON.parse(crudo);
      const tema = TEMAS.some((t) => t.id === g.tema) ? g.tema : POR_DEFECTO.tema;
      return { ...POR_DEFECTO, ...g, tema, colores: { ...POR_DEFECTO.colores, ...g.colores } };
    }
    // Migración: antes solo existía el interruptor claro/oscuro.
    if (localStorage.getItem("relief-tema") === "dark") return { ...POR_DEFECTO, modo: "oscuro" };
  } catch {
    /* localStorage no disponible: valores por defecto */
  }
  return POR_DEFECTO;
}

const oscuroDelSistema = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

// Aplica tema y modo al <html>. Las transiciones de color se suspenden un
// frame (.sin-transiciones) para que el cambio sea un snap limpio y no un
// emborronado de todos los colores a la vez.
function aplicar({ tema, modo }: Ajustes) {
  const root = document.documentElement;
  root.classList.add("sin-transiciones");
  void root.offsetHeight;
  root.dataset.tema = tema;
  root.classList.toggle("dark", modo === "oscuro" || (modo === "auto" && oscuroDelSistema()));
  // El contorno claro de las mascotas depende de la LUMINANCIA del fondo, no
  // del modo: así un tema con fondo intermedio tampoco las pierde.
  const hex = getComputedStyle(root).getPropertyValue("--canvas").trim().match(/[0-9a-f]{2}/gi);
  const oscuroAhora = root.classList.contains("dark");
  const [r, g, b] = (hex ?? (oscuroAhora ? ["00", "00", "00"] : ["ff", "ff", "ff"])).map((h) => parseInt(h, 16));
  root.dataset.fondo = 0.299 * r + 0.587 * g + 0.114 * b < 110 ? "oscuro" : "claro";
  requestAnimationFrame(() => root.classList.remove("sin-transiciones"));
}

interface AjustesStore extends Ajustes {
  setTema: (t: TemaColor) => void;
  setModo: (m: Modo) => void;
  setMascota: (m: MascotaElegida) => void;
  setColor: (animal: Animal, indice: number) => void;
}

export const useAjustes = create<AjustesStore>((set, get) => {
  const guardar = (cambio: Partial<Ajustes>) => {
    set(cambio);
    const { tema, modo, mascota, colores } = get();
    const nuevo = { tema, modo, mascota, colores };
    aplicar(nuevo);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nuevo));
    } catch {
      /* sin persistencia: el cambio vale para la sesión */
    }
  };
  return {
    ...leer(),
    setTema: (tema) => guardar({ tema }),
    setModo: (modo) => guardar({ modo }),
    setMascota: (mascota) => guardar({ mascota }),
    setColor: (animal, indice) => guardar({ colores: { ...get().colores, [animal]: indice } }),
  };
});

// Estado inicial + seguimiento del modo "auto" cuando cambia el sistema.
aplicar(useAjustes.getState());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (useAjustes.getState().modo === "auto") aplicar(useAjustes.getState());
});
