// usePresencia: anima la SALIDA de un elemento que React desmontaría al
// instante. CSS no puede animar un elemento que ya no está en el DOM, así
// que este hook retiene el montaje unos milisegundos mientras corre la
// animación de salida y recién entonces lo retira.
//
// Devuelve:
// - montado: si el nodo debe existir en el DOM (incluye la fase de salida)
// - saliendo: si está en la fase de salida (para aplicar la clase de salida)
//
// Uso:
//   const { montado, saliendo } = usePresencia(abierto);
//   {montado && (
//     <div className={saliendo ? "panel-saliendo" : "panel-animada"}>…</div>
//   )}
//
// La duración debe coincidir con la animación de salida del CSS
// (--dur-fast = 140ms). Es un valor explícito y no una lectura del CSS
// porque getComputedStyle durante el render es costoso y frágil.

import { useEffect, useState } from "react";

export function usePresencia(abierto: boolean, duracionMs = 140) {
  const [montado, setMontado] = useState(abierto);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    // Abriendo: montar de inmediato (sin fase de salida).
    if (abierto) {
      setMontado(true);
      setSaliendo(false);
      return;
    }

    // Cerrando: si no hay nada montado, no hay nada que retirar.
    if (!montado) return;

    // Fase de salida: se mantiene montado hasta que termina la animación.
    setSaliendo(true);
    const temporizador = setTimeout(() => {
      setMontado(false);
      setSaliendo(false);
    }, duracionMs);

    return () => clearTimeout(temporizador);
  }, [abierto, montado, duracionMs]);

  return { montado, saliendo };
}
