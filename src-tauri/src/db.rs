use rusqlite::Connection;
use tauri::Manager;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS task (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    due_date     TEXT,
    priority     TEXT NOT NULL DEFAULT 'medium',
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_event (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES task(id),
    event_type  TEXT NOT NULL,
    payload     TEXT,
    happened_at TEXT NOT NULL
);
";

pub fn init_db(app: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("no se pudo resolver el directorio de datos de la app");
    std::fs::create_dir_all(&data_dir).expect("no se pudo crear el directorio de datos");

    let conn = Connection::open(data_dir.join("tasklens.db"))?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}
