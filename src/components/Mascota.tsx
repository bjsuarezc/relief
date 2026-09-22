// Mascota.tsx: personaje vectorial en capas (cuerpo, cabeza, brazo, cola,
// ojos) animado con Motion. El dibujo sale de Inspiracion/*.png vectorizado
// (src/lib/mascotas-datos.ts); acá solo se arma el rig y los estados.
//
// Colores por variables CSS, así los temas lo recolorean sin tocar el rig:
//   --trazo    línea
//   --borde    contorno claro tipo calcomanía (solo en oscuro)
//   --relleno  interior claro (suéter, cara)
// El pelaje llega por prop (paleta por animal, elegida en Ajustes) y no
// depende del tema.

import { useId } from "react";
import { motion } from "motion/react";
import { MASCOTAS } from "../lib/mascotas-datos";

export type Animal = "nutria" | "oso" | "gato";
export type EstadoMascota = "reposo" | "celebrar" | "dormir";

// Pelaje: la MISMA paleta de tres colores, en el mismo orden, para los tres
// animales. Son neutros cálidos/fríos que combinan con cualquier tema de
// color; medios u oscuros a propósito para que el trazo y los ojos se lean.
export const PALETA_PELAJE = [
  { nombre: "Chocolate", color: "#4a3527" },
  { nombre: "Grafito", color: "#2e2f36" },
  { nombre: "Piedra", color: "#6b5d52" },
] as const;

// Índice con el que cada animal se ve como en el dibujo original.
export const PELAJE_ORIGINAL: Record<Animal, number> = { nutria: 0, oso: 1, gato: 1 };

interface Props {
  animal: Animal;
  estado?: EstadoMascota;
  /** Cada cambio dispara un gesto corto ("completaste una tarea"). */
  reaccion?: number;
  /** Color del pelaje (por defecto, el original del animal). */
  pelaje?: string;
  className?: string;
}


