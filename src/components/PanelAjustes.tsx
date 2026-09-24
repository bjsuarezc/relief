// PanelAjustes: el botón de engranaje del encabezado y su panel flotante.
// Tema de color, modo (claro/oscuro/auto) y mascota. Los cambios se aplican
// al instante (sin "guardar"): se ve el efecto mientras se elige.

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Settings2, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TEMAS, useAjustes, type Modo, type TemaColor } from "../lib/ajustes";
import { api } from "../lib/api";
import { Mascota, MASCOTAS_HABILITADAS, PALETA_PELAJE, type Animal } from "./Mascota";

// Solo existe fuera del navegador (Tauri real): en dev-mock/navegador no
// hay registro de Windows que leer ni escribir.
const enTauri = "__TAURI_INTERNALS__" in window;

// Muestras: cada tema pinta su fondo y su acento, tal cual se verá.
const MUESTRA: Record<TemaColor, { canvas: string; acento: string }> = {
  salvia: { canvas: "#fbf3ea", acento: "#3f7367" },
  terracota: { canvas: "#fcf0e8", acento: "#a94e33" },
  tinta: { canvas: "#f1f3f7", acento: "#3b5b8c" },
  neutro: { canvas: "#f6f5f3", acento: "#4a4741" },
};

const MODOS: { id: Modo; nombre: string; Icono: typeof Sun }[] = [
  { id: "claro", nombre: "Claro", Icono: Sun },
  { id: "oscuro", nombre: "Oscuro", Icono: Moon },
  { id: "auto", nombre: "Auto", Icono: Monitor },
];

const ANIMALES: { id: Animal; nombre: string }[] = [
  { id: "nutria", nombre: "Nutria" },
  { id: "oso", nombre: "Oso" },
  { id: "gato", nombre: "Gato" },
];

const RESORTE = { type: "spring", stiffness: 500, damping: 34 } as const;

