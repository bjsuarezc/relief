// PanelDesplegable: envoltorio para paneles que se abren bajo un control
// (el picker de fecha, el popover de prioridad).
//
// AnimatePresence + resorte real de Motion para la altura — no un
// timeout a mano sincronizado con CSS. AnimatePresence sabe cuándo
// terminó la salida para recién ahí desmontar; el respeto a "movimiento
// reducido" lo resuelve MotionConfig si está presente, y si no, el
// usuario no nota diferencia porque acá no hay CSS compitiendo.
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export function PanelDesplegable({
  abierto,
  children,
}: {
  abierto: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {abierto && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { type: "spring", stiffness: 500, damping: 42 },
            opacity: { duration: 0.15 },
          }}
          style={{ overflow: "hidden" }}
        >
          <div className="border-t border-line pt-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