export function Mascota({ animal, estado = "reposo", reaccion = 0, pelaje, className }: Props) {
  const id = useId().replace(/:/g, "");
  const m = MASCOTAS[animal];
  const t = m.tam;
  const dormido = estado === "dormir";
  const celebra = estado === "celebrar";
  const org = ([x, y]: [number, number]) => ({
    originX: x / t,
    originY: y / t,
    transformBox: "view-box" as const,
  });

  // Dibujo completo, recortado a la región de cada capa.
  const dibujo = (
    <>
      <use
        href={`#${id}-sil`}
        fill="var(--borde, transparent)"
        stroke="var(--borde, transparent)"
        strokeWidth={26}
        strokeLinejoin="round"
      />
      <use href={`#${id}-sil`} fill="var(--relleno, #fffdf6)" />
      <use href={`#${id}-tin`} fill="var(--trazo, #241a16)" fillRule="evenodd" />
      <use href={`#${id}-pel`} fill={pelaje ?? PALETA_PELAJE[PELAJE_ORIGINAL[animal]].color} fillRule="evenodd" />
    </>
  );

  // Movimiento: amplitudes chicas y en capas anidadas (el cuerpo respira, la
  // cabeza y el brazo siguen con un pequeño retraso), así se lee como un solo
  // cuerpo blando y no como piezas. Cada capa se solapa unos px con el cuerpo
  // (ver "huecos" en mascotas-datos), por eso nunca se abre una costura.
  const suave = (dur: number, delay = 0) => ({ duration: dur, delay, repeat: Infinity, repeatType: "mirror" as const, ease: [0.45, 0, 0.55, 1] as const });
  const gesto = reaccion > 0;
  // Gesto de "completaste": se agacha (anticipación), salta y aterriza con
  // rebote; la cabeza asiente un instante después y el brazo brinda.
  const salto = {
    y: [0, 5, -30, 0, -4, 0],
    scaleY: [1, 0.97, 1.03, 0.985, 1.004, 1],
    transition: { duration: 0.85, times: [0, 0.18, 0.5, 0.75, 0.88, 1], ease: "easeInOut" as const },
  };
  const asentir = { rotate: [0, 2.5, -3, 1, 0], transition: { duration: 0.85, delay: 0.08, times: [0, 0.2, 0.5, 0.8, 1], ease: "easeInOut" as const } };
  const brindar = { rotate: [0, 3, -7, 2, 0], transition: { duration: 0.9, delay: 0.14, times: [0, 0.2, 0.5, 0.8, 1], ease: "easeInOut" as const } };

  return (
    <svg
      viewBox={`0 0 ${t} ${t}`}
      className={className}
      role="img"
      aria-label={`Mascota: ${animal}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <path id={`${id}-sil`} d={m.silueta} fillRule="evenodd" />
        <path id={`${id}-tin`} d={m.tinta} fillRule="evenodd" />
        <path id={`${id}-pel`} d={m.pelaje} fillRule="evenodd" />
        <clipPath id={`${id}-cuerpo`}>
          <path d={m.huecos} clipRule="evenodd" />
        </clipPath>
        <clipPath id={`${id}-cabeza`}><path d={m.cabeza.clip} /></clipPath>
        <clipPath id={`${id}-brazo`}><path d={m.brazo.clip} /></clipPath>
        {m.cola && <clipPath id={`${id}-cola`}><path d={m.cola.clip} /></clipPath>}
      </defs>

      {/* Salto del gesto: envuelve todo el personaje (pivota en los pies). */}
      <motion.g
        key={gesto ? `g${reaccion}` : "quieto"}
        style={org(m.origenCuerpo)}
        animate={gesto ? salto : undefined}
      >
        <motion.g
          style={org(m.origenCuerpo)}
          animate={
            celebra
              ? { y: [0, 6, -30, 0], scaleY: [1, 0.975, 1.03, 1], transition: { duration: 0.9, times: [0, 0.2, 0.55, 1], repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" } }
              : { scaleY: dormido ? [1, 1.014] : [1, 1.009], transition: suave(dormido ? 3.4 : 2.8) }
          }
        >
          {m.cola && (
            <motion.g
              style={org(m.cola.origen)}
              animate={{
                rotate: celebra ? [-7, 8] : dormido ? [0, 1.5] : [-3, 4],
                transition: suave(celebra ? 0.3 : 3.2, 0.2),
              }}
            >
              <g clipPath={`url(#${id}-cola)`}>{dibujo}</g>
            </motion.g>
          )}

          <g clipPath={`url(#${id}-cuerpo)`}>{dibujo}</g>

          <motion.g
            style={org(m.cabeza.origen)}
            animate={{
              rotate: dormido ? [5, 6.5] : celebra ? [-2.5, 2.5] : [-1, 1.2],
              y: dormido ? [4, 7] : 0,
              transition: suave(dormido ? 3.4 : celebra ? 0.45 : 4.2, 0.25),
            }}
          >
            <motion.g
              key={gesto ? `c${reaccion}` : "c"}
              style={org(m.cabeza.origen)}
              animate={gesto ? asentir : undefined}
            >
              <g clipPath={`url(#${id}-cabeza)`}>{dibujo}</g>
              <Ojos animal={animal} puntos={m.ojos} dormido={dormido} celebra={celebra} />
            </motion.g>
          </motion.g>

          <motion.g
            style={org(m.brazo.origen)}
            animate={{
              rotate: celebra ? [-2, -9] : [-1, 1.5],
              transition: suave(celebra ? 0.45 : 3.6, 0.1),
            }}
          >
            <motion.g
              key={gesto ? `b${reaccion}` : "b"}
              style={org(m.brazo.origen)}
              animate={gesto ? brindar : undefined}
            >
              <g clipPath={`url(#${id}-brazo)`}>{dibujo}</g>
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.g>

      {celebra && <Chispas t={t} />}
      {dormido && <Zetas t={t} />}
    </svg>
  );
}

