// CaptureBar: la barra de captura rápida — el corazón del MVP.
// Principio de la visión (docs/01-vision.md): si crear una tarea toma más
// de 5 segundos, fallamos. Por eso esta barra es un solo input + Enter.
//
// En este paso 1 la barra SOLO captura tareas de hoy:
// - manda dueDate = fecha de hoy (decisión del propietario: sin fecha
//   elegida, la tarea queda registrada para hoy),
// - no manda prioridad: Rust aplica su default "medium".
// Los chips "+ fecha" y "+ prioridad" llegan en el paso 2.

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useTasksStore } from "../lib/store";

export function CaptureBar() {
  // Suscripción fina: solo nos interesa createTask y error del store.
  // Zustand permite suscribirse a trozos del estado con un selector
  // (s => s.algo) para no re-renderizar por estados que no usamos.
  const createTask = useTasksStore((s) => s.createTask);
  const [title, setTitle] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  // useRef: referencia "directa" a un elemento del DOM, sin re-renderizar.
  // La usamos para devolver el foco al input después de cada captura,
  // de modo que puedas escribir la siguiente tarea sin tocar el mouse.
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    // Validación temprana (la misma regla que aplica Rust, pero aquí
    // da una mejor experiencia: no pedimos nada que sabemos que fallará).
    const trimmed = title.trim();
    if (trimmed === "") {
      setCaptureError("Escribe una tarea antes de crearla");
      inputRef.current?.focus();
      return;
    }

    const tasksBefore = useTasksStore.getState().tasks.length;

    // dueDate de hoy en "yyyy-MM-dd": el formato que espera Rust y el
    // selector <input type="date"> nativo (todo hablará el mismo idioma).
    await createTask({
      title: trimmed,
      dueDate: format(new Date(), "yyyy-MM-dd"),
    });

    // Detectamos si la creación falló comparando la lista: si no creció,
    // el store guardó el error y no limpiamos el texto (perder lo que
    // escribiste por un error sería frustrante). El foco siempre vuelve.
    const created = useTasksStore.getState().tasks.length > tasksBefore;
    if (created) {
      setTitle("");
      setCaptureError(null);
    } else {
      setCaptureError(useTasksStore.getState().error);
    }
    inputRef.current?.focus();
  };

  return (
    // <form> con onSubmit: así Enter dispara la creación de forma nativa,
    // sin listener de teclado manual. preventDefault evita que el
    // navegador "recargue" la página al enviar el formulario.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="w-full max-w-xl"
    >
      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 focus-within:border-neutral-600">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué tienes que hacer?"
          autoFocus
          className="w-full bg-transparent text-lg outline-none placeholder:text-neutral-600"
        />
        <button
          type="submit"
          aria-label="Crear tarea"
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Plus size={20} />
        </button>
      </div>
      {captureError && (
        <p className="mt-2 text-sm text-red-400">{captureError}</p>
      )}
    </form>
  );
}
