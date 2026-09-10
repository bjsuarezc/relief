use serde::Serialize;
use tauri::State;

use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task
             ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;

    let tasks = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get("id")?,
                title: row.get("title")?,
                due_date: row.get("due_date")?,
                priority: row.get("priority")?,
                completed: row.get::<_, i64>("completed")? != 0,
                completed_at: row.get("completed_at")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tasks)
}
