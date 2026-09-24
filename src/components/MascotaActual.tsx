// MascotaActual: la mascota que la persona eligió en Ajustes (o nada, si
// eligió "ninguna"). Un solo lugar para que cada pantalla no repita la lógica.

import { useAjustes } from "../lib/ajustes";
import { Mascota, MASCOTAS_HABILITADAS, PALETA_PELAJE, type EstadoMascota } from "./Mascota";

export function MascotaActual({
  estado,
  reaccion,
  className,
}: {
  estado?: EstadoMascota;
  reaccion?: number;
  className?: string;
}) {
  const animal = useAjustes((s) => s.mascota);
  const indice = useAjustes((s) => (s.mascota === "ninguna" ? 0 : s.colores[s.mascota]));
  if (!MASCOTAS_HABILITADAS || animal === "ninguna") return null;
  const pelaje = PALETA_PELAJE[indice]?.color;
  return <Mascota animal={animal} estado={estado} reaccion={reaccion} pelaje={pelaje} className={className} />;
}