// Ojos propios: tapan el ojo dibujado con el relleno y ponen uno con un
// brillo (ojo vivo) que parpadea con scaleY. Dormido: párpado curvo cerrado.
const ESCALA_OJO: Record<Animal, number> = { nutria: 1, oso: 0.9, gato: 1 };

function Ojos({ animal, puntos, dormido, celebra }: { animal: Animal; puntos: [number, number][]; dormido: boolean; celebra: boolean }) {
  const k = ESCALA_OJO[animal];
  // Al celebrar los ojos se cierran (arco feliz) mientras dura el salto: mismos
  // tiempos que el salto del cuerpo, para que aterricen y abran a la vez.
  const salto = { duration: 0.9, times: [0, 0.18, 0.85, 1], repeat: Infinity, repeatDelay: 0.35 };
  return (
    <>
      {puntos.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={18 * k} fill="var(--relleno, #fffdf6)" />
          <motion.g
            style={{ originX: 0.5, originY: 0.5, transformBox: "fill-box" }}
            initial={false}
            animate={
              dormido
                ? { opacity: 0, scaleY: 0.1 }
                : celebra
                ? { opacity: [1, 0, 0, 1], scaleY: 1, transition: salto }
                : {
                    opacity: 1,
                    scaleY: [1, 1, 0.08, 1],
                    transition: { duration: 0.26, times: [0, 0.5, 0.72, 1], repeat: Infinity, repeatDelay: 3.4 + i * 0.05 },
                  }
            }
          >
            <ellipse cx={x} cy={y} rx={9.5 * k} ry={14 * k} fill="var(--trazo, #241a16)" transform={`rotate(-6 ${x} ${y})`} />
            <ellipse cx={x + 3 * k} cy={y - 5 * k} rx={3 * k} ry={3.6 * k} fill="#fff" />
          </motion.g>
          <motion.path
            d={celebra ? `M${x - 12 * k} ${y + 4 * k} Q${x} ${y - 10 * k} ${x + 12 * k} ${y + 4 * k}` : `M${x - 12 * k} ${y - 1 * k} Q${x} ${y + 9 * k} ${x + 12 * k} ${y - 1 * k}`}
            fill="none"
            stroke="var(--trazo, #241a16)"
            strokeWidth={5.5}
            strokeLinecap="round"
            initial={false}
            animate={celebra ? { opacity: [0, 1, 1, 0], transition: salto } : { opacity: dormido ? 1 : 0 }}
          />
        </g>
      ))}
    </>
  );
}

// Destellos al completar el día: suben y se desvanecen, escalonados.
function Chispas({ t }: { t: number }) {
  const puntos = [
    [0.18, 0.3], [0.85, 0.22], [0.12, 0.62], [0.9, 0.55], [0.5, 0.06],
  ] as const;
  return (
    <>
      {puntos.map(([px, py], i) => (
        <g key={i} transform={`translate(${px * t} ${py * t})`}>
        <motion.path
          d="M0 -90 L20 -20 L90 0 L20 20 L0 90 L-20 20 L-90 0 L-20 -20 Z"
          fill="var(--accent, #3f7367)"
          style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, 45],
            transition: { duration: 1.4, delay: i * 0.25, repeat: Infinity, repeatDelay: 0.4 },
          }}
        />
        </g>
      ))}
    </>
  );
}

function Zetas({ t }: { t: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.text
          key={i}
          x={t * 0.72}
          y={t * 0.16}
          fontSize={130 - i * 22}
          fontWeight={700}
          fill="var(--accent, #3f7367)"
          style={{ fontFamily: "var(--font-display, sans-serif)" }}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [0, -160],
            x: [0, 50],
            transition: { duration: 2.6, delay: i * 0.85, repeat: Infinity },
          }}
        >
          z
        </motion.text>
      ))}
    </>
  );
}
