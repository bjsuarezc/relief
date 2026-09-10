export type Priority = "high" | "medium" | "low";

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
