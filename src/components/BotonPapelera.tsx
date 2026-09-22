// BotonPapelera: el acceso a la Papelera, en el encabezado.
//
// Vivía como cuarto botón de la barra inferior, pero solo aparecía cuando
// había algo borrado: la barra pasaba de 3 a 4 columnas y Hoy/Semana/Mes se
// corrían (y "no correspondía" junto a las vistas). Acá está siempre, en el
// mismo lugar, y el conteo va como insignia superpuesta: el botón mide lo
// mismo con la papelera vacía o llena, así que nada se mueve.
// Clic → abre la Papelera; estando en ella, clic → vuelve a Hoy (el botón no
// desaparece aunque se vacíe estando adentro).

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";

export function BotonPapelera({
  cantidad,
  activa,
  onClick,
}: {
  cantidad: number;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      aria-label={
        activa
          ? "Cerrar la papelera"
          : cantidad > 0
            ? `Papelera (${cantidad})`
            : "Papelera"
      }
      title={cantidad > 0 ? `Papelera (${cantidad})` : "Papelera"}
      whileTap={{ scale: 0.85 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      className={`relative rounded-lg p-2 transition-colors duration-[140ms] hover:bg-ink/5 ${
        activa
          ? "text-accent"
          : cantidad > 0
            ? "text-ink-soft hover:text-ink"
            : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      <Trash2 size={17} />
      {cantidad > 0 && (
        <span className="tnum absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-accent-ink">
          {cantidad}
        </span>
      )}
    </motion.button>
  );
}
