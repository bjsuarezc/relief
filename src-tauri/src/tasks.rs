// tasks.rs: la capa de "casos de uso" de tareas.
// Aquí viven los comandos Tauri que el frontend puede invocar.
// Regla del proyecto: la UI nunca habla directo con la base de datos;
// siempre pasa por estas funciones, que validan y deciden.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

// Las prioridades se guardan como texto en la BD (se compara fácil en SQL).
// Esta constante es la "lista blanca": si llega algo distinto, se rechaza.
const PRIORIDADES_VALIDAS: [&str; 3] = ["high", "medium", "low"];

// CreateTaskInput: lo que el frontend envía al crear una tarea.
// - Serialize: permite convertirlo a JSON (lo usamos en el payload del evento).
// - Deserialize: permite leerlo desde el JSON que manda el frontend.
// - rename_all = "camelCase": en TS los campos son dueDate/priority (camelCase);
//   aquí en Rust son due_date/priority (snake_case). Serde traduce
//   automáticamente entre ambos mundos.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub due_date: Option<String>,
    pub priority: Option<String>,
}

// Task: la tarea completa tal como la ve el frontend.
// Es la imagen espejo de la fila de la tabla `task` (ver db.rs).
// Solo tiene Serialize: hacia el frontend se sale, desde el frontend no entra.
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

// get_tasks: devuelve TODAS las tareas, sin filtros.
// Decisión registrada en la bitácora: el frontend filtra (no optimizar antes
// de tiempo). Migrar los filtros a Rust es barato si algún día escala.
#[tauri::command]
pub fn get_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    // El estado global es un Mutex<Connection>: una sola conexión a SQLite
    // compartida por todos los comandos. El lock evita que dos comandos
    // la usen a la vez (SQLite no maneja concurrencia de escritura bien).
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task
             ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;

    // query_map recorre fila por fila y convierte cada una en un Task.
    // - completed viene como INTEGER (0/1) en SQLite; lo convertimos a bool.
    // - El "?" final de cada row.get() convierte el error de BD en error
    //   del closure; el .collect() al final junta todo en Result<Vec<Task>>.
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

// create_task: crea una tarea y registra el evento 'created'.
// Contrato acordado con el propietario (ver bitácora, Sesión 2):
//   create_task(input) -> Task  |  input = { title, dueDate?, priority? }
// El orden del cuerpo es: 1) validar, 2) generar datos del sistema,
// 3) escribir en la BD (fila + evento), 4) devolver la Task completa.
#[tauri::command]
pub fn create_task(state: State<AppState>, input: CreateTaskInput) -> Result<Task, String> {
    // --- 1. VALIDACIONES (el borde: nada de basura entra a la BD) ---

    // trim() quita espacios de los extremos: "  hola  " -> "hola".
    // Si después del trim no queda nada, el título es inválido.
    // Nota: trim() presta el texto (&str); el dueño del String sigue siendo input.
    let title = input.title.trim();
    if title.is_empty() {
        return Err("El título no puede estar vacío".to_string());
    }
    // chars().count() y no .len(): len() cuenta BYTES y un caracter con
    // acentos/emoji puede ocupar varios bytes. Aquí queremos caracteres.
    if title.chars().count() > 200 {
        return Err("El título no puede superar los 200 caracteres".to_string());
    }

    // Prioridad opcional: si no viene, "medium" es el default del MVP.
    // clone() porque después seguimos usando `input` (serializado como evento).
    let priority = input.priority.clone().unwrap_or_else(|| "medium".to_string());
    if !PRIORIDADES_VALIDAS.contains(&priority.as_str()) {
        return Err(format!("Prioridad inválida: {}", priority));
    }

    // "Cinturón de seguridad" acordado: la UI usa selector de fecha (el usuario
    // nunca escribe una), pero si por bug/fecha futura llega un string malo,
    // se rechaza aquí. NaiveDate ya sabe que el 2026-13-45 no existe.
    if let Some(due_date) = &input.due_date {
        chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d")
            .map_err(|_| format!("Fecha inválida: {}", due_date))?;
    }

    // --- 2. DATOS QUE LA UI NO DECIDE (los genera Rust, siempre) ---

    // id: UUID v4, aleatorio y prácticamente imposible de repetir.
    let id = uuid::Uuid::new_v4().to_string();
    // now: timestamp RFC 3339 (ISO 8601 con zona UTC, ej. "2026-09-10T21:30:00Z").
    let now = chrono::Utc::now().to_rfc3339();
    // payload del evento: el input tal cual llegó, serializado a JSON.
    let event_payload = serde_json::to_string(&input).map_err(|e| e.to_string())?;

    // --- 3. ESCRITURA EN LA BD ---

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // La fila de la tarea. `?5` dos veces reutiliza `now` para
    // created_at y updated_at (al crear, ambos valen lo mismo).
    conn.execute(
        "INSERT INTO task (id, title, due_date, priority, completed, completed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, ?5)",
        rusqlite::params![id, title, input.due_date, priority, now],
    )
    .map_err(|e| e.to_string())?;

    // El evento 'created' en task_event (log append-only, nunca se edita).
    // Es la "memoria conductual" que usará la capa de IA de la v2:
    // captura la historia desde el día uno.
    conn.execute(
        "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
         VALUES (?1, ?2, 'created', ?3, ?4)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), id, event_payload, now],
    )
    .map_err(|e| e.to_string())?;

    // --- 4. RESPUESTA: la Task completa, tal como quedó guardada ---

    // Devolvemos la Task completa (no solo el id) para que el store la agregue
    // a la lista sin volver a pedir get_tasks (decisión del propietario).
    Ok(Task {
        id,
        title: title.to_string(),
        due_date: input.due_date,
        priority,
        completed: false,
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}
