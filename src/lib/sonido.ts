// sonido.ts: sonidos cortos sintetizados con Web Audio (sin archivos de
// audio que empaquetar). El contexto se crea recién al primer sonido: los
// navegadores exigen un gesto del usuario antes de dejar sonar audio, y un
// clic en una burbuja ya es ese gesto.

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  try {
    if (!contexto) contexto = new AudioContext();
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    // Algún navegador/entorno sin Web Audio: el silencio no debe romper nada.
    return null;
  }
}

// El "pop" de una burbuja de plástico: un tono que cae rápido con una
// envolvente muy corta. `variacion` (0 a 1) desafina un poco cada burbuja
// para que la hoja entera no suene a la misma nota repetida.
export function sonidoPop(variacion = Math.random()) {
  const audio = obtenerContexto();
  if (!audio) return;
  const ahora = audio.currentTime;
  const base = 240 + variacion * 90;

  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(base * 2.4, ahora);
  osc.frequency.exponentialRampToValueAtTime(base * 0.55, ahora + 0.055);

  const ganancia = audio.createGain();
  ganancia.gain.setValueAtTime(0.001, ahora);
  ganancia.gain.exponentialRampToValueAtTime(0.25, ahora + 0.006);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.09);

  osc.connect(ganancia).connect(audio.destination);
  osc.start(ahora);
  osc.stop(ahora + 0.1);
}