export function PanelAjustes() {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const { tema, modo, mascota, colores, setTema, setModo, setMascota, setColor } = useAjustes();

  // Inicio con Windows: opt-in, apagado hasta que la persona lo prenda a
  // propósito (ver bandeja.rs — antes se activaba solo y sin preguntar, lo
  // que disparaba alertas de Windows Defender). `null` = todavía sin leer.
  const [inicioSistema, setInicioSistema] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enTauri) return;
    void api.getInicioConSistema().then(setInicioSistema);
  }, []);
  const alternarInicioSistema = async () => {
    if (inicioSistema === null) return;
    const nuevo = !inicioSistema;
    setInicioSistema(nuevo); // optimista: se revierte si Rust falla
    try {
      await api.setInicioConSistema(nuevo);
    } catch {
      setInicioSistema(!nuevo);
    }
  };

  // Cierra con Esc o al hacer clic fuera. Esc en la app oculta la ventana
  // (bandeja): con el panel abierto solo debe cerrar el panel.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    const alPulsar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear, true);
    window.addEventListener("pointerdown", alPulsar);
    return () => {
      window.removeEventListener("keydown", alTeclear, true);
      window.removeEventListener("pointerdown", alPulsar);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="relative">
      <motion.button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Ajustes"
        aria-expanded={abierto}
        whileTap={{ scale: 0.85, rotate: 40 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className={`rounded-lg p-2 transition-colors duration-[140ms] hover:bg-ink/5 ${
          abierto ? "text-accent" : "text-ink-soft hover:text-ink"
        }`}
      >
        <Settings2 size={17} />
      </motion.button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            role="dialog"
            aria-label="Ajustes"
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: RESORTE }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-30 mt-1 w-[min(88vw,340px)] space-y-5 rounded-2xl border border-line bg-canvas p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]"
          >
            <Seccion titulo="Color">
              <div className="flex gap-3">
                {TEMAS.map(({ id, nombre }) => (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={() => setTema(id)}
                    aria-pressed={tema === id}
                    aria-label={`Tema ${nombre}`}
                    whileTap={{ scale: 0.9 }}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <span
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line"
                      style={{ background: MUESTRA[id].canvas }}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: MUESTRA[id].acento }} />
                      {tema === id && (
                        <motion.span
                          layoutId="anillo-tema"
                          transition={RESORTE}
                          className="absolute -inset-1 rounded-full border-2 border-accent"
                        />
                      )}
                    </span>
                    <span className={`text-[11px] ${tema === id ? "text-ink" : "text-ink-faint"}`}>{nombre}</span>
                  </motion.button>
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Modo">
              <div className="relative flex rounded-xl bg-surface p-1">
                {MODOS.map(({ id, nombre, Icono }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setModo(id)}
                    aria-pressed={modo === id}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      modo === id ? "text-ink" : "text-ink-faint hover:text-ink-soft"
                    }`}
                  >
                    {modo === id && (
                      <motion.span
                        layoutId="pastilla-modo"
                        transition={RESORTE}
                        className="absolute inset-0 rounded-lg bg-canvas shadow-sm"
                      />
                    )}
                    <Icono size={13} className="relative" />
                    <span className="relative">{nombre}</span>
                  </button>
                ))}
              </div>
            </Seccion>

            {MASCOTAS_HABILITADAS && (
            <Seccion titulo="Mascota">
              <div className="grid grid-cols-4 gap-2">
                {ANIMALES.map(({ id, nombre }) => (
                  <Ficha key={id} activa={mascota === id} nombre={nombre} onClick={() => setMascota(id)}>
                    <Mascota animal={id} pelaje={PALETA_PELAJE[colores[id]]?.color} className="h-14 w-14" />
                  </Ficha>
                ))}
                <Ficha activa={mascota === "ninguna"} nombre="Ninguna" onClick={() => setMascota("ninguna")}>
                  <span className="text-lg text-ink-faint">—</span>
                </Ficha>
              </div>
              {mascota !== "ninguna" && (
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="text-[11px] text-ink-faint">Pelaje</span>
                  {PALETA_PELAJE.map(({ nombre, color }, i) => (
                    <motion.button
                      key={color}
                      type="button"
                      onClick={() => setColor(mascota, i)}
                      aria-pressed={colores[mascota] === i}
                      aria-label={`Pelaje ${nombre}`}
                      title={nombre}
                      whileTap={{ scale: 0.85 }}
                      className="relative h-6 w-6 rounded-full border border-line"
                      style={{ background: color }}
                    >
                      {colores[mascota] === i && (
                        <motion.span
                          layoutId="anillo-pelaje"
                          transition={RESORTE}
                          className="absolute -inset-1 rounded-full border-2 border-accent"
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </Seccion>
            )}

            {enTauri && (
              <Seccion titulo="Sistema">
                <button
                  type="button"
                  onClick={() => void alternarInicioSistema()}
                  disabled={inicioSistema === null}
                  aria-pressed={inicioSistema ?? false}
                  className="flex w-full items-center justify-between gap-3 disabled:opacity-50"
                >
                  <span className="text-left text-sm text-ink">
                    Iniciar con Windows
                    <span className="block text-[11px] text-ink-faint">
                      Relief queda lista en la bandeja al prender la PC
                    </span>
                  </span>
                  <span
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                      inicioSistema ? "bg-accent" : "bg-surface"
                    }`}
                  >
                    <motion.span
                      layout
                      transition={RESORTE}
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-canvas shadow-sm"
                      style={{ left: inicioSistema ? 18 : 2 }}
                    />
                  </span>
                </button>
              </Seccion>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="etiqueta mb-2.5 text-ink-faint">{titulo}</h2>
      {children}
    </section>
  );
}

function Ficha({
  activa,
  nombre,
  onClick,
  children,
}: {
  activa: boolean;
  nombre: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      whileTap={{ scale: 0.92 }}
      className={`relative flex flex-col items-center justify-end gap-1 rounded-xl px-1 pb-1.5 pt-1 transition-colors ${
        activa ? "bg-accent-soft" : "hover:bg-ink/5"
      }`}
    >
      <span className="flex h-14 w-14 items-center justify-center">{children}</span>
      <span className={`text-[11px] ${activa ? "text-ink" : "text-ink-faint"}`}>{nombre}</span>
    </motion.button>
  );
}
