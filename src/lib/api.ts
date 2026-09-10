// api.ts: el ÚNICO puente entre el frontend y Rust.
// Cada propiedad llama a un comando Tauri por su nombre exacto.
// Regla del proyecto: ningún componente habla directo con invoke();
// siempre pasa por este archivo (así podemos cambiar la capa de datos
// sin tocar la UI).

import { invoke } from "@tauri-apps/api/core";
import type { CreateTaskInput, Task } from "./types";

export const api = {
  // invoke<T>("nombre_comando") ejecuta el comando Rust y promete un T.
  getTasks: () => invoke<Task[]>("get_tasks"),
  // El segundo argumento son los parámetros: { input } viaja como JSON
  // y Rust lo recibe como el struct CreateTaskInput.
  createTask: (input: CreateTaskInput) => invoke<Task>("create_task", { input }),
};
