import { create } from "zustand";
import { api } from "./api";
import type { Task } from "./types";

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
