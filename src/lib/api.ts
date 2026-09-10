import { invoke } from "@tauri-apps/api/core";
import type { Task } from "./types";

export const api = {
  getTasks: () => invoke<Task[]>("get_tasks"),
};
