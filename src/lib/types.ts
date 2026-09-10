// types.ts: los "contratos" de datos del frontend.
// Reflejan 1 a 1 lo que Rust envía/recibe (ver tasks.rs en src-tauri).
// Si cambias algo aquí, cambia también en Rust, y viceversa.

// La prioridad como texto literal: TS nos obliga a usar solo estos 3 valores.
export type Priority = "high" | "medium" | "low";

// Lo que enviamos al crear una tarea. Título es lo único obligatorio;
// si no manda dueDate o priority, Rust aplica sus defaults.
// dueDate como string "YYYY-MM-DD" (viene del selector de fecha nativo).
export interface CreateTaskInput {
  title: string;
  dueDate?: string | null;
  priority?: Priority;
}

// La tarea completa tal como la devuelve Rust.
// Nota camelCase: en la BD es due_date/completed_at, pero Rust traduce a
// camelCase al serializar (serde rename_all), y aquí consumimos esa versión.
export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
