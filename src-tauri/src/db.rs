// db.rs: la capa de persistencia.
// Solo sabe dos cosas: cómo crear el esquema y cómo abrir la conexión.
// No contiene lógica de negocio: eso vive en tasks.rs.

use rusqlite::Connection;
use tauri::Manager;

// El esquema completo en un solo lugar. execute_batch() lo ejecuta entero.
// - IF NOT EXISTS: si la BD ya existe, no rompe (es idempotente).
// - task: el estado "actual" de cada tarea. completed_at existe desde el
//   día uno (decisión: columnas nullable se agregan tarde y duele migrar).
// - task_event: log append-only de TODO lo que pasa con las tareas.
//   Es la materia prima de la capa de IA de la v2 (patrones de procrastinación,
//   resúmenes semanales). Se escribe, nunca se edita ni se borra.
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

// init_db: abre (o crea) la BD y garantiza que el esquema exista.
// La guardamos en el directorio de datos de la app (app_data/tasklens.db),
// no junto al ejecutable: ahí es donde Windows/OS esperan datos de usuario.
// Migraciones: cambios al esquema que se aplican sobre una BD que YA
// existe en el disco del usuario. El SCHEMA (CREATE TABLE IF NOT EXISTS)
// no puede agregar columnas a una tabla que ya existe — para eso son
// estas migraciones.
//
// Cada entrada es una instrucción ALTER TABLE que:
// - se ejecuta en CADA arranque, y
// - es IDEMPOTENTE: si ya se aplicó (la columna existe), el error
//   "duplicate column name" se detecta y se ignora. No hay tabla de
//   versiones por ahora (con una migración basta; cuando haya varias,
//   un número de versión en la BD es el siguiente paso).
const MIGRACIONES: &[&str] = &[
    // v0.1: papelera de reciclaje (decisión del propietario: soft delete
    // VISIBLE en una papelera, con borrado permanente desde ahí por
    // privacidad — nada queda oculto sin que el usuario pueda purgarlo).
    "ALTER TABLE task ADD COLUMN deleted_at TEXT",
];

pub fn init_db(app: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    // app_data_dir() en Windows resuelve a %APPDATA%/<identificador de la app>.
    // expect() en vez de map_err: sin directorio de datos no tiene sentido
    // seguir ejecutando; es un error fatal de arranque.
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("no se pudo resolver el directorio de datos de la app");
    std::fs::create_dir_all(&data_dir).expect("no se pudo crear el directorio de datos");

    let conn = Connection::open(data_dir.join("tasklens.db"))?;
    conn.execute_batch(SCHEMA)?;

    // Aplicar migraciones, tolerando las que ya se aplicaron antes.
    for migracion in MIGRACIONES {
        if let Err(e) = conn.execute_batch(migracion) {
            let msg = e.to_string();
            // "duplicate column name" = la migración ya estaba aplicada
            // en un arranque anterior: es el caso feliz, se ignora.
            if !msg.contains("duplicate column name") {
                return Err(e);
            }
        }
    }

    Ok(conn)
}
