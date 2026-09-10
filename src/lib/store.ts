// store.ts: el estado global del frontend (con Zustand).
// Zustand es una librería mínima de estado: crea un "almacén" al que
// cualquier componente se suscribe con un hook (useTasksStore).
// Ventaja vs useState: la lista de tareas vive en un solo lugar y no hay
// que pasarla de componente en componente (prop drilling).

import { create } from "zustand";
import { api } from "./api";
import type { CreateTaskInput, Task } from "./types";

// El almacén: tasks son los datos, el resto es estado de la llamada
// (loading = "estoy pidiendo", error = "algo falló" para mostrar en UI).
// create<T>() recibe una función que devuelve el estado inicial + las
// acciones (funciones que mutan el estado con set()).
interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  loading: false,
  error: null,
  // loadTasks: pide la lista a Rust y la guarda.
  // Patrón: set(loading: true) -> pedir -> set(datos | error).
  // Así la UI puede mostrar "cargando..." y reaccionar a fallos.
  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.getTasks();
      set({ tasks, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
  // createTask: el "motor" de creación. No sabe de dónde viene el input
  // (captura rápida de hoy, o con fecha de la vista semana): solo lo
  // transmite a Rust y mantiene la lista actualizada.
  //
  // - Éxito: Rust devuelve la Task completa ya guardada; la agregamos AL
  //   FINAL de la lista para respetar el mismo orden de get_tasks
  //   (por created_at). Así no hay salto al recargar la app.
  // - Fallo: guardamos el mensaje en `error` y NO lanzamos la excepción:
  //   un error de creación no debe "estrellar" la app de una persona.
  //   La UI decide cómo avisarlo leyendo `error`.
  createTask: async (input) => {
    try {
      const task = await api.createTask(input);
      set((state) => ({ tasks: [...state.tasks, task], error: null }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
