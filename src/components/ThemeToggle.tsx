// ThemeToggle: el interruptor claro/oscuro (decisión del propietario:
// Relief vive en AMBOS temas, sereno/minimal).
// El tema vive en la clase .dark de <html> (ver App.css) y se persiste
// en localStorage bajo "relief-tema". El script inline de index.html
// lee esa misma clave antes de que React cargue (sin flash).
//
// Receta de better-ui: al cambiar de tema, TODAS las transiciones de
// color del documento dispararían a la vez y el cambio "se emborrona".
// Por eso se agrega .sin-transiciones, se fuerza reflow y se quita en
// el siguiente frame — el cambio es un snap limpio.
// Los dos iconos viven en el DOM con cross-fade (sin dependencias:
// receta de iconos contextuales, curva cúbica exacta).

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "light" | "dark";

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => {
    // Claro por defecto (la identidad "papel"); oscuro solo si se eligió.
    return localStorage.getItem("relief-tema") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sin-transiciones");
    // Forzar reflow: obliga al navegador a aplicar la supresión de
    // transiciones ANTES de que cambien los colores.
    void root.offsetHeight;
    root.classList.toggle("dark", tema === "dark");
    localStorage.setItem("relief-tema", tema);
    requestAnimationFrame(() => root.classList.remove("sin-transiciones"));
  }, [tema]);

  return (
    <button
      type="button"
      onClick={() => setTema(tema === "dark" ? "light" : "dark")}
      aria-label={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="rounded-lg p-2 text-ink-soft transition-colors duration-[140ms] hover:bg-ink/5 hover:text-ink active:scale-[0.96]"
    >
      {/* Cross-fade de iconos (ambos en el DOM, sin librerías):
          la luna sale y el sol entra con la misma curva exacta. */}
      <span className="relative block h-5 w-5">
        <Sun
          size={17}
          className="absolute inset-0 transition-[opacity,transform] duration-[140ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]"
          style={{
            opacity: tema === "light" ? 1 : 0,
            transform: `scale(${tema === "light" ? 1 : 0.75})`,
          }}
        />
        <Moon
          size={17}
          className="absolute inset-0 transition-[opacity,transform] duration-[140ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]"
          style={{
            opacity: tema === "dark" ? 1 : 0,
            transform: `scale(${tema === "dark" ? 1 : 0.75})`,
          }}
        />
      </span>
    </button>
  );
}
