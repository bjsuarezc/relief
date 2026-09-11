// api.ts: el ÚNICO puente entre el frontend y Rust.
// Cada propiedad llama a un comando Tauri por su nombre exacto.
// Regla del proyecto: ningún componente habla directo con invoke();
// siempre pasa por este archivo (así podemos cambiar la capa de datos
// sin tocar la UI).

import { invoke } from "@tauri-apps/api/core";
import type { CreateTaskInput, Task, UpdateTaskInput } from "./types";

export const api = {
  // invoke<T>("nombre_comando") ejecuta el comando Rust y promete un T.
  getTasks: () => invoke<Task[]>("get_tasks"),
  // El segundo argumento son los parámetros: { input } viaja como JSON
  // y Rust lo recibe como el struct CreateTaskInput.
  createTask: (input: CreateTaskInput) => invoke<Task>("create_task", { input }),
  // Toggle de completado (desmarcable). Rust es idempotente: pedir lo que
  // ya es verdad no cambia nada ni duplica eventos.
  setTaskCompleted: (id: string, completed: boolean) =>
    invoke<Task>("set_task_completed", { id, completed }),
  // Reorganización: mueve una tarea a otro día (el motor único de
  // "Mover a hoy" y del click en la fecha de cualquier fila). Los
  // argumentos camelCase viajan como JSON y Tauri los mapea a los
  // parámetros snake_case de Rust.
  setTaskDueDate: (id: string, dueDate: string) =>
    invoke<Task>("set_task_due_date", { id, dueDate }),
  // Correcciones de título/prioridad (cada campo opcional; solo se manda
  // lo que cambia — Rust registra un evento 'updated' por campo).
  updateTask: (id: string, cambios: UpdateTaskInput) =>
    invoke<Task>("update_task", { id, input: cambios }),
  // Papelera: mandar/restaurar (toggle suave), y borrado permanente
  // (una o todas). purge* borra fila + task_event: sin rastro.
  setTaskDeleted: (id: string, deleted: boolean) =>
    invoke<Task>("set_task_deleted", { id, deleted }),
  purgeTask: (id: string) => invoke<void>("purge_task", { id }),
  purgeAllTasks: () => invoke<number>("purge_all_tasks"),
};
