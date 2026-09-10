// store.ts: el estado global del frontend (con Zustand).
// Zustand es una librería mínima de estado: crea un "almacén" al que
// cualquier componente se suscribe con un hook (useTasksStore).
// Ventaja vs useState: la lista de tareas vive en un solo lugar y no hay
// que pasarla de componente en componente (prop drilling).

import { create } from "zustand";
import { api } from "./api";
import type { Task } from "./types";

// El almacén: tasks son los datos, el resto es estado de la llamada
// (loading = "estoy pidiendo", error = "algo falló" para mostrar en UI).
// create<T>() recibe una función que devuelve el estado inicial + las
// acciones (funciones que mutan el estado con set()).
interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
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
}));
