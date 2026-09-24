// PapelBurbuja.tsx: mini juego sin objetivo ni puntaje, para bajar el
// estrés — una hoja de papel burbuja que nunca se termina. Cada burbuja
// revienta con un chasquido (visual + sonido, sonido.ts) y sola, después de
// un rato, se vuelve a inflar: no hay "ganar", solo la sensación.
//
// La hoja es más grande que cualquier pantalla y se desplaza (scroll) en
// vez de medir el contenedor con JS — así es de verdad un "rollo" del que
// nunca te quedás sin burbujas, y el código queda simple.

import { useEffect, useRef, useState } from "react";
import { Grip, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { sonidoPop } from "../lib/sonido";

const DIAMETRO_BURBUJA = 44; // px mínimo de cada burbuja (grid auto-fill)
const HUECO = 8;
const CANTIDAD_BURBUJAS = 480; // de sobra para llenar cualquier ventana y poder desplazarse
const REINFLADO_MIN_MS = 4500;
const REINFLADO_MAX_MS = 9000;

interface EstadoBurbuja {
  reventada: boolean;
  giro: number; // grados, fijo por burbuja: rompe la repetición visual
  tono: number; // 0..1, variación del sonido
}

function nuevaBurbuja(): EstadoBurbuja {
  return { reventada: false, giro: (Math.random() - 0.5) * 10, tono: Math.random() };
}

export function PapelBurbuja() {
  const [abierto, setAbierto] = useState(false);

  // Igual que PanelAjustes: Esc con captura + stopPropagation, para que
  // cierre el diálogo en vez de que el handler de App.tsx oculte la ventana
  // a la bandeja.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [abierto]);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Papel burbuja"
        title="Papel burbuja"
        whileTap={{ scale: 0.85 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="rounded-lg p-2 text-ink-soft transition-colors duration-[140ms] hover:bg-ink/5 hover:text-ink"
      >
        <Grip size={17} />
      </motion.button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            role="dialog"
            aria-label="Papel burbuja"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            className="fixed inset-0 z-40 flex flex-col bg-canvas"
          >
            <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-5">
              <p className="etiqueta text-ink-faint">papel burbuja</p>
              <motion.button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <X size={18} />
              </motion.button>
            </header>
            <Hoja />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// La hoja: se desmonta al cerrar el diálogo (AnimatePresence), así ningún
// temporizador de reinflado sigue vivo de fondo entre sesiones de juego.
function Hoja() {
  const [burbujas, setBurbujas] = useState<EstadoBurbuja[]>(() =>
    Array.from({ length: CANTIDAD_BURBUJAS }, nuevaBurbuja),
  );
  const temporizadores = useRef<number[]>([]);
  useEffect(() => () => temporizadores.current.forEach((id) => window.clearTimeout(id)), []);

  const reventar = (indice: number) => {
    // Chequeo contra el estado del último render (no contra el updater de
    // setBurbujas, que corre después): un clic no puede llegar dos veces
    // antes de que React vuelva a renderizar, así que alcanza.
    if (burbujas[indice].reventada) return;
    setBurbujas((actual) => {
      const copia = [...actual];
      copia[indice] = { ...copia[indice], reventada: true };
      return copia;
    });
    sonidoPop(burbujas[indice].tono);
    const espera = REINFLADO_MIN_MS + Math.random() * (REINFLADO_MAX_MS - REINFLADO_MIN_MS);
    const id = window.setTimeout(() => {
      setBurbujas((actual) => {
        const copia = [...actual];
        copia[indice] = { ...copia[indice], reventada: false };
        return copia;
      });
    }, espera);
    temporizadores.current.push(id);
  };

  return (
    <div
      className="sin-barra min-h-0 flex-1 overflow-y-auto px-4 pb-6"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${DIAMETRO_BURBUJA}px, 1fr))`,
        gap: HUECO,
        alignContent: "start",
      }}
    >
      {burbujas.map((b, i) => (
        <Burbuja key={i} estado={b} onReventar={() => reventar(i)} />
      ))}
    </div>
  );
}

function Burbuja({ estado, onReventar }: { estado: EstadoBurbuja; onReventar: () => void }) {
  return (
    <button
      type="button"
      onClick={onReventar}
      aria-label={estado.reventada ? "burbuja reventada" : "burbuja"}
      className="relative"
      style={{ aspectRatio: "1", touchAction: "manipulation" }}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ rotate: estado.giro }}
        animate={
          estado.reventada
            ? {
                scale: 0.84,
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.22)",
                backgroundColor: "var(--canvas)",
              }
            : {
                scale: 1,
                boxShadow: "inset -2px -3px 5px rgba(0,0,0,0.09), inset 2px 3px 4px rgba(255,255,255,0.3)",
                backgroundColor: "var(--surface)",
              }
        }
        transition={{ type: "spring", stiffness: 520, damping: estado.reventada ? 15 : 22 }}
      />
      {/* Brillo: solo mientras está inflada, le da el aire de plástico. */}
      {!estado.reventada && (
        <span
          className="pointer-events-none absolute rounded-full bg-white/35"
          style={{ left: "24%", top: "20%", width: "30%", height: "24%" }}
        />
      )}
      {/* Destello del reviente: un anillo que se expande y se apaga. */}
      <AnimatePresence>
        {estado.reventada && (
          <motion.span
            key="destello"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
            initial={{ opacity: 0.55, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </button>
  );
}
